"use client";

import type { ReactNode } from "react";

import { I18nProvider } from "@/i18n";

/**
 * Client-side context wrapper. layout.tsx stays a Server Component
 * (so Next.js can still emit static metadata + RSC), and we hoist the
 * client-only providers into this file.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
