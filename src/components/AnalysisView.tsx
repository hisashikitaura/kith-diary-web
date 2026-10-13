"use client";

import { useCallback, useEffect, useState } from "react";
import {
  currentMonthJst,
  listSavedAnalyses,
  runBackfill,
  runMonthAnalysis,
  type SavedAnalysis,
} from "@/lib/analysis";

const fmt = (m: string) => m.replace("-", "/");

export function AnalysisView({ onBack }: { onBack: () => void }) {
  const maxMonth = currentMonthJst();
  const [month, setMonth] = useState(maxMonth);
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSaved(await listSavedAnalyses());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const data = saved.find((s) => s.month === month) ?? null;

  const run = async () => {
    if (month > maxMonth) return setError("未来の月は指定できません。");
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await runMonthAnalysis(month);
      setSaved((prev) => [res, ...prev.filter((p) => p.month !== res.month)].sort((a, b) => b.month.localeCompare(a.month)));
    } catch (err) {
      setError((err instanceof Error ? err.message : String(err)) || "AI分析に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const backfill = async () => {
    setLoading(true);
    setError(null);
    setInfo("2026/09以前の月をまとめて分析中...（数分かかります）");
    try {
      const r = await runBackfill();
      const tr = r.done.filter((d) => d.truncated).map((d) => fmt(d.month));
      setInfo(
        `完了: ${r.done.length}か月を新規保存（保存済み ${r.alreadySaved}）` +
          (tr.length ? ` / 200件超過: ${tr.join(", ")}` : "") +
          (r.failed.length ? ` / 失敗: ${r.failed.map(fmt).join(", ")}` : "") +
          (r.remaining ? ` / 残り ${r.remaining}か月（もう一度押してください）` : "")
      );
      await reload();
    } catch (err) {
      setError((err instanceof Error ? err.message : String(err)) || "一括分析に失敗しました。");
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
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3 text-[#1A3A4A]">
          <p className="text-sm text-gray-600">
            1か月分の日記（本文と日付のみ、最大200件）を Gemini（Vertex AI）で分析し保存します。内容は学習に使われません。
          </p>
          <label className="flex items-center gap-2 text-sm">
            From
            <input
              type="month"
              value={month}
              max={maxMonth}
              onChange={(e) => e.target.value && setMonth(e.target.value > maxMonth ? maxMonth : e.target.value)}
              disabled={loading}
              className="border border-gray-200 rounded-lg px-2 py-1"
            />
            〜 1か月
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#4AB8D8] text-white font-medium hover:bg-[#5EC8E8] disabled:opacity-60"
          >
            {loading ? "分析中...（最大1〜2分）" : data ? "再分析する" : "分析する"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-gray-600">{info}</p>}
        </section>

        {saved.length > 0 && (
          <section className="bg-white rounded-2xl p-4 shadow-sm text-[#1A3A4A]">
            <h2 className="font-bold mb-2 text-sm">保存済みの分析</h2>
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <button
                  key={s.month}
                  type="button"
                  onClick={() => setMonth(s.month)}
                  className={`px-2.5 py-1 rounded-lg text-xs border ${
                    s.month === month ? "bg-[#4AB8D8] text-white border-[#4AB8D8]" : "border-gray-200 hover:bg-[#E8F6FB]"
                  }`}
                >
                  {fmt(s.month)}
                  {s.truncated ? " ⚠" : ""}
                </button>
              ))}
            </div>
          </section>
        )}

        {r && data && (
          <>
            <p className="text-xs text-gray-500">
              {fmt(data.month)} ・ 対象 {data.analyzedCount}/{data.entryCount} 件 ・ モデル {data.model}
              {data.createdAt ? ` ・ ${new Date(data.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}` : ""}
            </p>
            {data.note && (
              <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">{data.note}</p>
            )}
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
        <button
          type="button"
          onClick={() => void backfill()}
          disabled={loading}
          className="w-full py-2 rounded-xl border border-[#4AB8D8] text-[#1A3A4A] text-sm bg-white disabled:opacity-60"
        >
          2026/09以前を月ごとに一括分析（未保存の月のみ）
        </button>
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
