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

export function PasskeySetup() {
  const { passkeyAvailable, registerPasskey, signOutUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onRegister = async () => {
    setBusy(true);
    setError("");
    try {
      await registerPasskey();
      window.location.reload();
    } catch (e) {
      console.error("Passkey registration error:", e);
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError("パスキーの登録がキャンセルされました");
      } else {
        setError("パスキーの登録に失敗しました");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!passkeyAvailable) {
    return (
      <div className="min-h-screen bg-[#E8F6FB] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 max-w-md w-full text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl md:text-2xl font-bold text-[#1A3A4A] mb-3">
            パスキーが必要です
          </h1>
          <p className="text-gray-600 mb-8">
            このアプリはパスキー（WebAuthn）に対応したブラウザまたはデバイスが必要です。
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Safari (iOS 16+)、Chrome、Edge などの最新ブラウザをご使用ください。
          </p>
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

  return (
    <div className="min-h-screen bg-[#E8F6FB] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 max-w-md w-full">
        <h1 className="text-3xl md:text-2xl font-bold text-[#1A3A4A] mb-3">
          パスキーを設定
        </h1>
        <p className="text-gray-600 mb-8 md:mb-6">
          Face ID、Touch ID、またはデバイスのロック解除方法を登録します
        </p>

        <div className="mb-8 md:mb-6">
          <div className="bg-[#E8F6FB] rounded-xl p-6 mb-6">
            <svg
              className="w-16 h-16 mx-auto text-[#5EC8E8] mb-4"
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
            <p className="text-sm text-center text-gray-600">
              パスキーを使うと、指紋認証や顔認証で素早く安全にロック解除できます
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onRegister()}
            disabled={busy}
            className="w-full py-4 px-4 rounded-xl bg-[#5EC8E8] text-white active:bg-[#4AB8D8] md:hover:bg-[#4AB8D8] transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2 min-h-[56px]"
          >
            {busy ? (
              <>
                <Spinner />
                登録中...
              </>
            ) : (
              "パスキーを登録"
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
