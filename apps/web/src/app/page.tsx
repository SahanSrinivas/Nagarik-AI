"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Award,
  Brain,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  Cpu,
  Droplet,
  Eye,
  GitBranch,
  HandCoins,
  Hammer,
  Languages,
  Lightbulb,
  Lock,
  LogIn,
  Mail,
  Map,
  Medal,
  MessageCircle,
  Mic,
  Construction,
  Receipt,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Shield,
  Shovel,
  Siren,
  Sparkles,
  Star,
  Trash2,
  TreeDeciduous,
  TrendingUp,
  Trophy,
  Truck,
  UserCheck,
  Users,
  Volume2,
  Waves,
  Webhook,
  Wrench,
  Zap,
} from "lucide-react";

import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";
import { useAuth } from "@/lib/auth";

const AGENTS = [
  { icon: Eye,          name: "Vision",       sub: "Gemini classifies photo or video" },
  { icon: GitBranch,    name: "Dedup",        sub: "PostGIS radius · CLIP · Vertex AI text embeddings" },
  { icon: Brain,        name: "Triage",       sub: "LLM routes, gate verifies" },
  { icon: CheckCircle2, name: "Verification", sub: "Citizens confirm" },
  { icon: Cpu,          name: "Scheduler",    sub: "MILP picks the crew + slot" },
  { icon: Wrench,       name: "Resolution",   sub: "CLIP + CNN audit the fix" },
  { icon: TrendingUp,   name: "Insights",     sub: "Predict tomorrow's hotspots" },
];

const STATS = [
  { value: 89.5,   suffix: "%", label: "MILP km reduction on real BBMP data" },
  { value: 17481,  suffix: "",  label: "Real Bengaluru issues already loaded" },
  { value: 16,     suffix: "/16", label: "Prompt-injection attempts caught by the gate" },
  { value: 0.871,  suffix: "",    label: "R² on real rainfall + complaints panel", precise: true },
];

const PROBLEMS = [
  { icon: Camera, k: "Fragmented reporting", v: "BBMP has half a dozen apps and a helpline. Citizens don't know which one to use." },
  { icon: ShieldCheck, k: "Fake closures", v: "Crews mark tickets resolved with a photo of a different street. No one audits." },
  { icon: Zap, k: "Slow + wasteful dispatch", v: "Crews drive 23% more km than they need to. Ambulances overturn in potholes that have been reported for weeks." },
];

// Citizen voices — three real Bengaluru residents we spoke to before
// writing a line of code. Last names redacted with consent.
const CITIZEN_QUOTES = [
  {
    name: "Sravan G.",
    ward: "Marathahalli",
    issue: "Falling trees",
    quote:
      "Every monsoon a tree branch comes down on our lane. Last June it blocked the road for two days — BBMP took 36 hours to even acknowledge the call.",
  },
  {
    name: "Haarika P.",
    ward: "Kalyan Nagar",
    issue: "Repeat potholes",
    quote:
      "They re-tarred the road in March and the same potholes were back in two months. There's no way to flag 'this fix didn't last' on the existing apps — you just file a fresh complaint.",
  },
  {
    name: "Anila K.",
    ward: "Hebbal",
    issue: "Streetlights",
    quote:
      "The streetlight on our side has been out for three weeks. I logged it on BBMP Sahaaya, the BESCOM helpline, and on Twitter. No reply on any of them. I don't even know which one I'm supposed to use.",
  },
];

// Headline stats that frame the "Why this matters" section.
const WHY_STATS = [
  { value: "127k", label: "BBMP complaints / 6 months" },
  { value: "15%",  label: "stay open at any time" },
  { value: "6+",   label: "fragmented apps citizens must navigate" },
];

const SOLUTIONS = [
  { icon: Brain,        k: "AI does the work", v: "Snap a photo or video → Gemini classifies it · Claude routes it · OR-Tools schedules it · CLIP + CNN verify the fix." },
  { icon: ShieldCheck,  k: "Gates keep AI honest", v: "Every LLM output passes through deterministic guardrails. Hallucinations and prompt injections fail closed to the canonical SOP." },
  { icon: TrendingUp,   k: "Closed feedback loop", v: "Citizen sees every status change in real time (in EN / हि / ಕ). XP rewards verified contributions." },
];

/**
 * The actual SOP table from nagarik/agents/guardrails.py — every civic
 * issue type the system handles, the BBMP/BESCOM/BWSSB department it
 * routes to, and the default SLA. Severity ≥ 4 halves the SLA at runtime.
 *
 * If you add a new category in guardrails.SOP_TABLE, mirror it here.
 */
/**
 * The actual XP economy enforced server-side.
 *   +5  per submitted report          — XP_PER_SUBMIT in routes/issues.py
 *   +5  per verification confirmed    — XP_PER_VERIFICATION in routes/verify.py
 *   +10 per verified-resolved fix     — XP_PER_RESOLVED_REPORT in agents/resolution_agent.py
 * Plus tier thresholds from nagarik/chain/badges.MILESTONES.
 */
const XP_ACTIONS = [
  { icon: Camera,       k: "Report an issue",   xp: 5,
    note: "Snap + submit a civic issue. Awarded the moment the report passes the BBMP gate." },
  { icon: UserCheck,    k: "Verify a neighbour's report", xp: 5,
    note: "Confirm a nearby citizen's report from your area. 3 confirmations promote it to VERIFIED." },
  { icon: CheckCircle2, k: "Your report gets fixed",      xp: 10,
    note: "When the ResolutionAgent's CLIP + CNN audit clears the crew's after-photo, the original reporter gets +10." },
];

const BADGE_TIERS = [
  { tier: "Reporter",   xp: 100,  icon: Star,    desc: "First milestone — you've actively engaged with civic issues" },
  { tier: "Verifier",   xp: 250,  icon: UserCheck, desc: "You confirm others' reports too — earning community trust" },
  { tier: "Watchdog",   xp: 500,  icon: Shield,  desc: "Sustained presence — your ward notices when you flag something" },
  { tier: "Sentinel",   xp: 1000, icon: Medal,   desc: "Top-tier civic contributor — featured on the public leaderboard" },
  { tier: "Civic Hero", xp: 2500, icon: Trophy,  desc: "Reserved for the most active citizens — a soulbound NFT on Polygon" },
];

