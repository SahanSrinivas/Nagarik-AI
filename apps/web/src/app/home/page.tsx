"use client";

import { motion } from "framer-motion";
import { Activity, Award, ArrowRight, Camera, Eye, ListChecks, LogOut, Star, Trophy, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill, StatusPill } from "@/components/Pill";
import { authedFetch, useAuth } from "@/lib/auth";

interface MyIssue {
  id: string;
  type: string;
  status: string;
  ward: string | null;
  address: string | null;
  created_at: string;
  before_photo_url?: string | null;
  before_video_url?: string | null;
}

const NEXT_TIERS = [
  { xp: 100,  tier: "Reporter" },
  { xp: 250,  tier: "Verifier" },
  { xp: 500,  tier: "Watchdog" },
  { xp: 1000, tier: "Sentinel" },
  { xp: 2500, tier: "Civic Hero" },
];

export default function HomePage() {
  const router = useRouter();
  const { me, token, logout, refresh } = useAuth();
  const [mine, setMine] = useState<MyIssue[]>([]);

  useEffect(() => {
    // Bounce to login if not signed in (after auth bootstrap settles).
    if (!token) {
      const t = setTimeout(() => { if (!token) router.replace("/login"); }, 200);
      return () => clearTimeout(t);
    }
    refresh();
    authedFetch("/issues/mine")
      .then((r) => r.ok ? r.json() : [])
      .then(setMine)
      .catch(() => setMine([]));
  }, [token, router, refresh]);

  if (!me) {
    return <div className="card animate-pulse p-6 text-sm text-ink-500">Loading your profile…</div>;
  }

  const xp = me.xp ?? 0;
  const nextTier = NEXT_TIERS.find((t) => t.xp > xp);
  const progress = nextTier ? Math.min(100, Math.round((xp / nextTier.xp) * 100)) : 100;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Welcome */}
      <header className="card overflow-hidden">
        <div className="bg-hero-gradient p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-brand-200">Welcome back</div>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                {me.name ?? me.username}
                {me.is_verifier && xp >= 250 ? (
                  <span
                    title="Verifier tier reached — you can confirm reports near your home"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200"
                  >
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Verifier
                  </span>
                ) : me.is_verifier ? (
                  <span
                    title={`Verifier-eligible — needs ${250 - xp} more XP to unlock`}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/70"
                  >
                    <Star className="h-3.5 w-3.5 text-white/50" /> {250 - xp} XP to verifier
                  </span>
                ) : null}
              </h1>
              <div className="mt-1 text-xs font-mono text-ink-300">@{me.username}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold text-brand-300">
                <Counter to={xp} suffix=" XP" />
              </div>
              {me.badge && <Pill tone="brand" className="mt-1">{me.badge}</Pill>}
            </div>
          </div>
          {nextTier && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-ink-300">
                <span>Next tier: <strong className="text-white">{nextTier.tier}</strong></span>
                <span className="font-mono">{xp} / {nextTier.xp}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-brand-400" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* The 3 simple actions */}
      <Stagger step={0.06} className="grid gap-3 sm:grid-cols-3">
        <Reveal>
          <Link href="/report" className="card-glow block h-full p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-white">
              <Camera className="h-5 w-5" />
            </div>
            <div className="mt-3 text-base font-semibold">Report an issue</div>
            <div className="mt-1 text-sm text-ink-600">
              Snap a photo or video + drop your location. AI does the rest.
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs text-brand-700">
              Start <ArrowRight className="h-3 w-3" />
            </div>
          </Link>
        </Reveal>
        <Reveal>
          <a href="#my-reports" className="card-glow block h-full p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-white">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="mt-3 text-base font-semibold">Track your reports</div>
            <div className="mt-1 text-sm text-ink-600">
              {mine.length === 0 ? "No reports yet — submit one to get started." : `${mine.length} active · live status`}
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs text-brand-700">
              View <ArrowRight className="h-3 w-3" />
            </div>
          </a>
        </Reveal>
        <Reveal>
          <Link href="/impact" className="card-glow block h-full p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-white">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="mt-3 text-base font-semibold">Earn XP &amp; badges</div>
            <div className="mt-1 text-sm text-ink-600">
              +5 per submit · +5 per verification · +10 per resolved fix.
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs text-brand-700">
              Leaderboard <ArrowRight className="h-3 w-3" />
            </div>
          </Link>
        </Reveal>
      </Stagger>

      {/* My reports list */}
      <section id="my-reports" className="space-y-3">
        <h2 className="text-base font-semibold" style={{ color: "rgb(var(--text-primary))" }}>My recent reports</h2>
        {mine.length === 0 ? (
          <div className="card p-6 text-center text-base"
            style={{ color: "rgb(var(--text-secondary))" }}>
            <Award className="mx-auto mb-2 h-6 w-6 text-brand-600" />
            No reports yet. Tap &ldquo;Report an issue&rdquo; above to start earning XP.
          </div>
        ) : (
          <div className="space-y-2.5">
            {mine.slice(0, 20).map((i) => (
              <div key={i.id} className="rounded-xl p-4 text-sm shadow-sm transition hover:shadow-md"
                style={{
                  background: "rgb(var(--bg-surface))",
                  border: "1px solid rgb(var(--border-color))",
                  color: "rgb(var(--text-primary))",
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate text-base font-semibold"
                        style={{ color: "rgb(var(--text-primary))" }}>
                        {i.address ?? prettify(i.type)}
                      </div>
                      {i.before_video_url && (
                        <span title="Video evidence"
                          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ background: "rgba(191, 79, 54, 0.10)", color: "rgb(var(--accent))" }}>
                          <Video className="mr-0.5 h-3 w-3" /> Video
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                      {i.ward ?? "—"} · {new Date(i.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST
                    </div>
                  </div>
                  <StatusPill value={i.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/tracking/${i.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                    style={{ background: "rgb(var(--accent))" }}
                  >
                    <Activity className="h-3.5 w-3.5" /> Live track
                  </Link>
                  <Link
                    href={`/agents?issue=${i.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
                    style={{
                      background: "rgb(var(--bg-surface-hover))",
                      border: "1px solid rgb(var(--border-color))",
                      color: "rgb(var(--text-primary))",
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" /> Watch agents
                  </Link>
                  <span className="ml-auto self-center font-mono text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                    {i.id.slice(0, 8)}…
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2 text-xs text-ink-500">
        <Link href="/architecture" className="underline">For builders → /architecture</Link>
        <button onClick={() => { logout(); router.replace("/login"); }} className="btn-ghost text-xs">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </motion.div>
  );
}

function prettify(t: string): string {
  return ({ pothole: "Pothole", garbage: "Garbage", streetlight: "Streetlight",
            water_leak: "Water leak", sewage: "Sewage", tree_fall: "Fallen tree",
            encroachment: "Encroachment", other: "Civic issue" } as Record<string,string>)[t] || t;
}
