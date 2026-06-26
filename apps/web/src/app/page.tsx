"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  Cpu,
  Eye,
  GitBranch,
  LogIn,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";

import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";
import { useAuth } from "@/lib/auth";

const AGENTS = [
  { icon: Eye,          name: "Vision",       sub: "Gemini classifies the photo" },
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
  { icon: Brain,        k: "AI does the work", v: "Snap a photo → Gemini classifies it · Claude routes it · OR-Tools schedules it · CLIP + CNN verify the fix." },
  { icon: ShieldCheck,  k: "Gates keep AI honest", v: "Every LLM output passes through deterministic guardrails. Hallucinations and prompt injections fail closed to the canonical SOP." },
  { icon: TrendingUp,   k: "Closed feedback loop", v: "Citizen sees every status change in real time (in EN / हि / ಕ). XP rewards verified contributions." },
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