const ROUTING_TAXONOMY = [
  { type: "pothole",       label: "Pothole",         icon: Construction,  dept: "BBMP Roads",         sla: "72h" },
  { type: "garbage",       label: "Garbage / waste",  icon: Trash2,        dept: "BBMP SWM",           sla: "24h" },
  { type: "streetlight",   label: "Streetlight",      icon: Lightbulb,     dept: "BESCOM Streetlight", sla: "48h" },
  { type: "water_leak",    label: "Water leak",       icon: Droplet,       dept: "BWSSB",              sla: "12h" },
  { type: "sewage",        label: "Sewage / manhole", icon: Waves,         dept: "BWSSB",              sla: "24h" },
  { type: "tree_fall",     label: "Fallen tree",      icon: TreeDeciduous, dept: "BBMP Horticulture",  sla: "6h"  },
  { type: "encroachment",  label: "Encroachment",     icon: Shovel,        dept: "BBMP Town Planning", sla: "168h" },
  { type: "other",         label: "Other",            icon: AlertTriangle, dept: "BBMP Helpdesk",      sla: "72h" },
];

export default function MarketingHome() {
  const { me } = useAuth();
  const primaryHref = me ? "/home" : "/login";
  const primaryLabel = me ? "Open your dashboard" : "Sign in to report";

  return (
    <div className="space-y-24">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-gradient px-6 py-20 text-white sm:px-12 sm:py-28">
        <motion.div className="absolute inset-0 bg-mesh"
          initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ duration: 1.4, ease: "easeOut" }} aria-hidden />
        <Stagger className="relative mx-auto max-w-3xl text-center" step={0.08}>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Multi-agent civic OS for hyperlocal India
            </span>
          </Reveal>
          <Reveal>
            <h1 className="mt-6 text-4xl font-semibold tracking-tightest sm:text-6xl">
              Civic issues, solved at{" "}
              <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">city scale</span>.
            </h1>
          </Reveal>
          <Reveal>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-300 sm:text-xl">
              A photo. Seven specialized AI agents. A MILP solver. A public chain.
              One Bengaluru pothole goes from "reported" to "verified-fixed" without
              a helpline, without a 6-step app — and the citizen watches the system
              work, live, in their own language.
            </p>
          </Reveal>
          <Reveal>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={primaryHref} className="btn-primary">
                <LogIn className="h-4 w-4" /> {primaryLabel} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/architecture"
                className="btn border border-white/15 bg-white/5 text-white backdrop-blur hover:bg-white/10">
                For builders → /architecture
              </Link>
            </div>
          </Reveal>

          <Stagger delay={0.3} step={0.08} className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-4 text-center sm:grid-cols-4">
            {STATS.map((s) => (
              <Reveal key={s.label}>
                <motion.div whileHover={{ y: -3 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-2xl font-semibold text-brand-300 sm:text-3xl">
                    {s.precise ? s.value.toFixed(3) : <Counter to={s.value} suffix={s.suffix} />}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-ink-400">{s.label}</div>
                </motion.div>
              </Reveal>
            ))}
          </Stagger>
        </Stagger>
      </section>

      {/* PROBLEM — validated on the ground in Bengaluru */}
      <section className="space-y-10">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{
              background: "rgba(191, 79, 54, 0.10)",
              color: "rgb(var(--accent))",
              border: "1px solid rgba(191, 79, 54, 0.25)",
            }}>
            <Map className="h-3.5 w-3.5" /> Validated on the ground in Bengaluru
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
            The system measures activity, not outcomes.
          </h2>
          <p className="mt-3 text-base text-ink-600 sm:text-lg">
            Citizens have learned to distrust the apps that exist. Crews close tickets without fixing them. NagarikAI rebuilds the loop with verification at the citizen end and CLIP+CNN audit at the crew end.
          </p>
        </header>

        {/* Headline stats — big visual treatment */}
        <Stagger step={0.05} className="grid gap-4 sm:grid-cols-3">
          {WHY_STATS.map((s) => (
            <Reveal key={s.label}>
              <motion.div whileHover={{ y: -3 }}
                className="relative overflow-hidden rounded-2xl p-6 text-center"
                style={{
                  background: "linear-gradient(180deg, rgba(191, 79, 54, 0.06) 0%, rgb(var(--bg-surface)) 70%)",
                  border: "1px solid rgba(191, 79, 54, 0.20)",
                }}>
                <div className="font-mono text-5xl font-bold tracking-tight sm:text-6xl"
                  style={{ color: "rgb(var(--accent))" }}>
                  {s.value}
                </div>
                <div className="mt-2 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                  {s.label}
                </div>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>

        {/* Voices from Bengaluru — citizen testimonials */}
        <div>
          <div className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "rgb(var(--text-muted))" }}>
            <MessageCircle className="h-3.5 w-3.5" /> Voices from Bengaluru
          </div>
          <Stagger step={0.06} className="grid gap-4 md:grid-cols-3">
            {CITIZEN_QUOTES.map((q) => (
              <Reveal key={q.name}>
                <motion.figure whileHover={{ y: -3 }}
                  className="card relative h-full p-6"
                  style={{ border: "1px solid rgb(var(--border-light))" }}>
                  <div className="absolute -top-3 left-5 font-serif text-5xl leading-none"
                    style={{ color: "rgb(var(--accent))" }}>
                    “
                  </div>
                  <blockquote className="mt-2 text-sm leading-relaxed"
                    style={{ color: "rgb(var(--text-primary))" }}>
                    {q.quote}
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3 border-t pt-3"
                    style={{ borderColor: "rgb(var(--border-light))" }}>
                    <span className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white"
                      style={{ background: "rgb(var(--accent))" }}>
                      {q.name[0]}
                    </span>
                    <span className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                        {q.name}
                      </div>
                      <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                        {q.ward} · {q.issue}
                      </div>
                    </span>
                  </figcaption>
                </motion.figure>
              </Reveal>
            ))}
          </Stagger>
        </div>

        {/* Three systemic pain points — the original PROBLEMS cards */}
        <Stagger step={0.05} className="grid gap-4 sm:grid-cols-3">
          {PROBLEMS.map((p) => (
            <Reveal key={p.k}>
              <motion.div whileHover={{ y: -3 }} className="card h-full p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e" }}>
                  <p.icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-lg font-semibold">{p.k}</div>
                <p className="mt-1 text-base text-ink-600">{p.v}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* SOLUTION */}
      <section>
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>How NagarikAI works</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            The LLM proposes. The gate decides. The citizen sees every step.
          </h2>
        </header>
        <Stagger step={0.05} className="grid gap-4 sm:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <Reveal key={s.k}>
              <motion.div whileHover={{ y: -3 }} className="card h-full p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: "rgba(191,79,54,0.15)", color: "rgb(var(--accent))" }}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-lg font-semibold">{s.k}</div>
                <p className="mt-1 text-base text-ink-600">{s.v}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* ROUTING TAXONOMY */}
      <section>
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>The routing taxonomy</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            8 issue types · 7 departments · 1 deterministic gate
          </h2>
          <p className="mt-3 text-base text-ink-600 sm:text-lg">
            Vision (Gemini 2.5 Flash) classifies your <strong>photo or short video</strong>
            into one of these 8 categories. The Triage agent&apos;s SOP table routes each
            to the right BBMP / BWSSB / BESCOM department with a default SLA. The
            deterministic gate verifies the LLM&apos;s choice — any mismatch falls back to
            the canonical mapping below. <Link href="/references" className="underline" style={{ color: "rgb(var(--accent))" }}>
              See 7/7 video-classification probe on /references →
            </Link>
          </p>
        </header>

        {/* 3-step header strip — Photo → Vision → Routes */}
        <div className="mx-auto mb-6 grid max-w-3xl grid-cols-5 items-center gap-2 text-center">
          <div className="card p-3">
            <Camera className="mx-auto h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
            <div className="mt-1 text-xs font-semibold">Photo or video</div>
            <div className="text-[10px] text-ink-500">Citizen captures</div>
          </div>
          <ArrowRight className="mx-auto h-5 w-5 text-ink-400" />
          <div className="card p-3">
            <Eye className="mx-auto h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
            <div className="mt-1 text-xs font-semibold">Vision + Triage</div>
            <div className="text-[10px] text-ink-500">Gemini 2.5 · Vertex AI · Claude · Gate</div>
          </div>
          <ArrowRight className="mx-auto h-5 w-5 text-ink-400" />
          <div className="card p-3">
            <Building2 className="mx-auto h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
            <div className="mt-1 text-xs font-semibold">Department</div>
            <div className="text-[10px] text-ink-500">+ SLA</div>
          </div>
        </div>

        {/* The 8 category rows */}
        <Stagger step={0.04} className="grid gap-2 sm:grid-cols-2">
          {ROUTING_TAXONOMY.map((r) => (
            <Reveal key={r.type}>
              <motion.div whileHover={{ y: -2 }}
                className="card flex items-center gap-3 p-3">
                {/* Category icon */}
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: "rgba(191,79,54,0.10)", color: "rgb(var(--accent))" }}>
                  <r.icon className="h-5 w-5" />
                </span>
                {/* Type name */}
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold">{r.label}</div>
                  <div className="font-mono text-[11px] text-ink-500">{r.type}</div>
                </div>
                {/* Arrow */}
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
                {/* Department + SLA */}
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-base font-semibold">{r.dept}</div>
                  <div className="text-[11px] text-ink-500">SLA · {r.sla}</div>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>

        <p className="mt-4 text-center text-sm text-ink-500">
          High-severity (≥ 4) reports auto-halve the SLA at runtime. e.g. a sev-4 pothole
          becomes 36h instead of 72h. See <Link href="/architecture" className="underline">/architecture</Link> for the gate's full decision tree.
        </p>
      </section>

      {/* XP + BADGES */}
      <section>
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>For citizens</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Earn XP for every verified contribution
          </h2>
          <p className="mt-3 text-base text-ink-600 sm:text-lg">
            Reporting civic issues is a public good. NagarikAI rewards citizens who show up
            consistently — every submitted report, every neighbour-verification, every
            crew-verified fix bumps your XP. Hit a tier and a soulbound NFT badge lands in
            your wallet (Polygon Amoy testnet — non-transferable, real proof of contribution).
          </p>
        </header>

        {/* The 3 ways to earn XP */}
        <Stagger step={0.05} className="grid gap-3 sm:grid-cols-3">
          {XP_ACTIONS.map((a) => (
            <Reveal key={a.k}>
              <motion.div whileHover={{ y: -3 }} className="card relative h-full p-5">
                <span className="absolute -top-2 right-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ background: "rgb(var(--accent))" }}>
                  +{a.xp} XP
                </span>
                <div className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: "rgba(191,79,54,0.10)", color: "rgb(var(--accent))" }}>
                  <a.icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-lg font-semibold">{a.k}</div>
                <p className="mt-1 text-sm text-ink-600">{a.note}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>

        {/* Badge ladder — Reporter → Civic Hero */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-ink-700">Badge tiers — climb the ladder</h3>
            <span className="text-sm text-ink-500">Each badge is a soulbound NFT (ERC-721, non-transferable)</span>
          </div>
          <Stagger step={0.04} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {BADGE_TIERS.map((b, i) => (
              <Reveal key={b.tier}>
                <motion.div whileHover={{ y: -3 }} className="card relative overflow-hidden p-4">
                  {/* Tier number ribbon */}
                  <span className="absolute right-3 top-3 font-mono text-[10px] text-ink-400">
                    Tier {i + 1}
                  </span>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl shadow-soft"
                    style={{
                      background: `linear-gradient(135deg, rgb(var(--accent)), #a3402b)`,
                      color: "white",
                    }}>
                    <b.icon className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-lg font-semibold">{b.tier}</div>
                  <div className="font-mono text-sm" style={{ color: "rgb(var(--accent))" }}>
                    {b.xp.toLocaleString("en-IN")} XP
                  </div>
                  <p className="mt-1 text-xs text-ink-600">{b.desc}</p>
                </motion.div>
              </Reveal>
            ))}
          </Stagger>
          <p className="mt-3 text-center text-sm text-ink-500">
            Demo account starts at <strong>125 XP</strong> — log in and you're already past your first milestone.
            See the live leaderboard on <Link href="/impact" className="underline">/impact</Link>.
          </p>
        </div>
      </section>

      {/* AGENT STRIP */}
      <section>
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>The pipeline</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">7 specialized agents · under 10 seconds end-to-end</h2>
          </div>
          <Link href="/architecture" className="btn-ghost hidden text-sm sm:inline-flex">
            Full architecture <ArrowRight className="h-4 w-4" />
          </Link>
        </header>
        <Stagger step={0.04} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {AGENTS.map((a, i) => (
            <Reveal key={a.name}>
              <motion.div whileHover={{ y: -3 }} className="card h-full p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl text-white"
                    style={{ background: "rgb(var(--accent))" }}>
                    <a.icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span className="font-mono text-xs text-ink-400">0{i + 1}</span>
                </div>
                <div className="mt-2 text-base font-semibold">{a.name}</div>
                <p className="mt-1 text-sm text-ink-600">{a.sub}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* TWO SIDES ─ closed-loop ──────────────────────────────────────── */}
      <section>
        <header className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>Two sides · one loop</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Citizens report. Crews fix. AI keeps both honest.
          </h2>
          <p className="mt-3 max-w-2xl text-base text-ink-600 sm:text-lg">
            NagarikAI isn&apos;t a parallel BBMP. It&apos;s the front door for citizens and the
            inbox for departments — wired together so neither side can ghost the other.
          </p>
        </header>

        {/* ──── Comparison table — For Citizens vs For Crew ──── */}
        <div className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "rgb(var(--border-light))", background: "rgb(var(--bg-surface))" }}>
          <table className="w-full text-base">
            <thead>
              <tr style={{ background: "rgb(var(--bg-surface-hover))" }}>
                <th className="w-44 p-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "rgb(var(--text-secondary))" }}>
                  Dimension
                </th>
                <th className="p-3 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-6 w-6 place-items-center rounded-md text-white"
                      style={{ background: "rgb(var(--accent))" }}>
                      <UserCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="text-sm font-semibold">For Nagariks <span className="font-normal text-ink-500">(citizens)</span></span>
                  </div>
                </th>
                <th className="p-3 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-6 w-6 place-items-center rounded-md text-white"
                      style={{ background: "rgb(var(--accent))" }}>
                      <Building2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="text-sm font-semibold">For Crew &amp; Supervisor <span className="font-normal text-ink-500">(BBMP/BWSSB/BESCOM)</span></span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { dim: "Who reports here",     citizen: "Anyone in BBMP wards — phone is enough", crew: "Dept supervisors + crew leads (seeded for 7 depts)" },
                { dim: "Where they sign in",   citizen: "/login (citizen JWT)",                   crew: "/dept-login (dept JWT, role = supervisor | crew_lead)" },
                { dim: "What they do",         citizen: "Snap a photo or video + share location", crew: "Acknowledge ticket → dispatch crew → upload after-photo" },
                { dim: "What they see",        citizen: "Live tracking + agent timeline + status updates in EN/HI/KN", crew: "SLA-sorted queue, dispatch log, supervisor stats, today's MILP stops" },
                { dim: "Trust mechanism",      citizen: "Verifier badge (home location at signup) + community confirms", crew: "JWT role-gated routes + CLIP+CNN audits the closure photo" },
                { dim: "Reward",               citizen: "+5 XP submit · +5 verify · +10 fix verified · badges + soulbound NFT", crew: "Supervisor KPI: today's acked / resolved / SLA on-time %" },
                { dim: "What closes the loop", citizen: "Notification: \"BBMP Roads acknowledged · crew on-site · resolved\"", crew: "Citizen sees status change in real time; +10 XP fires when CNN audit passes" },
              ].map((row, idx) => (
                <tr key={row.dim}
                  style={{ borderTop: idx === 0 ? undefined : "1px solid rgb(var(--border-light))" }}>
                  <td className="p-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(var(--text-secondary))" }}>
                    {row.dim}
                  </td>
                  <td className="p-3 text-base" style={{ color: "rgb(var(--text-primary))" }}>{row.citizen}</td>
                  <td className="p-3 text-base" style={{ color: "rgb(var(--text-primary))" }}>{row.crew}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ──── Closed-loop arrow workflow ──── */}
        <div className="mt-8 rounded-2xl p-6"
          style={{
            background: "linear-gradient(180deg, rgba(191,79,54,0.04) 0%, rgb(var(--bg-surface)) 100%)",
            border: "1px solid rgba(191, 79, 54, 0.25)",
          }}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider"
                style={{ color: "rgb(var(--accent))" }}>
                <RefreshCw className="h-3 w-3" /> The closed loop
              </div>
              <h3 className="mt-1 text-xl font-semibold sm:text-2xl">From snap to resolved — every step is acked or escalated</h3>
            </div>
            <span className="text-sm font-medium" style={{ color: "rgb(var(--text-secondary))" }}>
              ~10s pipeline · 60s SLA-watcher tick · citizen never has to follow up
            </span>
          </div>

          {/* Main loop — 8 stages with arrows */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
            <LoopStage step={1} icon={Camera} tone="citizen"
              title="Citizen reports"
              body="Photo or video, drop location. /report" />
            <ArrowCell />
            <LoopStage step={2} icon={Brain} tone="ai"
              title="AI triages"
              body="Vision · Dedup · Triage assign dept + SLA in ~10s" />
            <ArrowCell />
            <LoopStage step={3} icon={Send} tone="dept"
              title="Hub dispatches"
              body="WhatsApp · Email · Webhook · in-app — by dept channel" />
            <ArrowCell />
            <LoopStage step={4} icon={CheckCircle2} tone="dept"
              title="Supervisor acks"
              body="/supervisor — one tap. Citizen pinged instantly." />
            <ArrowCell hide="lg" />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
            <LoopStage step={5} icon={Truck} tone="crew"
              title="MILP picks crew"
              body="OR-Tools CVRPTW — shortest path + skill match" />
            <ArrowCell />
            <LoopStage step={6} icon={Wrench} tone="crew"
              title="Crew fixes on-site"
              body="/crew/[id] — Start · After-photo · Complete" />
            <ArrowCell />
            <LoopStage step={7} icon={ShieldCheck} tone="ai"
              title="AI audits the fix"
              body="CLIP scene match + custom pothole CNN catches fake closures" />
            <ArrowCell />
            <LoopStage step={8} icon={Award} tone="citizen"
              title="Citizen +XP"
              body="Notified in their language · badge progress · loop closed" />
          </div>

          {/* Escalation branch — bottom row */}
          <div className="mt-6 rounded-xl p-4"
            style={{ background: "rgba(220, 38, 38, 0.05)", border: "1px solid rgba(220, 38, 38, 0.25)" }}>
            <div className="mb-3 flex items-center gap-1.5">
              <Siren className="h-4 w-4" style={{ color: "#dc2626" }} />
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#dc2626" }}>
                If a department goes silent — the escalation ladder
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <EscalChip level="L0" body="Nominal · awaiting ack" tone="ink" />
              <ArrowRight className="h-3.5 w-3.5" style={{ color: "rgb(var(--text-muted))" }} />
              <EscalChip level="L1" body="SLA breach — re-ping supervisor" tone="amber" icon={AlertTriangle} />
              <ArrowRight className="h-3.5 w-3.5" style={{ color: "rgb(var(--text-muted))" }} />
              <EscalChip level="L2" body="+24h silent — ward councillor" tone="amber" />
              <ArrowRight className="h-3.5 w-3.5" style={{ color: "rgb(var(--text-muted))" }} />
              <EscalChip level="L3" body="+72h silent — RTI auto-draft" tone="red" icon={Siren} />
            </div>
            <p className="mt-3 text-sm" style={{ color: "rgb(var(--text-muted))" }}>
              <code className="font-mono">apps/api/nagarik/jobs/sla_watcher.py</code> ticks every 60s.
              Every escalation writes a citizen notification — citizens always know exactly where their ticket is.
            </p>
          </div>

          {/* CTAs into both portals */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/login"
              className="card-glow flex items-center gap-3 p-4 text-base transition hover:opacity-90">
              <span className="grid h-10 w-10 place-items-center rounded-xl text-white"
                style={{ background: "rgb(var(--accent))" }}>
                <UserCheck className="h-5 w-5" />
              </span>
              <div>
                <div className="font-semibold">Try the citizen side</div>
                <div className="text-sm text-ink-600">/login — demo account preloaded · earn +5 XP per report</div>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-ink-400" />
            </Link>
            <Link href="/dept-login"
              className="card-glow flex items-center gap-3 p-4 text-base transition hover:opacity-90">
              <span className="grid h-10 w-10 place-items-center rounded-xl text-white"
                style={{ background: "rgb(var(--accent))" }}>
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <div className="font-semibold">Open the supervisor portal</div>
                <div className="text-sm text-ink-600">/dept-login — 14 demo accounts · ack · escalate · dispatch log</div>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-ink-400" />
            </Link>
          </div>
        </div>
      </section>

      {/* WHATSAPP DEMO PHONE — Framer Motion showing live citizen updates ──── */}
      <WhatsAppPhoneDemo />

      {/* CAPABILITIES — four upgrades grafted onto the 7-agent loop. Each
          block links to where the citizen / supervisor experiences it.
          Keeps the marketing site honest: every claim points to running
          code, not a roadmap line item. */}
      <section>
        <header className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Four upgrades that take NagarikAI from working app to civic platform
          </h2>
          <p className="mt-3 max-w-2xl text-base text-ink-600 sm:text-lg">
            Every feature below runs in the live build today — not on a slide. The
            7-agent loop, the MILP solver, and the closed-loop CLIP verifier are still
            the spine; these four upgrades graft new tissue onto each end of it.
          </p>
        </header>

        <Stagger step={0.07} className="grid gap-5 sm:grid-cols-2">
          {/* ── 1. Community DIY & Crowdfunding ──────────────────────── */}
          <Reveal>
            <motion.div whileHover={{ y: -3 }} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-3"
                style={{
                  background: "linear-gradient(90deg, rgba(168, 85, 247, 0.12), rgba(236, 72, 153, 0.06))",
                  borderBottom: "1px solid rgba(168, 85, 247, 0.30)",
                }}>
                <span className="grid h-9 w-9 place-items-center rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}>
                  <Hammer className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">Community DIY &amp; Crowdfunding</div>
                  <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                    When the system fails, neighbours can take over.
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: "rgba(168, 85, 247, 0.16)", color: "#7e22ce" }}>
                  Citizens become Heroes
                </span>
              </div>
              <div className="space-y-3 p-6 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  A low-severity issue (overflowing garbage, faded crosswalk, dark
                  lane) that breaches its <strong>Level&nbsp;3 SLA</strong> with no
                  municipal action automatically unlocks a <strong>Community Fix</strong>{" "}
                  module on the citizen&apos;s tracking page.
                </p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-start gap-2"><HandCoins className="mt-0.5 h-3.5 w-3.5" style={{ color: "#a855f7" }} /> Citizens pledge small amounts (₹100/500/1,000) or volunteer hours.</li>
                  <li className="flex items-start gap-2"><Users className="mt-0.5 h-3.5 w-3.5" style={{ color: "#a855f7" }} /> Threshold: <strong>5 volunteer-hours</strong> OR <strong>₹1,500</strong>.</li>
                  <li className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-3.5 w-3.5" style={{ color: "#a855f7" }} /> Threshold met → platform generates a DIY workplan (tools, safety, meet-up).</li>
                </ul>
              </div>
            </motion.div>
          </Reveal>

          {/* ── 2. AI Resource & Budget Estimator ─────────────────────── */}
          <Reveal>
            <motion.div whileHover={{ y: -3 }} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-3"
                style={{
                  background: "linear-gradient(90deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.06))",
                  borderBottom: "1px solid rgba(245, 158, 11, 0.30)",
                }}>
                <span className="grid h-9 w-9 place-items-center rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                  <Receipt className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">AI Budget Estimator</div>
                  <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                    Vision Agent upgrade: dimensions → materials → cost.
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: "rgba(245, 158, 11, 0.18)", color: "#b45309" }}>
                  Truck-loading view
                </span>
              </div>
              <div className="space-y-3 p-6 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  Gemini 2.5 Flash now classifies <em>and</em> estimates physical
                  dimensions + required materials. Supervisors get a budgeted line
                  item before the truck even leaves the depot.
                </p>
                <div className="rounded-2xl p-3 text-xs"
                  style={{
                    background: "rgb(var(--bg-surface-hover))",
                    border: "1px solid rgb(var(--border-light))",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}>
                  <div>2×2 m pothole detected.</div>
                  <div className="mt-1">Materials: 3 bags cold-mix asphalt.</div>
                  <div>Estimated cost: <strong>₹1,500</strong>.</div>
                </div>
                <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                  Unit-price table is held in the Vision Agent&apos;s prompt — easy
                  for a BBMP procurement officer to tune per quarter.
                </p>
              </div>
            </motion.div>
          </Reveal>

          {/* ── 3. Viral Before/After Growth Loop ─────────────────────── */}
          <Reveal>
            <motion.div whileHover={{ y: -3 }} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-3"
                style={{
                  background: "linear-gradient(90deg, rgba(99, 102, 241, 0.12), rgba(236, 72, 153, 0.06))",
                  borderBottom: "1px solid rgba(99, 102, 241, 0.30)",
                }}>
                <span className="grid h-9 w-9 place-items-center rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #6366f1, #ec4899)" }}>
                  <Share2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">Viral Before/After loop</div>
                  <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                    CLIP verifies → split-image generates → one-tap share.
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: "rgba(99, 102, 241, 0.18)", color: "#4338ca" }}>
                  Organic growth
                </span>
              </div>
              <div className="space-y-3 p-6 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  The instant the Resolution Agent&apos;s CLIP audit passes, a
                  watermarked <strong>Before&nbsp;|&nbsp;After</strong> graphic with
                  &ldquo;Fixed in 36 hours via NagarikAI&rdquo; is auto-rendered.
                  A single tap fires the Web Share API into WhatsApp, X, Instagram.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="aspect-[4/3] rounded-xl"
                    style={{ background: "linear-gradient(135deg, #57534e, #292524)" }}>
                    <div className="grid h-full place-items-center text-[10px] font-semibold uppercase tracking-wider text-white opacity-80">
                      Before
                    </div>
                  </div>
                  <div className="aspect-[4/3] rounded-xl"
                    style={{ background: "linear-gradient(135deg, #166534, #14532d)" }}>
                    <div className="grid h-full place-items-center text-[10px] font-semibold uppercase tracking-wider text-white opacity-90">
                      After · ✓
                    </div>
                  </div>
                </div>
                <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                  Solves discoverability without a marketing budget — every fix
                  becomes a recruitment moment for the next citizen.
                </p>
              </div>
            </motion.div>
          </Reveal>

          {/* ── 4. Voice-First Multimodal Audio ───────────────────────── */}
          <Reveal>
            <motion.div whileHover={{ y: -3 }} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-3"
                style={{
                  background: "linear-gradient(90deg, rgba(220, 38, 38, 0.10), rgba(245, 158, 11, 0.06))",
                  borderBottom: "1px solid rgba(220, 38, 38, 0.25)",
                }}>
                <span className="grid h-9 w-9 place-items-center rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #dc2626, #f59e0b)" }}>
                  <Mic className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">Voice-first multimodal</div>
                  <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                    Kannada · हिंदी · English — drops literacy barriers.
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: "rgba(220, 38, 38, 0.16)", color: "#b91c1c" }}>
                  Native audio
                </span>
              </div>
              <div className="space-y-3 p-6 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  Tap the mic on <code className="font-mono">/report</code>, describe the issue in
                  your language. Gemini 2.5 Flash ingests photo <strong>and</strong> audio in a
                  single multimodal call — no latency-heavy STT round-trip, no
                  glossary mismatches on local place names.
                </p>
                <div className="rounded-2xl p-3 text-xs italic"
                  style={{
                    background: "rgb(var(--bg-surface-hover))",
                    border: "1px solid rgb(var(--border-light))",
                  }}>
                  <Volume2 className="mb-1 inline h-3 w-3" />{" "}
                  &ldquo;Ee pothole inda thumba problem agtide&rdquo; →{" "}
                  <span className="not-italic font-semibold">
                    &ldquo;This pothole is causing a lot of problems.&rdquo;
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Languages className="h-3.5 w-3.5" style={{ color: "#dc2626" }} />
                  <span style={{ color: "rgb(var(--text-muted))" }}>
                    The same audio also feeds the dispatcher context — &ldquo;3 weeks
                    standing, schoolchildren walk past at 8am&rdquo;.
                  </span>
                </div>
              </div>
            </motion.div>
          </Reveal>
        </Stagger>

        <div className="mt-6 rounded-2xl p-4 text-sm"
          style={{
            background: "rgb(var(--bg-surface-hover))",
            border: "1px solid rgb(var(--border-light))",
            color: "rgb(var(--text-secondary))",
          }}>
          <strong style={{ color: "rgb(var(--text-primary))" }}>Why these four together?</strong>{" "}
          Voice removes the report-side bottleneck (literacy). Estimator removes
          the dispatch-side bottleneck (budgeting). Before/After removes the
          discoverability bottleneck (acquisition). DIY removes the failure-mode
          bottleneck (what happens when the city doesn&apos;t show up). Each one
          closes a hole the original 7-agent loop couldn&apos;t.
        </div>
      </section>

      {/* ROADMAP ─ what's next, what we'd build after the hackathon ──────── */}
      <section>
        <header className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>Roadmap</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            What ships next — beyond the hackathon
          </h2>
          <p className="mt-3 max-w-2xl text-base text-ink-600 sm:text-lg">
            Today NagarikAI is a working web app + Meta WhatsApp sandbox. The architecture is
            production-ready; what&apos;s left is partnership, hardening, and platform reach. Here&apos;s
            the post-hackathon plan, ordered by user impact.
          </p>
        </header>

        <Stagger step={0.05} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              when: "Q1",
              icon: Sparkles,
              title: "Native Android + iOS apps",
              body: "Today: responsive PWA that runs in any mobile browser, including the WhatsApp in-app browser. Next: native React Native shell so we get true background location for verifiers, push notifications without a service-worker round-trip, and Play Store / App Store discoverability.",
              tag: "Mobile",
            },
            {
              when: "Q1",
              icon: ShieldCheck,
              title: "Meta WhatsApp Business verification",
              body: "Today we run on Meta's sandbox (test recipients only). Next: complete business verification + register the citizen-facing 'civic_ticket_update' template with {type}/{severity}/{dept}/{sla} variables. Unlocks unsolicited messages to any number, not just registered testers.",
              tag: "Messaging",
            },
            {
              when: "Q1",
              icon: Building2,
              title: "BBMP MoU + real outbound channels",
              body: "Switch each department's primary_channel from simulated to live. WhatsApp for Roads/SWM via their actual supervisor numbers; SMTP into the existing BWSSB and BESCOM complaint inboxes; signed webhooks into BBMP's e-Aasthi where available.",
              tag: "Partnership",
            },
            {
              when: "Q2",
              icon: UserCheck,
              title: "Aadhaar + UPI verification",
              body: "Prevent XP gaming. One verified human = one citizen account, tied to a UPI ID. Civic Hero NFTs become attestable identities crews can trust when triaging high-severity reports (sewage on busy roads, fallen power lines).",
              tag: "Trust",
            },
            {
              when: "Q2",
              icon: AlertTriangle,
              title: "SOS button for life-safety issues",
              body: "Today every ticket follows the same 45s pipeline. Next: a 'this is dangerous right now' tap that bypasses verification, fires an SMS + WhatsApp to the on-call supervisor, and pings the nearest crew via live GPS — for downed power lines, exposed manholes, fire-prone garbage piles.",
              tag: "Safety",
            },
            {
              when: "Q2",
              icon: Truck,
              title: "Live crew GPS + ETA on tracking",
              body: "Crew app uploads location every 30s when a stop is in progress. Citizen tracking page shows a live blue dot + a real-time ETA so they don&apos;t have to keep refreshing.",
              tag: "UX",
            },
            {
              when: "Q3",
              icon: Map,
              title: "Multi-city rollout",
              body: "Hyderabad, Chennai, Mumbai, Delhi. The ward polygons, SOP table, and department list are config; the agent loop and MILP are not. Roughly 1 week of data ingestion per city plus a local MoU.",
              tag: "Scale",
            },
            {
              when: "Q3",
              icon: Cpu,
              title: "Per-city MILP re-solver",
              body: "Today the scheduler re-solves on every new issue (fine for the demo, wasteful at city scale). Next: nightly Cloud Scheduler job that re-solves once + stores assignments + diffs against the prior solution so dispatchers see only what changed.",
              tag: "Infrastructure",
            },
          ].map((step) => (
            <Reveal key={step.title}>
              <motion.div whileHover={{ y: -3 }} className="card h-full p-5">
                <div className="flex items-start justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl"
                    style={{ background: "rgba(191, 79, 54, 0.10)", color: "rgb(var(--accent))" }}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: "rgba(191, 79, 54, 0.12)", color: "rgb(var(--accent))" }}>
                      {step.when}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ background: "rgb(var(--bg-surface-hover))", color: "rgb(var(--text-muted))" }}>
                      {step.tag}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-lg font-semibold">{step.title}</div>
                <p className="mt-1 text-sm text-ink-600">{step.body}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>

        <div className="mt-6 rounded-2xl p-4 text-sm"
          style={{
            background: "rgb(var(--bg-surface-hover))",
            border: "1px solid rgb(var(--border-light))",
            color: "rgb(var(--text-secondary))",
          }}>
          <strong style={{ color: "rgb(var(--text-primary))" }}>None of this is research.</strong>{" "}
          The hackathon build proves the architecture works on real Bengaluru data
          (127k complaints, 243 wards, 14,580 ward-months of rainfall, 800-issue MILP backtest with
          89.5% km reduction). Scaling it to the rest of India is a build problem — partnership
          conversations and platform reach, not new models.
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="rounded-3xl border p-10 text-center"
        style={{ borderColor: "rgb(var(--border-light))", background: "rgb(var(--bg-surface))" }}>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Try it — it takes 30 seconds.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-ink-600 sm:text-lg">
          A hackathon demo account is preloaded. Sign in, pick a Bengaluru ward, snap a photo or video,
          and watch all 7 agents fire in real time.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href={primaryHref} className="btn-primary">
            <LogIn className="h-4 w-4" /> {primaryLabel}
          </Link>
          <Link href="/test-photos" className="btn-ghost">
            Browse the test photos
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ─── helpers for the closed-loop section ─── */

