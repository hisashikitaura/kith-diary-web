"use client";

import { useState } from "react";
import { runDiaryAnalysis, type AnalysisPeriod, type AnalysisResponse } from "@/lib/analysis";

const PERIODS: { value: AnalysisPeriod; label: string }[] = [
  { value: "30d", label: "30日" },
  { value: "90d", label: "90日" },
  { value: "all", label: "全期間" },
];

export function AnalysisView({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<AnalysisPeriod>("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await runDiaryAnalysis(period));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "AI分析に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const r = data?.result;

  return (
    <div className="min-h-screen bg-[#E8F6FB]">
      <header className="sticky top-0 z-20 bg-[#E8F6FB]/95 backdrop-blur border-b border-[#d1d5dc]/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <button type="button" onClick={onBack} className="p-2 rounded-lg hover:bg-white/80 text-[#1A3A4A]" aria-label="戻る">
            ←
          </button>
          <h1 className="text-lg font-bold text-[#1A3A4A]">AI分析</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm text-gray-600">
            過去の日記（本文と日付のみ）を Gemini（Vertex AI）で分析します。内容は学習に使われません。
          </p>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  period === p.value
                    ? "bg-[#4AB8D8] text-white border-[#4AB8D8]"
                    : "bg-white text-[#1A3A4A] border-gray-200 hover:bg-[#E8F6FB]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#4AB8D8] text-white font-medium hover:bg-[#5EC8E8] disabled:opacity-60"
          >
            {loading ? "分析中...（最大1〜2分）" : "分析する"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>

        {r && data && (
          <>
            <p className="text-xs text-gray-500">
              対象 {data.entryCount} 件 ・ モデル {data.model}
            </p>
            <Card title="まとめ">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.summary}</p>
            </Card>
            <Card title="テーマ">
              <ul className="space-y-2">
                {r.themes?.map((t, i) => (
                  <li key={i}>
                    <div className="font-medium text-sm">{t.title}</div>
                    <div className="text-sm text-gray-600">{t.description}</div>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="気分の推移">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.moodTrend}</p>
            </Card>
            <Card title="印象的な出来事">
              <ul className="space-y-2">
                {r.notableMoments?.map((m, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-[#4AB8D8] font-medium mr-2">{m.date}</span>
                    {m.description}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="やさしい提案">
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {r.suggestions?.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm text-[#1A3A4A]">
      <h2 className="font-bold mb-2">{title}</h2>
      {children}
    </section>
  );
}
