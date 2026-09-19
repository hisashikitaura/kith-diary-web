"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import type { AppView, DiaryEntry } from "@/lib/types";
import { fetchEntriesPage } from "@/lib/entries";
import { LoginScreen } from "./LoginScreen";
import { Header } from "./Header";
import { Timeline } from "./Timeline";
import { ComposeModal } from "./ComposeModal";
import { EntryDetail } from "./EntryDetail";
import { SearchView } from "./SearchView";
import { CalendarView } from "./CalendarView";
import { SettingsPanel } from "./SettingsPanel";
import { LockScreen } from "./LockScreen";
import { PasskeySetup } from "./PasskeySetup";

export function AppShell() {
  const { user, loading: authLoading, unlocked, hasPasskey } = useAuth();
  const [view, setView] = useState<AppView>("timeline");
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DiaryEntry | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchInitial, setSearchInitial] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const cursorRef = useRef<DocumentSnapshot | null>(null);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await fetchEntriesPage(user.uid, undefined, null);
      setEntries(result.entries);
      cursorRef.current = result.lastDoc;
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("Error refreshing entries:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!user || loadingRef.current || !cursorRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await fetchEntriesPage(
        user.uid,
        undefined,
        cursorRef.current
      );
      setEntries((prev) => [...prev, ...result.entries]);
      cursorRef.current = result.lastDoc;
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("Error loading entries:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void refresh();
    } else {
      setEntries([]);
      cursorRef.current = null;
      setHasMore(true);
      setView("timeline");
      setSelected(null);
    }
  }, [user, refresh]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#E8F6FB] flex items-center justify-center">
        <div className="text-gray-500 text-sm">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Match production: no passkey → setup; has passkey but locked → lock screen
  if (!hasPasskey) {
    return <PasskeySetup />;
  }
  if (!unlocked) {
    return <LockScreen />;
  }

  if (view === "detail" && selected) {
    return (
      <EntryDetail
        entry={selected}
        onBack={() => {
          setView("timeline");
          setSelected(null);
        }}
        onDeleted={() => {
          setSelected(null);
          setView("timeline");
          void refresh();
        }}
      />
    );
  }

  if (view === "search") {
    return (
      <SearchView
        initialQuery={searchInitial}
        onBack={() => setView("timeline")}
        onSelect={(e) => {
          setSelected(e);
          setView("detail");
        }}
      />
    );
  }

  if (view === "calendar") {
    return (
      <CalendarView
        knownEntries={entries}
        onBack={() => setView("timeline")}
        onSelect={(e) => {
          setSelected(e);
          setView("detail");
        }}
      />
    );
  }

  if (view === "settings") {
    return <SettingsPanel onBack={() => setView("timeline")} />;
  }

  return (
    <div className="min-h-screen bg-[#E8F6FB]">
      <Header
        onSearch={() => {
          setSearchInitial(searchDraft);
          setView("search");
        }}
        onCalendar={() => setView("calendar")}
        onSettings={() => setView("settings")}
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearchSubmit={() => {
          setSearchInitial(searchDraft);
          setView("search");
        }}
      />

      <main className="max-w-2xl mx-auto px-4 py-4">
        <Timeline
          entries={entries}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={() => void loadMore()}
          onSelect={(e) => {
            setSelected(e);
            setView("detail");
          }}
        />
      </main>

      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        className="fixed right-5 bottom-6 w-14 h-14 rounded-full bg-[#4AB8D8] text-white text-3xl shadow-lg hover:bg-[#5EC8E8] transition flex items-center justify-center z-30"
        aria-label="新規作成"
      >
        +
      </button>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={() => void refresh()}
      />
    </div>
  );
}
