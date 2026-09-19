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

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  denied: boolean;
  settings: UserSettings;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  setLocationEnabled: (enabled: boolean) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    locationEnabled: true,
  });

  useEffect(() => {
    initAppCheckIfNeeded();
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && u.email !== ALLOWED_EMAIL) {
        setDenied(true);
        setUser(null);
        try {
          await signOut(auth);
        } catch {
          /* ignore */
        }
        setLoading(false);
        return;
      }
      setDenied(false);
      setUser(u);
      setLoading(false);
      if (u) {
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
      }
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
    await signOut(getFirebaseAuth());
    setUser(null);
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

  const value = useMemo(
    () => ({
      user,
      loading,
      denied,
      settings,
      signInWithGoogle,
      signOutUser,
      setLocationEnabled,
      refreshSettings,
    }),
    [
      user,
      loading,
      denied,
      settings,
      signInWithGoogle,
      signOutUser,
      setLocationEnabled,
      refreshSettings,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
