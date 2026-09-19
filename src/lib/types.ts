/** Journey-compatible diary entry stored at users/{uid}/entries/{entryId} */
export type PhotoRef = string | { url: string; filename?: string };

export interface DiaryEntry {
  /** Firestore document id (and Journey `id` when present) */
  id: string;
  text: string;
  /** Journal date as Unix ms or ISO string / Firestore Timestamp-like */
  date_journal: number | string;
  date_modified?: number | string;
  photos?: PhotoRef[];
  address?: string;
  type?: string;
  timezone?: string;
  ai_comment?: string;
  ai_comment_requested?: boolean;
}

export interface UserSettings {
  locationEnabled?: boolean;
}

export type AppView =
  | "timeline"
  | "search"
  | "calendar"
  | "detail"
  | "compose"
  | "settings";

export const ALLOWED_EMAIL = "owner@example.com";
export const PAGE_SIZE = 20;