type Tone = "citizen" | "ai" | "dept" | "crew";

/**
 * Per-tone Tailwind classes. Each tone has paired light + dark variants so
 * the tinted backgrounds stay visible in BOTH themes — the previous version
 * used fixed-opacity rgba strings which washed out in dark mode (especially
 * the slate-based 'dept' tone, which became invisible against the dark canvas).
 */
const LOOP_TONES: Record<Tone, {
  card: string;       // bg + border for the stage
  chipBg: string;     // square icon chip background
  pillBg: string;     // small role pill at top-right
  pillText: string;   // role pill text colour
  label: string;
}> = {
  citizen: {
    card:     "bg-[rgba(191,79,54,0.10)] border border-[rgba(191,79,54,0.35)] dark:bg-[rgba(191,79,54,0.22)] dark:border-[rgba(191,79,54,0.55)]",
    chipBg:   "bg-[rgb(var(--accent))]",
    pillBg:   "bg-white/70 dark:bg-white/10",
    pillText: "text-[rgb(var(--accent))] dark:text-[#fbbcab]",
    label:    "Citizen",
  },
  ai: {
    card:     "bg-blue-500/10 border border-blue-500/40 dark:bg-blue-500/22 dark:border-blue-400/60",
    chipBg:   "bg-blue-600 dark:bg-blue-500",
    pillBg:   "bg-white/70 dark:bg-white/10",
    pillText: "text-blue-700 dark:text-blue-200",
    label:    "AI agent",
  },
  dept: {
    // Was slate-on-dark = invisible. Swapped to a warm amber so the
    // 'Department' lane reads in BOTH themes alongside the other tones.
    card:     "bg-amber-500/10 border border-amber-500/40 dark:bg-amber-500/22 dark:border-amber-400/60",
    chipBg:   "bg-amber-600 dark:bg-amber-500",
    pillBg:   "bg-white/70 dark:bg-white/10",
    pillText: "text-amber-700 dark:text-amber-200",
    label:    "Department",
  },
  crew: {
    card:     "bg-emerald-500/10 border border-emerald-500/40 dark:bg-emerald-500/22 dark:border-emerald-400/60",
    chipBg:   "bg-emerald-600 dark:bg-emerald-500",
    pillBg:   "bg-white/70 dark:bg-white/10",
    pillText: "text-emerald-700 dark:text-emerald-200",
    label:    "Crew",
  },
};

