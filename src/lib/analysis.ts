import { httpsCallable } from "firebase/functions";
import { collection, getDocs, type Timestamp } from "firebase/firestore";
import { getDb, getFirebaseAuth, getFirebaseFunctions } from "./firebase";

export interface DiaryAnalysis {
  summary: string;
  themes: { title: string; description: string }[];
  moodTrend: string;
  notableMoments: { date: string; description: string }[];
  suggestions: string[];
  note?: string;
}

export interface SavedAnalysis {
  month: string; // YYYY-MM (Asia/Tokyo)
  from: string;
  to: string;
  entryCount: number;
  analyzedCount: number;
  truncated: boolean;
  note: string | null;
  result: DiaryAnalysis;
  model: string;
  createdAt: number;
}

export interface BackfillResponse {
  totalMonths: number;
  alreadySaved: number;
  done: { month: string; entryCount: number; truncated: boolean }[];
  failed: string[];
  remaining: number;
}

/** Current month "YYYY-MM" in Asia/Tokyo. */
export function currentMonthJst(): string {
  const d = new Date(Date.now() + 9 * 3600000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function runMonthAnalysis(month: string): Promise<SavedAnalysis> {
  const fn = httpsCallable<{ month: string }, SavedAnalysis>(getFirebaseFunctions(), "analyzeDiary", {
    timeout: 130000,
  });
  return (await fn({ month })).data;
}

export async function runBackfill(): Promise<BackfillResponse> {
  const fn = httpsCallable<Record<string, never>, BackfillResponse>(getFirebaseFunctions(), "backfillAnalyses", {
    timeout: 560000,
  });
  return (await fn({})).data;
}

export async function listSavedAnalyses(): Promise<SavedAnalysis[]> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(collection(getDb(), "users", uid, "analyses"));
  return snap.docs
    .map((d) => {
      const x = d.data();
      const c = x.createdAt as Timestamp | undefined;
      return { ...(x as SavedAnalysis), month: d.id, createdAt: c?.toMillis?.() ?? 0 };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}
