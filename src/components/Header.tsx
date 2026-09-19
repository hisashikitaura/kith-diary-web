"use client";

interface Props {
  title?: string;
  onSearch: () => void;
  onCalendar: () => void;
  onSettings: () => void;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  showSearchInput?: boolean;
}

export function Header({
  title = "Kith Diary",
  onSearch,
  onCalendar,
  onSettings,
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  showSearchInput = true,
}: Props) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSearchSubmit?.();
  };

  return (
    <header className="sticky top-0 z-20 bg-[#E8F6FB]/95 backdrop-blur border-b border-[#d1d5dc]/40">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
        <h1 className="text-lg font-bold text-[#1A3A4A] flex-shrink-0">{title}</h1>
        <div className="flex-1" />
        {showSearchInput && (
          <div className="hidden sm:flex items-center gap-1">
            <input
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="キーワード検索"
              className="w-40 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#5EC8E8]/40"
            />
            <button
              type="button"
              onClick={onSearchSubmit || onSearch}
              className="p-2 rounded-lg hover:bg-white/80 disabled:opacity-50"
              aria-label="検索"
              title="検索"
            >
              <SearchIcon />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onSearch}
          className="sm:hidden p-2 rounded-lg hover:bg-white/80"
          aria-label="検索"
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          onClick={onCalendar}
          className="p-2 rounded-lg hover:bg-[#E8F6FB] bg-white/50"
          aria-label="カレンダー"
        >
          <CalendarIcon />
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="p-2 rounded-lg hover:bg-white/80"
          aria-label="設定"
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5 text-[#1A3A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5 text-[#1A3A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-6 h-6 text-[#1A3A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
