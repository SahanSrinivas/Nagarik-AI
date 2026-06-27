"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BookOpen,
  Camera,
  FileCode2,
  FlaskConical,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map,
  Menu,
  Star,
  Trophy,
  Truck,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  { href: "/test-photos",   label: "Test",         icon: FlaskConical },
  { href: "/architecture",  label: "Architecture", icon: FileCode2 },
];

export function NavBar() {
  const { me, token, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);              // user dropdown
  const [mobileOpen, setMobileOpen] = useState(false);  // hamburger drawer
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

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

  // Close the hamburger when navigating to a new route (pathname change).
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Body scroll lock when the hamburger drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop public nav — visible at lg (1024px+). Below lg we show the
          hamburger button (right side) which opens a slide-down drawer. The
          old md breakpoint pushed Sign In below on iPad-width screens. */}
      <nav className="hidden gap-1 lg:flex">
        {PUBLIC_NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[15px] transition ${
                active ? "nav-active" : "hover:bg-surface-hover"
              }`}
              style={{
                color: active ? "rgb(var(--accent))" : "rgb(var(--text-secondary))",
                fontWeight: active ? 600 : undefined,
              }}
            >
              <n.icon className={`h-4 w-4 transition ${active ? "" : "group-hover:text-accent"}`}
                strokeWidth={active ? 2.5 : 2.25} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* Right-side cluster — auth pill + hamburger toggle (mobile) */}
      <div className="flex items-center gap-2">
        {!token || !me ? (
          <Link
            href="/login"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white"
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
                {me.is_verifier && (me.xp ?? 0) >= 250 && (
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
                    {me.is_verifier && (me.xp ?? 0) >= 250 ? (
                      <span
                        title="Verifier tier reached — you can confirm reports near your home"
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ background: "rgba(245, 158, 11, 0.18)", color: "#b45309" }}
                      >
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        Verifier
                      </span>
                    ) : me.is_verifier ? (
                      <span
                        title={`${250 - (me.xp ?? 0)} XP to verifier tier`}
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{
                          background: "rgb(var(--bg-surface-hover))",
                          color: "rgb(var(--text-muted))",
                        }}
                      >
                        <Star className="h-3 w-3" />
                        {Math.max(0, 250 - (me.xp ?? 0))} XP
                      </span>
                    ) : null}
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

        {/* Hamburger — visible below lg (mobile + iPad). Opens a slide-down
            drawer that lists the same PUBLIC_NAV items vertically. */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg lg:hidden"
          style={{
            background: "rgb(var(--bg-surface))",
            border: "1px solid rgb(var(--border-color))",
            color: "rgb(var(--text-primary))",
          }}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer — full-height side sheet from the right.
          Animates in via framer-motion; tapping the backdrop closes it. */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 lg:hidden"
              style={{ background: "rgba(0, 0, 0, 0.45)" }}
            />
            <motion.aside
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 z-50 flex h-dvh w-[82vw] max-w-sm flex-col gap-2 overflow-y-auto p-4 lg:hidden"
              style={{
                background: "rgb(var(--bg-canvas))",
                borderLeft: "1px solid rgb(var(--border-color))",
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "rgb(var(--text-muted))" }}>
                  Menu
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="grid h-9 w-9 place-items-center rounded-lg"
                  style={{
                    background: "rgb(var(--bg-surface))",
                    border: "1px solid rgb(var(--border-color))",
                    color: "rgb(var(--text-primary))",
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {PUBLIC_NAV.map((n) => {
                const active = isActive(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition"
                    style={{
                      background: active ? "rgba(191, 79, 54, 0.12)" : "rgb(var(--bg-surface))",
                      border: "1px solid rgb(var(--border-light))",
                      color: active ? "rgb(var(--accent))" : "rgb(var(--text-primary))",
                    }}
                  >
                    <n.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    {n.label}
                  </Link>
                );
              })}
              {token && me && (
                <Link
                  href="/home"
                  className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-white"
                  style={{ background: "rgb(var(--accent))" }}
                >
                  <Activity className="h-5 w-5" /> My Dashboard
                </Link>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Legacy MobileNavBar — kept as a no-op export so any stale import doesn't
 * break the build. Hamburger inside NavBar handles mobile nav now.
 */
export function MobileNavBar() {
  return null;
}
