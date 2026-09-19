"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function KeyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
      />
    </svg>
  );
}

export function LockScreen() {
  const { unlockWithPasskey, signOutUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onUnlock = async () => {
    setBusy(true);
    setError("");
    try {
      const ok = await unlockWithPasskey();
      if (!ok) setError("認証に失敗しました");
    } catch (e) {
      console.error("Passkey unlock error:", e);
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError("認証がキャンセルされました");
      } else {
        setError("認証に失敗しました");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8F6FB] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 max-w-md w-full">
        <h1 className="text-3xl md:text-2xl font-bold text-[#1A3A4A] mb-3">
          パスキーでロック解除
        </h1>
        <p className="text-gray-600 mb-8 md:mb-6">
          Face ID、Touch ID、またはデバイスのロック解除方法を使用
        </p>

        <div className="mb-6">
          <button
            type="button"
            onClick={() => void onUnlock()}
            disabled={busy}
            className="w-full py-4 px-4 rounded-lg bg-[#5EC8E8] text-white active:bg-[#4AB8D8] sm:hover:bg-[#4AB8D8] transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
          >
            {busy ? (
              <>
                <Spinner />
                認証中...
              </>
            ) : (
              <>
                <KeyIcon />
                パスキーを使用
              </>
            )}
          </button>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void signOutUser()}
          className="w-full py-4 px-4 rounded-xl border-2 border-gray-300 text-gray-700 active:bg-gray-50 md:hover:bg-gray-50 transition-colors min-h-[56px]"
        >
          サインアウト
        </button>
      </div>
    </div>
  );
}