function LoopStage({ step, icon: Icon, title, body, tone }:
  { step: number; icon: typeof Camera; title: string; body: string; tone: Tone }) {
  const t = LOOP_TONES[tone];
  return (
    <div className={`rounded-xl p-4 ${t.card}`}>
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-lg text-white ${t.chipBg}`}>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t.pillBg} ${t.pillText}`}>
          {t.label} · {step}
        </span>
      </div>
      <div className="mt-3 text-base font-semibold" style={{ color: "rgb(var(--text-primary))" }}>{title}</div>
      <div className="mt-1 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>{body}</div>
    </div>
  );
}

function ArrowCell({ hide }: { hide?: "lg" }) {
  // Horizontal arrow on ≥sm, vertical on mobile so the grid wraps cleanly.
  return (
    <div className={`flex items-center justify-center ${hide === "lg" ? "lg:hidden" : ""}`}>
      <ArrowRight className="hidden h-5 w-5 sm:block" style={{ color: "rgb(var(--text-muted))" }} />
      <ArrowDown className="h-5 w-5 sm:hidden" style={{ color: "rgb(var(--text-muted))" }} />
    </div>
  );
}

/**
 * Per-tone classes for the escalation chips. 'ink' (the nominal/baseline
 * step) uses the theme surface so it reads cleanly in both modes; amber/red
 * use mid-opacity tints that brighten in dark mode so the gradient up the
 * ladder remains visible.
 */
