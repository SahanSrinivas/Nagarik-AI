import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "NagarikAI",
  description: "Hyperlocal civic problem solver — multi-agent AI + MILP optimization.",
};

const NAV = [
  { href: "/report", label: "Report" },
  { href: "/map", label: "Map" },
  { href: "/agents", label: "Agents" },
  { href: "/milp", label: "Optimizer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/impact", label: "Impact" },
  { href: "/chain", label: "Chain" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-brand">
              NagarikAI
            </Link>
            <nav className="flex gap-5 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-zinc-600 hover:text-brand">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
