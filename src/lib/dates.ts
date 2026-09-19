/** Normalize various date representations to milliseconds since epoch. */
export function toMillis(value: number | string | { toMillis?: () => number; seconds?: number } | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") {
    // Heuristic: seconds vs ms
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isNaN(n) && value.trim() !== "") {
      return n < 1e12 ? n * 1000 : n;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object") {
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return value.seconds * 1000;
  }
  return 0;
}

export function formatJournalDate(value: number | string | undefined, timezone?: string): string {
  const ms = toMillis(value);
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: timezone || undefined,
    }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date(ms));
  }
}

export function formatShortDate(value: number | string | undefined): string {
  const ms = toMillis(value);
  if (!ms) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDayMs(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

export function endOfDayMs(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}
