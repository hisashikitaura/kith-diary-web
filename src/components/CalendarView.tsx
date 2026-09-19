"use client";

import { useEffect, useMemo, useState } from "react";
import type { DiaryEntry } from "@/lib/types";
import { fetchEntriesForDay } from "@/lib/entries";
import { useAuth } from "@/lib/auth";
import { dayKey, endOfDayMs, startOfDayMs, toMillis } from "@/lib/dates";
import { EntryCard } from "./EntryCard";

interface Props {
  onBack: () => void;
  onSelect: (entry: DiaryEntry) => void;
  /** Known entries for marking days (timeline cache) */
  knownEntries?: DiaryEntry[];
}

export function CalendarView({ onBack, onSelect, knownEntries = [] }: Props) {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [dayEntries, setDayEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const marked = useMemo(() => {
    const set = new Set<string>();
    for (const e of knownEntries) {
      const ms = toMillis(e.date_journal);
      if (ms) set.add(dayKey(ms));
    }
    return set;
  }, [knownEntries]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun

  useEffect(() => {
    if (!user || selectedDay == null) {
      setDayEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const start = startOfDayMs(year, month, selectedDay);
        const end = endOfDayMs(year, month, selectedDay);
        const list = await fetchEntriesForDay(user.uid, start, end);
        if (!cancelled) setDayEntries(list);
      } catch (err) {
        console.error("Calendar day load error:", err);
        // Fallback: filter known entries
        if (!cancelled) {
          const start = startOfDayMs(year, month, selectedDay);
          const end = endOfDayMs(year, month, selectedDay);
          setDayEntries(
            knownEntries.filter((e) => {
              const ms = toMillis(e.date_journal);
              return ms >= start && ms <= end;
            })
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, year, month, selectedDay, knownEntries]);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

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
          <h2 className="flex-1 text-center font-bold text-[#1A3A4A]">カレンダー</h2>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="px-3 py-2 text-[#1A3A4A]">
              ‹
            </button>
            <span className="font-semibold text-[#1A3A4A]">
              {year}年{month}月
            </span>
            <button type="button" onClick={nextMonth} className="px-3 py-2 text-[#1A3A4A]">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
            {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d == null) return <div key={`e-${i}`} />;
              const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const has = marked.has(key);
              const selected = selectedDay === d;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={`aspect-square rounded-lg text-sm relative ${
                    selected
                      ? "bg-[#4AB8D8] text-white"
                      : "hover:bg-[#E8F6FB] text-[#1A3A4A]"
                  }`}
                >
                  {d}
                  {has && (
                    <span
                      className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                        selected ? "bg-white" : "bg-[#4AB8D8]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDay != null && (
          <div>
            <h3 className="text-sm font-medium text-[#1A3A4A] mb-3">
              {year}年{month}月{selectedDay}日
            </h3>
            {loading ? (
              <p className="text-gray-500 text-sm py-8 text-center">読み込み中...</p>
            ) : dayEntries.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">この日の日記はありません</p>
            ) : (
              <div className="space-y-3 pb-8">
                {dayEntries.map((e) => (
                  <EntryCard key={e.id} entry={e} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
