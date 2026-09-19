"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  getFirebaseAuth,
  getDb,
  googleProvider,
  initAppCheckIfNeeded,
} from "./firebase";
import { ALLOWED_EMAIL, type UserSettings } from "./types";
import {
  authenticateWithPasskey,
  hasPasskeyRegistered,
  isPasskeyAvailable,
  registerPasskey as registerPasskeyFn,
  removePasskey as removePasskeyFn,
} from "./passkey";
import {
  logDeniedEmail,
  logGoogleSuccess,
  logPasskeyResult,
} from "./auditLog";

const AUTO_LOCK_MS = 60 * 60 * 1000; // 1 hour

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  denied: boolean;
  settings: UserSettings;
  unlocked: boolean;
  hasPasskey: boolean;
  passkeyAvailable: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  setLocationEnabled: (enabled: boolean) => Promise<void>;
  refreshSettings: () => Promise<void>;
  unlockWithPasskey: () => Promise<boolean>;
  registerPasskey: () => Promise<void>;
  removePasskey: () => Promise<void>;
  lockApp: () => void;
  setUnlocked: (unlocked: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    locationEnabled: true,
  });

  useEffect(() => {
    void (async () => {
      setPasskeyAvailable(await isPasskeyAvailable());
    })();
  }, []);

  useEffect(() => {
    if (!unlocked) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastActivity = Date.now();

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setUnlocked(false);
      }, ms);
    };

    const onActivity = () => {
      if (document.hidden) return;
      lastActivity = Date.now();
      schedule(AUTO_LOCK_MS);
    };

    const events = ["mousedown", "touchstart", "keydown", "scroll"] as const;
    events.forEach((ev) => {
      document.addEventListener(ev, onActivity, { passive: true });
    });

    const onVisibility = () => {
      if (document.hidden) return;
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= AUTO_LOCK_MS) {
        setUnlocked(false);
      } else {
        schedule(AUTO_LOCK_MS - elapsed);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    schedule(AUTO_LOCK_MS);

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => {
        document.removeEventListener(ev, onActivity);
      });
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [unlocked]);

  useEffect(() => {
    initAppCheckIfNeeded();
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUnlocked(false);

      if (u && u.email !== ALLOWED_EMAIL) {
        await logDeniedEmail(u.email || "unknown");
        setDenied(true);
        setUser(null);
        setHasPasskey(false);
        setLoading(false);
        try {
          await signOut(auth);
        } catch {
          /* ignore */
        }
        return;
      }

      if (u) {
        await logGoogleSuccess(u.email || "", u.uid);
        setDenied(false);
        setUser(u);
        setHasPasskey(await hasPasskeyRegistered(u.uid));

        try {
          const snap = await getDoc(doc(getDb(), "users", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            setSettings({
              locationEnabled: data.settings?.locationEnabled !== false,
            });
          } else {
            await setDoc(
              doc(getDb(), "users", u.uid),
              {
                email: u.email,
                displayName: u.displayName,
                settings: { locationEnabled: true },
                createdAt: Date.now(),
              },
              { merge: true }
            );
          }
        } catch (err) {
          console.warn("Failed to load user settings:", err);
        }
      } else {
        setDenied(false);
        setUser(null);
        setHasPasskey(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setDenied(false);
    const auth = getFirebaseAuth();
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user.email !== ALLOWED_EMAIL) {
      setDenied(true);
      await signOut(auth);
      throw new Error("このアカウントはこの日記を使用する権限がありません。");
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setUnlocked(false);
    await signOut(getFirebaseAuth());
    setUser(null);
    setHasPasskey(false);
  }, []);

  const refreshSettings = useCallback(async () => {
    if (!user) return;
    const snap = await getDoc(doc(getDb(), "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      setSettings({
        locationEnabled: data.settings?.locationEnabled !== false,
      });
    }
  }, [user]);

  const setLocationEnabled = useCallback(
    async (enabled: boolean) => {
      if (!user) return;
      await setDoc(
        doc(getDb(), "users", user.uid),
        { settings: { locationEnabled: enabled } },
        { merge: true }
      );
      setSettings({ locationEnabled: enabled });
    },
    [user]
  );

  const unlockWithPasskey = useCallback(async () => {
    if (!user) return false;
    try {
      const ok = await authenticateWithPasskey(user.uid);
      if (ok) {
        setUnlocked(true);
        await logPasskeyResult(true, user.uid, user.email || "");
      } else {
        await logPasskeyResult(
          false,
          user.uid,
          user.email || "",
          "passkey_failed"
        );
      }
      return ok;
    } catch (err) {
      console.error("Passkey unlock error:", err);
      const reason =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "user_cancelled"
          : "passkey_failed";
      await logPasskeyResult(false, user.uid, user.email || "", reason);
      return false;
    }
  }, [user]);

  const registerPasskey = useCallback(async () => {
    if (!user) return;
    try {
      await registerPasskeyFn(user.uid, user.email || "");
      setHasPasskey(true);
      await logPasskeyResult(true, user.uid, user.email || "");
    } catch (err) {
      const reason =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "user_cancelled"
          : "passkey_failed";
      await logPasskeyResult(false, user.uid, user.email || "", reason);
      throw err;
    }
  }, [user]);

  const removePasskey = useCallback(async () => {
    if (!user) return;
    await removePasskeyFn(user.uid);
    setHasPasskey(false);
  }, [user]);

  const lockApp = useCallback(() => {
    setUnlocked(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      denied,
      settings,
      unlocked,
      hasPasskey,
      passkeyAvailable,
      signInWithGoogle,
      signOutUser,
      setLocationEnabled,
      refreshSettings,
      unlockWithPasskey,
      registerPasskey,
      removePasskey,
      lockApp,
      setUnlocked,
    }),
    [
      user,
      loading,
      denied,
      settings,
      unlocked,
      hasPasskey,
      passkeyAvailable,
      signInWithGoogle,
      signOutUser,
      setLocationEnabled,
      refreshSettings,
      unlockWithPasskey,
      registerPasskey,
      removePasskey,
      lockApp,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
