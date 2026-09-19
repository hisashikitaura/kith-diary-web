"use client";

import { AuthProvider } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default function HomePage() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
