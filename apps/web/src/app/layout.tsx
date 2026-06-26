import type { Metadata } from "next";
import Link from "next/link";

import { Brand } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MobileNavBar, NavBar } from "@/components/NavBar";
import { THEME_BOOT_SCRIPT, ThemeToggle } from "@/components/ThemeToggle";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "NagarikAI — Hyperlocal Civic Problem Solver",
  description:
    "Multi-agent AI + MILP optimization for hyperlocal civic issues. Citizens report, 7 agents triage, an optimizer dispatches, a chain proves it.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
};

// The nav itself lives in <NavBar /> (client component) because it
// needs useAuth to render the 'My Dashboard' entry and user menu
// conditionally for signed-in citizens.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set .dark BEFORE first paint to prevent theme FOUC. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* Neutra Text Alt — same font family as srinivassahankolluri.com.
            Loading via <link> rather than CSS @import because Tailwind's
            PostCSS pipeline silently dropped the @import after @tailwind. */}
        <link
          rel="stylesheet"
          href="https://fonts.cdnfonts.com/css/neutra-text-alt"
        />
      </head>
      <body className="font-sans">
        <Providers>
          <header
            className="sticky top-0 z-40 border-b backdrop-blur-xl"
            style={{
              borderColor: "rgb(var(--border-light))",
              backgroundColor: "rgb(var(--bg-canvas) / 0.72)",
            }}
          >
            <div className="container flex h-16 items-center justify-between gap-3">
              <Link href="/" aria-label="NagarikAI home">
                <Brand />
              </Link>
              <NavBar />
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
                <div className="md:hidden">
                  <MobileNavBar />
                </div>
              </div>
            </div>
          </header>
          <main className="container py-8 md:py-12">{children}</main>
          <footer
            className="border-t py-8 text-center text-xs"
            style={{
              borderColor: "rgb(var(--border-light))",
              color: "rgb(var(--text-muted))",
              backgroundColor: "rgb(var(--bg-surface) / 0.5)",
            }}
          >
            NagarikAI · multi-agent civic OS for hyperlocal India · {new Date().getFullYear()}
          </footer>
        </Providers>
      </body>
    </html>
  );
}
