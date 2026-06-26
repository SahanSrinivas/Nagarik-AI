"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Brain,
  Building2,
  Camera,
  CheckCircle2,
  Cpu,
  Droplet,
  Eye,
  GitBranch,
  Lightbulb,
  Lock,
  LogIn,
  Medal,
  Construction,
  ShieldCheck,
  Shield,
  Shovel,
  Sparkles,
  Star,
  Trash2,
  TreeDeciduous,
  TrendingUp,
  Trophy,
  Truck,
  UserCheck,
  Waves,
  Wrench,
  Zap,
} from "lucide-react";

import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";
import { useAuth } from "@/lib/auth";

const AGENTS = [
  { icon: Eye,          name: "Vision",       sub: "Gemini classifies photo or video" },
  { icon: GitBranch,    name: "Dedup",        sub: "Merge nearby duplicates" },
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

const SOLUTIONS = [
  { icon: Brain,        k: "AI does the work", v: "Snap a photo (or short video) → Gemini classifies it · Claude routes it · OR-Tools schedules it · CLIP + CNN verify the fix." },
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
            <p className="mx-auto mt-5 max-w-2xl text-base text-ink-300 sm:text-lg">
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

      {/* PROBLEM */}
      <section>
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-xs uppercase tracking-wider text-ink-500">Why this matters</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Bengaluru's BBMP gets ~127,000 complaints in six months. 15% stay open.
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            Citizens have learned to distrust the apps that exist. Crews close tickets without fixing them. The system rewards activity, not outcomes.
          </p>
        </header>
        <Stagger step={0.05} className="grid gap-4 sm:grid-cols-3">
          {PROBLEMS.map((p) => (
            <Reveal key={p.k}>
              <motion.div whileHover={{ y: -3 }} className="card h-full p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e" }}>
                  <p.icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-base font-semibold">{p.k}</div>
                <p className="mt-1 text-sm text-ink-600">{p.v}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* SOLUTION */}
      <section>
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-xs uppercase tracking-wider text-ink-500">How NagarikAI works</div>
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
                <div className="mt-3 text-base font-semibold">{s.k}</div>
                <p className="mt-1 text-sm text-ink-600">{s.v}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* ROUTING TAXONOMY */}
      <section>
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-xs uppercase tracking-wider text-ink-500">The routing taxonomy</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            8 issue types · 7 departments · 1 deterministic gate
          </h2>
          <p className="mt-2 text-sm text-ink-600">
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
            <div className="text-[10px] text-ink-500">Gemini · Claude · Gate</div>
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
                  <div className="text-sm font-semibold">{r.label}</div>
                  <div className="font-mono text-[10px] text-ink-500">{r.type}</div>
                </div>
                {/* Arrow */}
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
                {/* Department + SLA */}
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-sm font-semibold">{r.dept}</div>
                  <div className="text-[10px] text-ink-500">SLA · {r.sla}</div>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>

        <p className="mt-4 text-center text-xs text-ink-500">
          High-severity (≥ 4) reports auto-halve the SLA at runtime. e.g. a sev-4 pothole
          becomes 36h instead of 72h. See <Link href="/architecture" className="underline">/architecture</Link> for the gate's full decision tree.
        </p>
      </section>

      {/* XP + BADGES */}
      <section>
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-xs uppercase tracking-wider text-ink-500">For citizens</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Earn XP for every verified contribution
          </h2>
          <p className="mt-2 text-sm text-ink-600">
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
                <div className="mt-3 text-base font-semibold">{a.k}</div>
                <p className="mt-1 text-xs text-ink-600">{a.note}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>

        {/* Badge ladder — Reporter → Civic Hero */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink-700">Badge tiers — climb the ladder</h3>
            <span className="text-xs text-ink-500">Each badge is a soulbound NFT (ERC-721, non-transferable)</span>
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
                  <div className="mt-3 text-base font-semibold">{b.tier}</div>
                  <div className="font-mono text-xs" style={{ color: "rgb(var(--accent))" }}>
                    {b.xp.toLocaleString("en-IN")} XP
                  </div>
                  <p className="mt-1 text-[11px] text-ink-600">{b.desc}</p>
                </motion.div>
              </Reveal>
            ))}
          </Stagger>
          <p className="mt-3 text-center text-xs text-ink-500">
            Demo account starts at <strong>125 XP</strong> — log in and you're already past your first milestone.
            See the live leaderboard on <Link href="/impact" className="underline">/impact</Link>.
          </p>
        </div>
      </section>

      {/* AGENT STRIP */}
      <section>
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-500">The pipeline</div>
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
                <div className="mt-2 text-sm font-semibold">{a.name}</div>
                <p className="mt-1 text-xs text-ink-600">{a.sub}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* FINAL CTA */}
      <section className="rounded-3xl border p-10 text-center"
        style={{ borderColor: "rgb(var(--border-light))", background: "rgb(var(--bg-surface))" }}>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Try it — it takes 30 seconds.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ink-600">
          A hackathon demo account is preloaded. Sign in, pick a Bengaluru ward, snap a photo,
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
