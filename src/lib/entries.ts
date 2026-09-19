import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { getDb, getFirebaseStorage } from "./firebase";
import type { DiaryEntry, PhotoRef } from "./types";
import { PAGE_SIZE } from "./types";
import { toMillis } from "./dates";

function entriesCol(uid: string) {
  return collection(getDb(), "users", uid, "entries");
}

function entryDoc(uid: string, entryId: string) {
  return doc(getDb(), "users", uid, "entries", entryId);
}

export function photoUrl(photo: PhotoRef | undefined): string | undefined {
  if (!photo) return undefined;
  if (typeof photo === "string") {
    if (photo.startsWith("http://") || photo.startsWith("https://")) return photo;
    return undefined; // storage path — resolve async
  }
  return photo.url;
}

export function photoStoragePath(
  uid: string,
  entryId: string,
  photo: PhotoRef
): string | null {
  if (typeof photo === "string") {
    if (photo.startsWith("http://") || photo.startsWith("https://")) return null;
    // relative filename or path
    if (photo.includes("/")) return photo;
    return `users/${uid}/entries/${entryId}/${photo}`;
  }
  if (photo.filename) {
    return `users/${uid}/entries/${entryId}/${photo.filename}`;
  }
  return null;
}

export async function resolvePhotoUrl(
  uid: string,
  entryId: string,
  photo: PhotoRef | undefined
): Promise<string | undefined> {
  if (!photo) return undefined;
  const direct = photoUrl(photo);
  if (direct) return direct;
  const path = photoStoragePath(uid, entryId, photo);
  if (!path) return undefined;
  try {
    return await getDownloadURL(ref(getFirebaseStorage(), path));
  } catch {
    return undefined;
  }
}

function mapDoc(snap: QueryDocumentSnapshot | DocumentSnapshot): DiaryEntry {
  const data = snap.data() || {};
  return {
    id: (data.id as string) || snap.id,
    text: (data.text as string) || "",
    date_journal: (data.date_journal as number | string) ?? 0,
    date_modified: data.date_modified as number | string | undefined,
    photos: (data.photos as PhotoRef[]) || [],
    address: data.address as string | undefined,
    type: data.type as string | undefined,
    timezone: data.timezone as string | undefined,
    ai_comment: data.ai_comment as string | undefined,
    ai_comment_requested: data.ai_comment_requested as boolean | undefined,
  };
}

export interface PageResult {
  entries: DiaryEntry[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function fetchEntriesPage(
  uid: string,
  pageSize = PAGE_SIZE,
  cursor?: DocumentSnapshot | null
): Promise<PageResult> {
  let q = query(
    entriesCol(uid),
    orderBy("date_journal", "desc"),
    limit(pageSize)
  );
  if (cursor) {
    q = query(
      entriesCol(uid),
      orderBy("date_journal", "desc"),
      startAfter(cursor),
      limit(pageSize)
    );
  }
  const snap = await getDocs(q);
  const entries = snap.docs.map(mapDoc);
  return {
    entries,
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function fetchEntry(
  uid: string,
  entryId: string
): Promise<DiaryEntry | null> {
  const snap = await getDoc(entryDoc(uid, entryId));
  if (!snap.exists()) return null;
  return mapDoc(snap);
}

export async function fetchEntriesForDay(
  uid: string,
  startMs: number,
  endMs: number
): Promise<DiaryEntry[]> {
  const q = query(
    entriesCol(uid),
    where("date_journal", ">=", startMs),
    where("date_journal", "<=", endMs),
    orderBy("date_journal", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

/** Client-side keyword scan (no Meilisearch). Loads recent docs and filters. */
export async function searchEntries(
  uid: string,
  keyword: string,
  maxScan = 500
): Promise<DiaryEntry[]> {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  const q = query(
    entriesCol(uid),
    orderBy("date_journal", "desc"),
    limit(maxScan)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(mapDoc)
    .filter((e) => {
      const hay = `${e.text || ""} ${e.address || ""} ${e.ai_comment || ""}`.toLowerCase();
      return hay.includes(kw);
    });
}

function newEntryId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  }
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreateEntryInput {
  text: string;
  date_journal?: number;
  address?: string;
  photoFile?: File | null;
  ai_comment_requested?: boolean;
}

export async function createEntry(
  uid: string,
  input: CreateEntryInput
): Promise<DiaryEntry> {
  const id = newEntryId();
  const now = Date.now();
  const date_journal = input.date_journal ?? now;
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";

  const photos: PhotoRef[] = [];
  if (input.photoFile) {
    const ext = input.photoFile.name.split(".").pop() || "jpg";
    const filename = `${Date.now()}.${ext}`;
    const storagePath = `users/${uid}/entries/${id}/${filename}`;
    const storageRef = ref(getFirebaseStorage(), storagePath);
    await uploadBytes(storageRef, input.photoFile);
    const url = await getDownloadURL(storageRef);
    photos.push(url);
  }

  const data: Omit<DiaryEntry, "id"> & { id: string } = {
    id,
    text: input.text.trim(),
    date_journal,
    date_modified: now,
    photos,
    address: input.address?.trim() || "",
    type: "text",
    timezone,
    ai_comment_requested: !!input.ai_comment_requested,
  };

  await setDoc(entryDoc(uid, id), data);
  return data;
}

export async function deleteEntry(uid: string, entry: DiaryEntry): Promise<void> {
  const photos = entry.photos || [];
  for (const photo of photos) {
    try {
      const path = photoStoragePath(uid, entry.id, photo);
      if (path) {
        await deleteObject(ref(getFirebaseStorage(), path));
      } else if (typeof photo === "string" && photo.startsWith("http")) {
        // Best-effort: ignore remote URLs we can't map to a path
      }
    } catch (err) {
      console.warn("Failed to delete photo:", err);
    }
  }
  await deleteDoc(entryDoc(uid, entry.id));
}

export function sortByJournalDesc(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort(
    (a, b) => toMillis(b.date_journal) - toMillis(a.date_journal)
  );
}
