import { addDoc, collection } from "firebase/firestore";
import { getDb } from "./firebase";

export type AuditResult = "success" | "failure";

export interface AuditLogExtra {
  email?: string;
  uid?: string;
  reason?: string;
}

export async function writeAuditLog(
  result: AuditResult,
  method: string,
  extra: AuditLogExtra = {}
): Promise<void> {
  try {
    const at = Date.now();
    await addDoc(collection(getDb(), "auditLogs"), {
      result,
      method,
      at,
      atISO: new Date(at).toISOString(),
      userAgent:
        typeof navigator !== "undefined"
          ? navigator.userAgent.slice(0, 200)
          : "unknown",
      ...extra,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export async function logGoogleSuccess(
  email: string,
  uid: string
): Promise<void> {
  await writeAuditLog("success", "google", { email, uid });
}

export async function logDeniedEmail(email: string): Promise<void> {
  await writeAuditLog("failure", "denied_email", {
    email,
    reason: "email_not_allowed",
  });
}

export async function logPasskeyResult(
  success: boolean,
  uid: string,
  email: string,
  reason?: string
): Promise<void> {
  await writeAuditLog(success ? "success" : "failure", "passkey", {
    uid,
    email,
    reason,
  });
}

export function methodLabel(method: string): string {
  switch (method) {
    case "google":
      return "Google";
    case "pin":
      return "PIN";
    case "passkey":
      return "パスキー";
    case "denied_email":
      return "メール拒否";
    default:
      return method;
  }
}

export function reasonLabel(reason?: string): string {
  if (!reason) return "";
  switch (reason) {
    case "wrong_pin":
      return "PIN誤り";
    case "locked_out":
      return "ロックアウト";
    case "email_not_allowed":
      return "メール許可なし";
    case "passkey_failed":
      return "パスキー失敗";
    case "user_cancelled":
      return "キャンセル";
    default:
      return reason;
  }
}

export function formatAuditAt(at: number): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const h = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}:${s}`;
}
