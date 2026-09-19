"use client";

import type { DiaryEntry } from "@/lib/types";
import { EntryCard } from "./EntryCard";

interface Props {
  entries: DiaryEntry[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelect: (entry: DiaryEntry) => void;
  emptyHint?: string;
}

export function Timeline({
  entries,
  loading,
  hasMore,
  onLoadMore,
  onSelect,
  emptyHint = "右下の + ボタンから新規作成",
}: Props) {
  if (loading && entries.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">読み込み中...</div>
    );
  }

  if (!loading && entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500 mb-1">まだ日記がありません</p>
        <p className="text-gray-400 text-sm">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-3">
      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} onSelect={onSelect} />
      ))}
      {hasMore && (
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-white border border-gray-200 text-[#1A3A4A] hover:bg-gray-50 disabled:opacity-50 min-h-[44px]"
          >
            {loading ? "読み込み中..." : "さらに読み込む"}
          </button>
        </div>
      )}
      {!hasMore && entries.length > 0 && (
        <p className="text-center text-gray-400 text-xs py-2">すべて表示しました</p>
      )}
    </div>
  );
}