const ESCAL_TONES: Record<"ink" | "amber" | "red", string> = {
  ink:   "bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-light))] text-[rgb(var(--text-primary))]",
  amber: "bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:bg-amber-500/25 dark:border-amber-400/55 dark:text-amber-200",
  red:   "bg-rose-500/15  border border-rose-500/40  text-rose-700  dark:bg-rose-500/25  dark:border-rose-400/55  dark:text-rose-200",
};

function EscalChip({ level, body, tone, icon: Icon }:
  { level: string; body: string; tone: "ink" | "amber" | "red"; icon?: typeof Siren }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${ESCAL_TONES[tone]}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="font-mono font-semibold">{level}</span>
      <span>{body}</span>
    </span>
  );
}

/* ───────── WhatsAppPhoneDemo — animated mock phone showing live sends ───── */

const PHONE_MESSAGES = [
  { emoji: "🤖", title: "Step 1", body: "NagarikAI received your report (#a1b2c3d4). Classified as *pothole* · severity *4/5*." },
  { emoji: "📤", title: "Step 2", body: "Forwarded to *BBMP Roads* via their WhatsApp channel. SLA: by Mon 29 Jun, 14:24 IST." },
  { emoji: "👥", title: "Step 3", body: "3 nearby citizens confirmed the issue. Dispatcher is picking it up." },
  { emoji: "🚧", title: "Step 5", body: "The crew is on-site now." },
  { emoji: "✅", title: "Step 6", body: "BBMP Roads reported the fix. After-photo cleared CLIP+CNN audit. +10 XP earned — you're at *135 XP*." },
];

