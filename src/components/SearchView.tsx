"use client";

import { useState } from "react";
import type { DiaryEntry } from "@/lib/types";
import { searchEntries } from "@/lib/entries";
import { useAuth } from "@/lib/auth";
import { EntryCard } from "./EntryCard";

interface Props {
  onBack: () => void;
  onSelect: (entry: DiaryEntry) => void;
  initialQuery?: string;
}

export function SearchView({ onBack, onSelect, initialQuery = "" }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async () => {
    if (!user || !query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const found = await searchEntries(user.uid, query.trim());
      setResults(found);
    } catch (err) {
      console.error("Search error:", err);
      alert("検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8F6FB]">
      <div className="sticky top-0 z-10 bg-[#E8F6FB]/95 backdrop-blur border-b border-[#d1d5dc]/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="text-[#4AB8D8] text-sm font-medium min-h-[44px] px-1"
          >
            ← 戻る
          </button>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="キーワード検索"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5EC8E8]/40"
            autoFocus
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={loading || !query.trim()}
            className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50"
            aria-label="検索"
          >
            <svg className="w-5 h-5 text-[#1A3A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-gray-500 text-sm py-12">
            「{query}」を検索中…
          </p>
        ) : searched ? (
          results.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-12">
              「{query}」の検索結果はありません
            </p>
          ) : (
            <>
              <p className="text-sm text-[#1A3A4A] font-medium mb-3">
                「<span className="font-semibold">{query}</span>」の検索結果
                <span className="text-gray-400 font-normal ml-2">
                  {results.length}件
                </span>
              </p>
              <div className="space-y-3 pb-8">
                {results.map((e) => (
                  <EntryCard key={e.id} entry={e} onSelect={onSelect} />
                ))}
              </div>
              <p className="text-center text-gray-400 text-sm">
                すべての検索結果を表示しました
              </p>
            </>
          )
        ) : (
          <p className="text-center text-gray-400 text-sm py-12">
            キーワードを入力して検索
          </p>
        )}
      </div>
    </div>
  );
}
