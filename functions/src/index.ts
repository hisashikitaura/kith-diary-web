import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI, Type } from "@google/genai";

initializeApp();

/** ---- Config ---- */
export const FUNCTION_REGION = "asia-northeast1";
/** Vertex AI location used for the Gemini call. */
export const VERTEX_LOCATION = "asia-northeast1";
/** Gemini Flash model on Vertex AI (change here to upgrade). */
export const GEMINI_MODEL = "gemini-2.5-flash";
const ALLOWED_EMAIL = "owner@example.com";
const MAX_ENTRIES = 200;
const MAX_TOTAL_CHARS = 60000;
const MAX_ENTRY_CHARS = 1500;
const SCAN_LIMIT = 5000;
const JST = 9 * 3600000;
const BACKFILL_END = "2026-09";

function toMillis(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n) && v.trim() !== "") return n < 1e12 ? n * 1000 : n;
    const p = Date.parse(v);
    return Number.isNaN(p) ? 0 : p;
  }
  const o = v as { toMillis?: () => number; seconds?: number };
  if (typeof o.toMillis === "function") return o.toMillis();
  if (typeof o.seconds === "number") return o.seconds * 1000;
  return 0;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    themes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
        required: ["title", "description"],
      },
    },
    moodTrend: { type: Type.STRING },
    notableMoments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { date: { type: Type.STRING }, description: { type: Type.STRING } },
        required: ["date", "description"],
      },
    },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["summary", "themes", "moodTrend", "notableMoments", "suggestions"],
};

/** "YYYY-MM" (Asia/Tokyo) of a millis timestamp. */
function monthKey(ms: number): string {
  const d = new Date(ms + JST);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** [from, to) millis for a JST calendar month. */
function monthRange(month: string): { from: number; to: number } {
  const [y, m] = month.split("-").map(Number);
  return { from: Date.UTC(y, m - 1, 1) - JST, to: Date.UTC(y, m, 1) - JST };
}

type Row = { ms: number; text: string };

async function loadRows(uid: string): Promise<Row[]> {
  const col = getFirestore().collection("users").doc(uid).collection("entries");
  const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = col.orderBy("date_journal", "desc").limit(SCAN_LIMIT);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    docs.push(...snap.docs);
    if (snap.size < SCAN_LIMIT) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return docs
    .map((d) => {
      const data = d.data();
      return { ms: toMillis(data.date_journal), text: String(data.text ?? "").trim() };
    })
    .filter((r) => r.text && r.ms > 0);
}

async function analyzeMonth(uid: string, month: string, all: Row[]) {
  const { from, to } = monthRange(month);
  const inMonth = all.filter((r) => r.ms >= from && r.ms < to).sort((a, b) => a.ms - b.ms);
  if (inMonth.length === 0) return null;
  const rows = inMonth.slice(0, MAX_ENTRIES); // oldest 200 of the month

  let total = 0;
  const lines: string[] = [];
  for (const r of rows) {
    const date = new Date(r.ms).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
    const line = `[${date}] ${r.text.slice(0, MAX_ENTRY_CHARS)}`;
    if (total + line.length > MAX_TOTAL_CHARS) break;
    total += line.length;
    lines.push(line);
  }
  const truncated = inMonth.length > lines.length;
  const note = truncated
    ? `この月の日記は${inMonth.length}件ありましたが、上限のため${lines.length}件のみ分析しました（月の前半から順に）。`
    : null;

  const prompt = `あなたは思いやりのある日記の振り返りアシスタントです。
以下はユーザー本人の${month.replace("-", "年")}月の日記（古い順）です。日本語で分析し、指定のJSONで返してください。
- summary: 全体の要約（3〜4文）
- themes: よく出てくるテーマ（3〜6個、タイトルと説明）
- moodTrend: 気分・感情の推移（月の流れがわかるように）
- notableMoments: 印象的な出来事（日付つき、最大6個）
- suggestions: やさしい提案（3〜5個、押しつけず前向きに）
医学的な診断はしないでください。

日記:
${lines.join("\n")}`;

  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
    location: VERTEX_LOCATION,
  });
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema, temperature: 0.6 },
  });
  const result = JSON.parse(res.text ?? "{}");
  if (note) result.note = note;

  const doc = {
    month,
    from: new Date(from).toISOString(),
    to: new Date(to - 1).toISOString(),
    entryCount: inMonth.length,
    analyzedCount: lines.length,
    truncated,
    note,
    result,
    model: GEMINI_MODEL,
    createdAt: FieldValue.serverTimestamp(),
  };
  await getFirestore().collection("users").doc(uid).collection("analyses").doc(month).set(doc);
  return { ...doc, createdAt: Date.now() };
}

function requireOwner(auth: { uid: string; token: { email?: string } } | undefined) {
  if (!auth) throw new HttpsError("unauthenticated", "ログインが必要です。");
  if (auth.token.email !== ALLOWED_EMAIL) {
    throw new HttpsError("permission-denied", "このアカウントでは利用できません。");
  }
  return auth.uid;
}

/** Analyze one JST calendar month ("YYYY-MM") and save to users/{uid}/analyses/{month}. */
export const analyzeDiary = onCall(
  { region: FUNCTION_REGION, timeoutSeconds: 120, memory: "512MiB", maxInstances: 3 },
  async (request) => {
    const uid = requireOwner(request.auth);
    const month = String(request.data?.month ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new HttpsError("invalid-argument", "month は YYYY-MM で指定してください。");
    }
    if (month > monthKey(Date.now())) {
      throw new HttpsError("invalid-argument", "未来の月は指定できません。");
    }
    const rows = await loadRows(uid);
    try {
      const saved = await analyzeMonth(uid, month, rows);
      if (!saved) throw new HttpsError("failed-precondition", "この月の日記がありません。");
      return saved;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("Gemini call failed", err);
      throw new HttpsError("internal", "AI分析に失敗しました。時間をおいて再試行してください。");
    }
  }
);

/** One-off: analyze every month up to 2026-09 that has entries and no saved analysis. Resumable. */
export const backfillAnalyses = onCall(
  { region: FUNCTION_REGION, timeoutSeconds: 540, memory: "512MiB", maxInstances: 1 },
  async (request) => {
    const uid = requireOwner(request.auth);
    const rows = await loadRows(uid);
    const months = [...new Set(rows.map((r) => monthKey(r.ms)))]
      .filter((m) => m <= BACKFILL_END).sort();
    const existing = await getFirestore().collection("users").doc(uid).collection("analyses").get();
    const have = new Set(existing.docs.map((d) => d.id));
    const todo = months.filter((m) => !have.has(m));
    const started = Date.now();
    const done: { month: string; entryCount: number; truncated: boolean }[] = [];
    const failed: string[] = [];
    for (const m of todo) {
      if (Date.now() - started > 420000) break; // leave headroom; call again to resume
      try {
        const s = await analyzeMonth(uid, m, rows);
        if (s) done.push({ month: m, entryCount: s.entryCount, truncated: s.truncated });
      } catch (err) {
        console.error("backfill failed", m, err);
        failed.push(m);
      }
    }
    const remaining = todo.length - done.length - failed.length;
    return { totalMonths: months.length, alreadySaved: months.length - todo.length, done, failed, remaining };
  }
);
