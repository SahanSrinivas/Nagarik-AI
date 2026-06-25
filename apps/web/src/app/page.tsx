import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  Cpu,
  Eye,
  GitBranch,
  Layers,
  Link2,
  Map,
  Network,
  Sparkles,
  TrendingUp,
  Trophy,
  Wrench,
} from "lucide-react";

const AGENTS = [
  { icon: Eye,          name: "Vision",       desc: "Gemini classifies type + severity from photo" },
  { icon: GitBranch,    name: "Dedup",        desc: "pgvector + PostGIS merges within 50m" },
  { icon: Brain,        name: "Triage",       desc: "Routes to BBMP / BWSSB / BESCOM with SLA" },
  { icon: CheckCircle2, name: "Verification", desc: "Nearby citizens confirm, earn XP" },
  { icon: Cpu,          name: "Scheduler",    desc: "OR-Tools MILP CVRPTW dispatch" },
  { icon: Wrench,       name: "Resolution",   desc: "CLIP similarity verifies fix" },
  { icon: TrendingUp,   name: "Insights",     desc: "LightGBM predicts next-30-day hotspots" },
];

const FEATURE_CARDS = [
  { href: "/report",    title: "Report an issue",      body: "Snap a photo. The 7-agent loop handles the rest.", icon: Camera },
  { href: "/map",       title: "Live issue map",       body: "Every issue, severity-colored, in real time.",     icon: Map },
  { href: "/agents",    title: "Watch agents fire",    body: "Live pipeline visualization with timings.",        icon: Network },
  { href: "/milp",      title: "MILP optimizer",       body: "Today's optimal crew dispatch vs. naive FIFO.",    icon: Cpu },
  { href: "/dashboard", title: "Ward dashboard",       body: "Resolution rate, breach rate, throughput.",        icon: Layers },
  { href: "/impact",    title: "Citizen leaderboard",  body: "Top contributors. Soulbound NFT badges.",          icon: Trophy },
  { href: "/chain",     title: "On-chain proofs",      body: "Every agent decision Merkle-anchored to Polygon.", icon: Link2 },
];

export default function Home() {
  return (
    <div className="space-y-20">
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-gradient px-6 py-16 text-white sm:px-12 sm:py-24">
        <div className="absolute inset-0 bg-mesh opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-3xl text-center animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Built for Coding Ninjas · Community Hero
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tightest sm:text-6xl">
            Civic issues, solved at <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">city scale</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-ink-300 sm:text-lg">
            Citizens snap a photo. 7 specialized AI agents classify, dedup, triage, verify,
            and route. An MILP solver dispatches crews along the optimal route, every day.
            Every decision is hash-anchored to a public chain.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/report" className="btn-primary">
              <Camera className="h-4 w-4" /> Report an issue <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/agents"
              className="btn border border-white/15 bg-white/5 text-white backdrop-blur hover:bg-white/10"
            >
              <Network className="h-4 w-4" /> Watch the agents
            </Link>
          </div>

          <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-6 text-center">
            {[
              ["38%", "faster resolution"],
              ["59%", "fewer crew km"],
              ["56%", "fewer SLA breaches"],
            ].map(([k, v]) => (
              <div key={v} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <dt className="text-2xl font-semibold text-brand-300 sm:text-3xl">{k}</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-ink-400">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- AGENT STRIP ---------- */}
      <section>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">The 7-agent loop</h2>
            <p className="mt-1 text-sm text-ink-600">Each citizen report fires this pipeline in &lt; 10 seconds.</p>
          </div>
          <Link href="/agents" className="btn-ghost hidden sm:inline-flex">
            See it live <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {AGENTS.map((a, i) => (
            <div
              key={a.name}
              className="card p-4 animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <a.icon className="h-4.5 w-4.5" strokeWidth={2.25} />
              </div>
              <div className="mt-3 text-xs font-mono text-ink-400">0{i + 1}</div>
              <div className="mt-1 text-sm font-semibold text-ink-900">{a.name}</div>
              <div className="mt-1 text-xs text-ink-600">{a.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- FEATURE GRID ---------- */}
      <section>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Explore the platform</h2>
          <p className="mt-1 text-sm text-ink-600">Every surface a judge needs to see, in one click.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((f, i) => (
            <Link
              key={f.href}
              href={f.href}
              className="card-glow group block p-6 animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-white">
                <f.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-base font-semibold text-ink-900">{f.title}</div>
                <ArrowRight className="h-4 w-4 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </div>
              <p className="mt-1 text-sm text-ink-600">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
