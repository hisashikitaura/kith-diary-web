"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function LoginScreen() {
  const { signInWithGoogle, denied } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Sign in error:", e);
      const msg =
        e instanceof Error && e.message.includes("権限")
          ? e.message
          : "サインインに失敗しました";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8F6FB] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-[#d1d5dc]/40 p-8 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-[#5EC8E8]/20 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[#4AB8D8]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1A3A4A] mb-1">Kith Diary</h1>
        <p className="text-sm text-gray-500 mb-8">あなたの日々を記録する</p>

        <button
          type="button"
          onClick={onSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-60 min-h-[48px]"
        >
          <GoogleIcon />
          <span className="text-gray-700 font-medium">
            {busy ? "サインイン中..." : "Googleでサインイン"}
          </span>
        </button>

        <p className="mt-4 text-xs text-gray-500">
          Googleアカウントでサインインして始めます
        </p>

        {(denied || error) && (
          <div className="mt-4 text-xs text-red-600">
            {error ||
              "このアカウントはこの日記を使用する権限がありません。"}
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
