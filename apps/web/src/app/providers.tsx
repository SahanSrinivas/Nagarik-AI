"use client";

import type { ReactNode } from "react";

import { I18nProvider } from "@/i18n";
import { AuthProvider } from "@/lib/auth";

/**
 * Client-side context wrapper. layout.tsx stays a Server Component
 * (so Next.js can still emit static metadata + RSC), and we hoist the
 * client-only providers into this file.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <I18nProvider>{children}</I18nProvider>
    </AuthProvider>
  );
}
