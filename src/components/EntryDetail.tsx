"use client";

import { useEffect, useState } from "react";
import type { DiaryEntry } from "@/lib/types";
import { formatJournalDate } from "@/lib/dates";
import { deleteEntry, resolvePhotoUrl } from "@/lib/entries";
import { useAuth } from "@/lib/auth";

interface Props {
  entry: DiaryEntry;
  onBack: () => void;
  onDeleted: () => void;
}

export function EntryDetail({ entry, onBack, onDeleted }: Props) {
  const { user } = useAuth();
  const [photo, setPhoto] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !entry.photos?.length) {
        setPhoto(undefined);
        return;
      }
      const url = await resolvePhotoUrl(user.uid, entry.id, entry.photos[0]);
      if (!cancelled) setPhoto(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, entry]);

  const onDelete = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await deleteEntry(user.uid, entry);
      onDeleted();
    } catch (err) {
      console.error("Error deleting entry:", err);
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
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
          <div className="flex-1" />
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-red-500 text-sm font-medium min-h-[44px] px-2"
            >
              削除
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="text-gray-500 text-sm min-h-[44px] px-2"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="text-red-600 text-sm font-semibold min-h-[44px] px-2"
              >
                {busy ? "削除中..." : "削除する"}
              </button>
            </div>
          )}
        </div>
      </div>

      <article className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-sm text-[#4AB8D8] font-medium mb-3">
          {formatJournalDate(entry.date_journal, entry.timezone)}
        </p>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="w-full max-h-80 object-cover rounded-xl mb-4 bg-gray-100"
          />
        ) : null}
        <p className="text-[#1A3A4A] whitespace-pre-wrap break-words leading-relaxed">
          {entry.text || "（本文なし）"}
        </p>
        {entry.address ? (
          <p className="mt-4 text-sm text-gray-500">📍 {entry.address}</p>
        ) : null}
        {entry.ai_comment ? (
          <div className="mt-6 p-4 rounded-xl bg-white border border-[#5EC8E8]/30">
            <p className="text-xs font-semibold text-[#4AB8D8] mb-1">AIコメント</p>
            <p className="text-sm text-[#1A3A4A] whitespace-pre-wrap">
              {entry.ai_comment}
            </p>
          </div>
        ) : null}
      </article>
    </div>
  );
}
