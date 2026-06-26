"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
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
  Mail,
  Medal,
  MessageCircle,
  Construction,
  RefreshCw,
  Send,
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

      {/* PROBLEM */}
      <section>
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>Why this matters</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Bengaluru's BBMP gets ~127,000 complaints in six months. 15% stay open.
          </h2>
          <p className="mt-3 text-base text-ink-600 sm:text-lg">
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
