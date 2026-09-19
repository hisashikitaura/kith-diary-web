"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

interface Props {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: Props) {
  const { user, signOutUser, settings, setLocationEnabled } = useAuth();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const locationOn = settings.locationEnabled !== false;

  const toggleLocation = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await setLocationEnabled(!locationOn);
      setMsg({
        type: "success",
        text: `位置情報を${!locationOn ? "取得する" : "取得しない"}設定にしました`,
      });
    } catch {
      setMsg({ type: "error", text: "設定の保存に失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    await signOutUser();
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
          <h2 className="flex-1 text-center font-bold text-[#1A3A4A]">設定</h2>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">アカウント</p>
          <p className="text-sm text-[#1A3A4A] font-medium">
            {user?.email || "—"}
          </p>
          {user?.displayName ? (
            <p className="text-xs text-gray-500 mt-1">{user.displayName}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={toggleLocation}
          disabled={busy}
          className="w-full bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between text-left disabled:opacity-50"
        >
          <span className="text-sm text-[#1A3A4A]">
            新規投稿時に位置情報を{locationOn ? "取得する" : "取得しない"}
          </span>
          <span
            className={`w-11 h-6 rounded-full relative transition ${
              locationOn ? "bg-[#4AB8D8]" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
                locationOn ? "left-5" : "left-0.5"
              }`}
            />
          </span>
        </button>

        {msg && (
          <p
            className={`text-sm ${
              msg.type === "success" ? "text-green-700" : "text-red-600"
            }`}
          >
            {msg.text}
          </p>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="w-full bg-white rounded-xl border border-red-100 p-4 text-sm text-red-600 font-medium hover:bg-red-50"
        >
          ログアウト
        </button>

        <p className="text-xs text-gray-400 text-center pt-4">
          Kith Diary · Firebase project kith-diary
        </p>
      </div>
    </div>
  );
}