function WhatsAppPhoneDemo() {
  return (
    <section className="overflow-hidden rounded-3xl border p-6 sm:p-8"
      style={{
        background: "linear-gradient(135deg, rgba(37,211,102,0.06) 0%, rgb(var(--bg-surface)) 100%)",
        borderColor: "rgba(37,211,102,0.35)",
      }}>
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_320px]">
        {/* LEFT — copy */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#15803d" }}>
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp · live for the citizen
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            NagarikAI pings the citizen at every step
          </h2>
          <p className="mt-3 text-base text-ink-600 sm:text-lg">
            Drop your number into the green opt-in on{" "}
            <Link href="/report" className="font-semibold underline" style={{ color: "rgb(var(--accent))" }}>/report</Link>{" "}
            and the same 7-agent loop that triages your ticket also DMs you on WhatsApp the moment
            each stage finishes. No app to install. No refresh button. The phone buzzes.
          </p>
          <ul className="mt-4 space-y-2 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
            {[
              ["🤖", "AI classifies your photo or video"],
              ["📤", "Forwarded to the right department"],
              ["👥", "Confirmed by your neighbours"],
              ["🚧", "Crew on-site (MILP-optimised route)"],
              ["✅", "Resolved · after-photo verified · +10 XP"],
            ].map(([e, t]) => (
              <li key={t as string} className="flex items-center gap-2">
                <span aria-hidden>{e}</span>{t}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href="/report"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "#25D366" }}>
              <MessageCircle className="h-4 w-4" /> Try it on your phone
            </Link>
            <Link href="/admin/whatsapp"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "rgb(var(--bg-surface-hover))", border: "1px solid rgb(var(--border-color))", color: "rgb(var(--text-primary))" }}>
              See sandbox roster <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* RIGHT — animated phone mock */}
        <div className="mx-auto w-full max-w-[280px]">
          <PhoneFrame>
            <PhoneChat />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="relative mx-auto h-[520px] w-[260px] rounded-[36px] p-3 shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #1f2937 0%, #0f172a 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
        {/* notch */}
        <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl"
          style={{ background: "#0f172a" }} />
        {/* screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[26px]"
          style={{ background: "#e5ddd5" /* WhatsApp chat bg */ }}>
          {/* header */}
          <div className="flex items-center gap-2 px-3 py-2 text-white"
            style={{ background: "#075E54" }}>
            <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold"
              style={{ background: "rgb(var(--accent))" }}>N</span>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold leading-tight">NagarikAI</div>
              <div className="truncate text-[9px] opacity-70">online · typing…</div>
            </div>
          </div>
          {/* chat area */}
          <div className="absolute inset-x-0 bottom-0 top-[44px] overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneChat() {
  // The whole strip is one motion.div that we replay every ~18s by cycling
  // a key. Each message slides up with a stagger so the demo feels live.
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div key={cycle}
      initial={{ y: 0 }}
      className="flex h-full flex-col-reverse gap-1.5 overflow-hidden p-2"
    >
      {/* render messages in reverse so newest is at bottom — natural chat order */}
      {[...PHONE_MESSAGES].reverse().map((m, i) => {
        const orderFromBottom = i;
        // delay = (4 - i) * 2.2s so step 1 appears first then step 2 etc.
        const delay = (PHONE_MESSAGES.length - 1 - orderFromBottom) * 2.2;
        return (
          <motion.div
            key={`${cycle}-${i}`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay, duration: 0.35, ease: "easeOut" }}
            className="max-w-[88%] self-end rounded-2xl px-2.5 py-1.5 text-[10.5px] leading-snug shadow-sm"
            style={{
              background: "#dcf8c6", // WhatsApp received-bubble green
              color: "#111827",
            }}
          >
            <div className="font-semibold">
              <span className="mr-1">{m.emoji}</span>{m.title}
            </div>
            <div className="mt-0.5">
              {m.body.split("*").map((chunk, ci) =>
                ci % 2 === 1 ? <strong key={ci}>{chunk}</strong> : <span key={ci}>{chunk}</span>,
              )}
            </div>
            <div className="mt-0.5 text-right text-[8px] opacity-60">
              {String(10 + (PHONE_MESSAGES.length - 1 - orderFromBottom)).padStart(2, "0")}:24 ✓✓
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
