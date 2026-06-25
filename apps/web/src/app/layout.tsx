import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Camera,
  LayoutDashboard,
  Link2,
  Map,
  Network,
  Trophy,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "NagarikAI — Hyperlocal Civic Problem Solver",
  description:
    "Multi-agent AI + MILP optimization for hyperlocal civic issues. Citizens report, 7 agents triage, an optimizer dispatches, a chain proves it.",
};

const NAV = [
  { href: "/report",    label: "Report",    icon: Camera },
  { href: "/map",       label: "Map",       icon: Map },
  { href: "/agents",    label: "Agents",    icon: Network },
  { href: "/milp",      label: "Optimizer", icon: Activity },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/impact",    label: "Impact",    icon: Trophy },
  { href: "/chain",     label: "Chain",     icon: Link2 },
];

// Tracking + wallet routes are linked from contextual surfaces (report
// success page, leaderboard cards) rather than the top nav.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans">
        <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-white/70 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" aria-label="NagarikAI home">
              <Brand />
            </Link>
            <nav className="hidden gap-1 md:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="group flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
                >
                  <n.icon className="h-4 w-4 text-ink-400 transition group-hover:text-brand-600" strokeWidth={2.25} />
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="md:hidden">
              <MobileNav />
            </div>
          </div>
        </header>
        <main className="container py-8 md:py-12">{children}</main>
        <footer className="border-t border-ink-200/60 bg-white/70 py-8 text-center text-xs text-ink-500">
          NagarikAI · multi-agent civic OS for hyperlocal India · {new Date().getFullYear()}
        </footer>
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
