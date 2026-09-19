"use client";

import { useEffect, useState } from "react";
import type { DiaryEntry } from "@/lib/types";
import { formatJournalDate } from "@/lib/dates";
import { resolvePhotoUrl } from "@/lib/entries";
import { useAuth } from "@/lib/auth";

interface Props {
  entry: DiaryEntry;
  onSelect: (entry: DiaryEntry) => void;
}

export function EntryCard({ entry, onSelect }: Props) {
  const { user } = useAuth();
  const [thumb, setThumb] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !entry.photos?.length) {
        setThumb(undefined);
        return;
      }
      const url = await resolvePhotoUrl(user.uid, entry.id, entry.photos[0]);
      if (!cancelled) setThumb(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, entry]);

  const preview =
    entry.text.length > 120 ? `${entry.text.slice(0, 120)}…` : entry.text;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-[#5EC8E8]/50 transition"
    >
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#4AB8D8] font-medium mb-1">
            {formatJournalDate(entry.date_journal, entry.timezone)}
          </div>
          <p className="text-sm text-[#1A3A4A] whitespace-pre-wrap break-words">
            {preview || "（本文なし）"}
          </p>
          {entry.address ? (
            <p className="mt-2 text-xs text-gray-400 truncate">📍 {entry.address}</p>
          ) : null}
        </div>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-100"
          />
        ) : null}
      </div>
    </button>
  );
}
