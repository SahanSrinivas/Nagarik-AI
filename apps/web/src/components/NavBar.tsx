"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  Camera,
  FileCode2,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map,
  Star,
  Trophy,
  Truck,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";

const PUBLIC_NAV = [
  { href: "/report",        label: "Report",       icon: Camera },
  { href: "/map",           label: "Map",          icon: Map },
  { href: "/dashboard",     label: "Wards",        icon: LayoutDashboard },
  { href: "/crew",          label: "Crew",         icon: Truck },
  { href: "/milp",          label: "Schedule",     icon: Activity },
  { href: "/impact",        label: "Veer",         icon: Trophy },
  { href: "/references",    label: "Datasets",     icon: BookOpen },
  { href: "/architecture",  label: "Architecture", icon: FileCode2 },
];

export function NavBar() {
  const { me, token, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the user menu when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <>
      {/* Desktop public nav — whitespace-nowrap on each link so labels can never wrap.
          The "My Dashboard" entry used to live here too but it caused the header
          to overflow when signed in. It's still reachable from the user avatar
          dropdown on the right, plus the avatar gets a "Go to dashboard" tooltip. */}
      <nav className="hidden gap-1 md:flex">
        {PUBLIC_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="group flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[15px] transition hover:bg-surface-hover"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            <n.icon className="h-4 w-4 transition group-hover:text-accent" strokeWidth={2.25} />
            {n.label}
          </Link>
        ))}
      </nav>

      {/* Right-side auth pill — sign in OR user menu */}
      {!token || !me ? (
        <Link
          href="/login"
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white"
          style={{ background: "rgb(var(--accent))" }}
        >
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
      ) : (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition"
            style={{
              background: "rgb(var(--bg-surface))",
              border: "1px solid rgb(var(--border-color))",
              color: "rgb(var(--text-primary))",
            }}
            aria-label="User menu — opens dashboard, wallet, sign out"
            title="My Dashboard · wallet · sign out"
          >
            <span
              className="relative grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: "rgb(var(--accent))" }}
            >
              {(me.name ?? me.username ?? "?")[0].toUpperCase()}
              {me.is_verifier && (
                <Star
                  className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 fill-amber-400 text-amber-500"
                  strokeWidth={2}
                  aria-label="Verifier"
                />
              )}
            </span>
            <span className="hidden font-mono sm:inline">{me.xp} XP</span>
          </button>

          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-xl border shadow-lift"
              style={{
                background: "rgb(var(--bg-surface))",
                borderColor: "rgb(var(--border-color))",
              }}
            >
              <div className="border-b px-3 py-2.5"
                   style={{ borderColor: "rgb(var(--border-light))" }}>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {me.name ?? me.username}
                  {me.is_verifier && (
                    <span
                      title="You're a verifier — you can confirm reports near your home"
                      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                      style={{ background: "rgba(245, 158, 11, 0.15)", color: "#b45309" }}
                    >
                      <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                      Verifier
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                  @{me.username} · {me.xp} XP
                </div>
              </div>
              <Link
                href="/home"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-hover"
              >
                <Activity className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
                My Dashboard
              </Link>
              <Link
                href="/report"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-hover"
              >
                <Camera className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
                Report an issue
              </Link>
              <Link
                href={`/wallet/${me.id}`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-hover"
              >
                <User className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
                My wallet + badges
              </Link>
              <button
                onClick={() => {
                  logout();
                  setOpen(false);
                  router.replace("/");
                }}
                className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm transition hover:bg-surface-hover"
                style={{ borderColor: "rgb(var(--border-light))", color: "#f43f5e" }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </motion.div>
          )}
        </div>
      )}
    </>
  );
}

/** Mobile nav — horizontal scroll of pills. Same items as desktop. */
export function MobileNavBar() {
  const { token } = useAuth();
  return (
    <div className="flex max-w-[60vw] gap-1 overflow-x-auto md:hidden">
      {PUBLIC_NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className="whitespace-nowrap rounded-full bg-ink-100 px-3 py-1.5 text-xs text-ink-700"
        >
          {n.label}
        </Link>
      ))}
      {token && (
        <Link href="/home" className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "rgb(var(--accent))" }}>
          Dashboard
        </Link>
      )}
    </div>
  );
}
