import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "./firebase";

function rpId(): string {
  return window.location.hostname;
}

/** ArrayBuffer → base64 (atob/btoa style, matching production) */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** base64 → ArrayBuffer */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function isPasskeyAvailable(): Promise<boolean> {
  return !!(
    typeof window !== "undefined" &&
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === "function"
  );
}

export async function hasPasskeyRegistered(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(getDb(), "users", uid));
    return snap.exists() && !!snap.data()?.passkeyCredentialId;
  } catch (err) {
    console.error("Error checking passkey:", err);
    return false;
  }
}

export async function registerPasskey(
  uid: string,
  email: string
): Promise<boolean> {
  if (!(await isPasskeyAvailable())) {
    throw new Error("Passkeys are not supported on this device");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = new TextEncoder().encode(uid);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Kith Diary", id: rpId() },
      user: {
        id: userId,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: false,
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Failed to create credential");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = response.getPublicKey();
  if (!publicKey) {
    throw new Error("Failed to get public key from credential");
  }

  await setDoc(
    doc(getDb(), "users", uid),
    {
      passkeyCredentialId: bufferToBase64(credential.rawId),
      passkeyPublicKey: bufferToBase64(publicKey),
    },
    { merge: true }
  );

  return true;
}

/**
 * Client-side unlock via WebAuthn get.
 * Returns false on auth failure; rethrows NotAllowedError (user cancel)
 * so callers can log user_cancelled.
 */
export async function authenticateWithPasskey(uid: string): Promise<boolean> {
  if (!(await isPasskeyAvailable())) {
    throw new Error("Passkeys are not supported on this device");
  }

  const snap = await getDoc(doc(getDb(), "users", uid));
  if (!snap.exists() || !snap.data()?.passkeyCredentialId) {
    throw new Error("No passkey registered");
  }

  const credentialId = snap.data()!.passkeyCredentialId as string;
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: rpId(),
        allowCredentials: [
          {
            id: base64ToBuffer(credentialId),
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch (err) {
    console.error("Passkey authentication error:", err);
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      throw err;
    }
    return false;
  }
}

export async function removePasskey(uid: string): Promise<void> {
  await setDoc(
    doc(getDb(), "users", uid),
    { passkeyCredentialId: null, passkeyPublicKey: null },
    { merge: true }
  );
}
