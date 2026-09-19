"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { getDb } from "@/lib/firebase";
import {
  formatAuditAt,
  methodLabel,
  reasonLabel,
} from "@/lib/auditLog";

interface Props {
  onBack: () => void;
}

interface AuditRow {
  id: string;
  result: "success" | "failure";
  method: string;
  at: number;
  email?: string;
  uid?: string;
  reason?: string;
  ip?: string;
}

function SecurityLogSection() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(getDb(), "auditLogs"),
        orderBy("at", "desc"),
        limit(5)
      );
      const snap = await getDocs(q);
      setLogs(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditRow, "id">) }))
      );
    } catch (err) {
      console.error("Error loading audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 text-sm">読み込み中...</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 text-sm">まだ記録がありません</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`p-3 rounded-lg mb-2 border ${
              log.result === "failure"
                ? "bg-red-50 border-red-200"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    log.result === "success"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {log.result === "success" ? "成功" : "失敗"}
                </span>
                <span className="text-xs font-medium text-gray-700">
                  {methodLabel(log.method)}
                </span>
                {log.reason ? (
                  <span className="text-xs text-gray-600">
                    ({reasonLabel(log.reason)})
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {formatAuditAt(log.at)}
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              {log.email ? (
                <div>
                  <span className="font-medium">メール:</span> {log.email}
                </div>
              ) : null}
              {log.ip ? (
                <div>
                  <span className="font-medium">IP:</span> {log.ip}
                </div>
              ) : null}
              {log.uid ? (
                <div className="truncate">
                  <span className="font-medium">UID:</span>{" "}
                  {log.uid.substring(0, 20)}...
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-500 text-center pt-1">最新5件を表示</div>
    </div>
  );
}

export function SettingsPanel({ onBack }: Props) {
  const {
    user,
    signOutUser,
    settings,
    setLocationEnabled,
    hasPasskey,
    registerPasskey,
    removePasskey,
    lockApp,
  } = useAuth();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
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

  const onRegisterPasskey = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await registerPasskey();
      setMsg({ type: "success", text: "パスキーを登録しました" });
    } catch (e) {
      console.error("Passkey registration error:", e);
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setMsg({ type: "error", text: "登録がキャンセルされました" });
      } else {
        setMsg({ type: "error", text: "パスキーの登録に失敗しました" });
      }
    } finally {
      setBusy(false);
    }
  };

  const onRemovePasskey = async () => {
    if (!window.confirm("パスキーを削除してもよろしいですか？")) return;
    setBusy(true);
    setMsg(null);
    try {
      await removePasskey();
      setMsg({ type: "success", text: "パスキーを削除しました" });
    } catch (e) {
      console.error("Passkey removal error:", e);
      setMsg({ type: "error", text: "パスキーの削除に失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  const onLock = () => {
    lockApp();
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

        <div>
          <h3 className="text-sm font-bold text-[#1A3A4A] mb-2">パスキー</h3>
          {hasPasskey ? (
            <button
              type="button"
              onClick={() => void onRemovePasskey()}
              disabled={busy}
              className="w-full py-3 px-4 rounded-lg border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors text-sm text-left flex items-center justify-between disabled:opacity-50 min-h-[44px]"
            >
              <span>パスキーを削除</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onRegisterPasskey()}
              disabled={busy}
              className="w-full py-3 px-4 rounded-lg border-2 border-[#5EC8E8] text-[#5EC8E8] hover:bg-[#E8F6FB] transition-colors text-sm text-left flex items-center justify-between disabled:opacity-50 min-h-[44px]"
            >
              <span>パスキーを登録</span>
              <svg
                className="w-5 h-5"
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
            </button>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-[#1A3A4A] mb-2">位置情報</h3>
          <button
            type="button"
            onClick={() => void toggleLocation()}
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
        </div>

        {msg ? (
          <p
            className={`text-sm ${
              msg.type === "success" ? "text-green-700" : "text-red-600"
            }`}
          >
            {msg.text}
          </p>
        ) : null}

        <div>
          <h3 className="text-sm font-bold text-[#1A3A4A] mb-2">アカウント</h3>
          {hasPasskey ? (
            <button
              type="button"
              onClick={onLock}
              className="w-full mb-2 py-3 px-4 rounded-lg border-2 border-[#5EC8E8] text-[#5EC8E8] hover:bg-[#E8F6FB] active:bg-[#E8F6FB] transition-colors text-sm text-left flex items-center justify-between min-h-[44px]"
            >
              <span>ロック画面に戻る</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="w-full py-3 px-4 rounded-lg bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors text-sm text-left flex items-center justify-between min-h-[44px]"
          >
            <span>サインアウト</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>

        <div>
          <h3 className="text-sm font-bold text-[#1A3A4A] mb-2">
            セキュリティログ
          </h3>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <SecurityLogSection />
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center pt-4">
          Kith Diary · Firebase project kith-diary
        </p>
      </div>
    </div>
  );
}
