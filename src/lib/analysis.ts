import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "./firebase";

export type AnalysisPeriod = "30d" | "90d" | "all";

export interface DiaryAnalysis {
  summary: string;
  themes: { title: string; description: string }[];
  moodTrend: string;
  notableMoments: { date: string; description: string }[];
  suggestions: string[];
}

export interface AnalysisResponse {
  period: AnalysisPeriod;
  entryCount: number;
  model: string;
  result: DiaryAnalysis;
}

export async function runDiaryAnalysis(period: AnalysisPeriod): Promise<AnalysisResponse> {
  const fn = httpsCallable<{ period: AnalysisPeriod }, AnalysisResponse>(
    getFirebaseFunctions(),
    "analyzeDiary",
    { timeout: 130000 }
  );
  const res = await fn({ period });
  return res.data;
}
