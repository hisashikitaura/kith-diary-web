import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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
const SCAN_LIMIT = 1000;

type Period = "30d" | "90d" | "all";

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

export const analyzeDiary = onCall(
  { region: FUNCTION_REGION, timeoutSeconds: 120, memory: "512MiB", maxInstances: 3 },
  async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError("unauthenticated", "ログインが必要です。");
    if (auth.token.email !== ALLOWED_EMAIL) {
      throw new HttpsError("permission-denied", "このアカウントでは利用できません。");
    }
    const period = (request.data?.period ?? "30d") as Period;
    if (!["30d", "90d", "all"].includes(period)) {
      throw new HttpsError("invalid-argument", "period が不正です。");
    }
    const since =
      period === "all" ? 0 : Date.now() - (period === "30d" ? 30 : 90) * 86400000;

    // Only the caller's own path: users/{uid}/entries
    const snap = await getFirestore()
      .collection("users").doc(auth.uid).collection("entries")
      .orderBy("date_journal", "desc").limit(SCAN_LIMIT).get();

    const rows = snap.docs
      .map((d) => {
        const data = d.data();
        return { ms: toMillis(data.date_journal), text: String(data.text ?? "").trim() };
      })
      .filter((r) => r.text && r.ms >= since)
      .sort((a, b) => b.ms - a.ms)
      .slice(0, MAX_ENTRIES);

    if (rows.length === 0) {
      throw new HttpsError("failed-precondition", "対象期間に日記がありません。");
    }

    let total = 0;
    const lines: string[] = [];
    for (const r of rows) {
      const date = new Date(r.ms).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
      const line = `[${date}] ${r.text.slice(0, MAX_ENTRY_CHARS)}`;
      if (total + line.length > MAX_TOTAL_CHARS) break;
      total += line.length;
      lines.push(line);
    }
    lines.reverse(); // chronological

    const prompt = `あなたは思いやりのある日記の振り返りアシスタントです。
以下はユーザー本人の日記（古い順）です。日本語で分析し、指定のJSONで返してください。
- summary: 全体の要約（3〜4文）
- themes: よく出てくるテーマ（3〜6個、タイトルと説明）
- moodTrend: 気分・感情の推移（期間の流れがわかるように）
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

    try {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema, temperature: 0.6 },
      });
      const result = JSON.parse(res.text ?? "{}");
      return { period, entryCount: lines.length, model: GEMINI_MODEL, result };
    } catch (err) {
      console.error("Gemini call failed", err);
      throw new HttpsError("internal", "AI分析に失敗しました。時間をおいて再試行してください。");
    }
  }
);
