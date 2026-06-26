import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Camera,
  FileCode2,
  LayoutDashboard,
  Link2,
  Map,
  Network,
  Trophy,
  Truck,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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

// Marketing-friendly top nav. Operator/builder pages (/agents, /milp,
// /chain, /ops, /test-photos) are still reachable — they're linked from
// /architecture and from the report-success page. The marketing visitor
// sees only the things they care about.
const NAV = [
  { href: "/report",        label: "Report",         icon: Camera },
  { href: "/map",           label: "Map",            icon: Map },
  { href: "/dashboard",     label: "Ward Dashboard", icon: LayoutDashboard },
  { href: "/crew",          label: "Crew",           icon: Truck },
  { href: "/impact",        label: "Impact",         icon: Trophy },
  { href: "/architecture",  label: "Architecture",   icon: FileCode2 },
];

// Tracking + wallet routes are linked from contextual surfaces (report
// success page, leaderboard cards) rather than the top nav.

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
              <nav className="hidden gap-1 md:flex">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="group flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition hover:bg-surface-hover"
                    style={{ color: "rgb(var(--text-secondary))" }}
                  >
                    <n.icon className="h-4 w-4 transition group-hover:text-accent" strokeWidth={2.25} />
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
                <div className="md:hidden">
                  <MobileNav />
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

function MobileNav() {
  // Minimal — collapses NAV into a horizontally scrolling pill bar.
  return (
    <div className="flex max-w-[60vw] gap-1 overflow-x-auto">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className="rounded-full bg-ink-100 px-3 py-1.5 text-xs text-ink-700"
        >
          {n.label}
        </Link>
      ))}
    </div>
  );
}
