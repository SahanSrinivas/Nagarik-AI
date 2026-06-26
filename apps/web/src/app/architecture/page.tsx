"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Building2,
  Camera,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  FileCode2,
  GitBranch,
  Layers,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Siren,
  Sparkles,
  TrendingUp,
  Webhook,
  Wrench,
} from "lucide-react";

import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";

/**
 * Architecture page — trimmed down to the essentials. The earlier version
 * had 12 sections and overwhelmed first-time viewers. This one is a
 * scannable single-screen story for non-engineers + one deep tech-stack
 * card for engineers.
 *
 * Anything not on this page is still in the codebase + docs/ARCHITECTURE.md.
 */

const AGENTS = [
  { n: 1, icon: Eye,          name: "Vision",       model: "Gemini 2.5 Flash",
    desc: "Reads your photo → identifies what's wrong (pothole? streetlight? sewage?), how bad it is (severity 1-5), and how confident the model is." },
  { n: 2, icon: GitBranch,    name: "Dedup",        model: "PostGIS",
    desc: "Checks if anyone within 50 metres already reported the same thing. If yes, merges into that ticket so the crew isn't sent twice." },
  { n: 3, icon: Brain,        name: "Triage",       model: "Claude Haiku 4.5 + guardrails",
    desc: "The LLM proposes which department to route to. A deterministic SOP table verifies the proposal — every disagreement is logged and the safe default wins." },
  { n: 4, icon: CheckCircle2, name: "Verification", model: "Community + XP",
    desc: "Notifies the 5 nearest citizens. After 3 confirmations, status is promoted to VERIFIED and the dispatcher picks it up." },
  { n: 5, icon: Cpu,          name: "Scheduler",    model: "Google OR-Tools (MILP)",
    desc: "THIS is the math. Re-solves the entire crew dispatch problem for tomorrow each time a new issue arrives — picks crews + stop order to minimize severity-weighted delays + km driven." },
  { n: 6, icon: Wrench,       name: "Resolution",   model: "CLIP + custom CNN",
    desc: "When the crew uploads an after-photo, two layers audit it: CLIP confirms same location, the pothole CNN confirms it's actually fixed. Catches fake closures." },
  { n: 7, icon: TrendingUp,   name: "Insights",     model: "HistGradientBoosting",
    desc: "Feeds the rainfall × ward panel that predicts next-30-day hotspots. Lets dispatchers pre-position crews before complaints flood in." },
];

const STATS = [
  { value: 89.5,  suffix: "%",  label: "Fewer km driven by crews" },
  { value: 17481, suffix: "",   label: "Real BBMP issues loaded" },
  { value: 16,    suffix: "/16", label: "Injection attempts blocked" },
  { value: 0.871, suffix: "",    label: "Rainfall-model R²", precise: true },
];

const STACK = [
  { layer: "Frontend",   items: "Next.js 14 · Tailwind · Framer Motion · Mapbox GL" },
  { layer: "Backend",    items: "FastAPI · SQLAlchemy 2 · LangGraph · Alembic" },
  { layer: "Database",   items: "PostgreSQL 16 + PostGIS + pgvector" },
  { layer: "AI",         items: "Gemini 2.5 Flash · Claude Haiku 4.5 · CLIP · pothole CNN" },
  { layer: "Math",       items: "Google OR-Tools (MILP CVRPTW) · sklearn HistGradientBoosting" },
  { layer: "Auth",       items: "JWT HS256 · PBKDF2-SHA256 (200k iters) · slowapi rate limit" },
  { layer: "Geo",        items: "EXIF GPS (HEIC) · Nominatim · 243 KGIS ward polygons" },
  { layer: "i18n",       items: "Gemini build-time + runtime cache (EN · हि · ಕ)" },
  { layer: "Chain",      items: "Polygon Amoy · AuditAnchor.sol · CivicBadge soulbound ERC-721" },
];

export default function ArchitecturePage() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-gradient px-6 py-12 text-white">
        <div className="absolute inset-0 bg-mesh opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-3xl text-center">
          <Pill tone="brand" className="bg-white/10 text-brand-200 ring-white/10">
            <FileCode2 className="h-3.5 w-3.5" /> Architecture
          </Pill>
          <h1 className="mt-3 text-3xl font-semibold tracking-tightest sm:text-4xl">
            One photo. Seven agents. Under ten seconds.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-ink-300 sm:text-lg">
            A citizen reports a civic issue. Specialised AI agents classify, dedup, route,
            verify, schedule (MILP), audit the fix, and forecast tomorrow's hotspots. Every
            agent's decision is auditable; an LLM never makes a load-bearing call without a
            deterministic gate verifying it.
          </p>
          <Stagger step={0.07} className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {STATS.map((s) => (
              <Reveal key={s.label}>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                  <div className="text-2xl font-semibold text-brand-300">
                    {s.precise ? s.value.toFixed(3) : <Counter to={s.value} suffix={s.suffix} />}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-ink-400">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CITIZEN FLOW */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold tracking-tight">The citizen flow, end-to-end</h2>
        <p className="mt-2 text-base text-ink-600 sm:text-lg">What happens between &ldquo;snap a photo&rdquo; and &ldquo;crew shows up&rdquo;.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {[
            { ic: Camera,       k: "1 · Report",   sub: "/report — photo + tap" },
            { ic: ArrowRight,   k: "", sub: "" },
            { ic: Brain,        k: "2 · 7-agent loop", sub: "Vision → Dedup → Triage → Verify → MILP → Audit → Predict" },
            { ic: ArrowRight,   k: "", sub: "" },
            { ic: CheckCircle2, k: "3 · Resolved",  sub: "Tracked live, +XP awarded" },
          ].map((s, i) => (
            <div key={i} className={`text-center ${s.k ? "rounded-xl border p-3" : "self-center"}`}
                 style={s.k ? { borderColor: "rgb(var(--border-light))" } : undefined}>
              <s.ic className={`mx-auto ${s.k ? "h-5 w-5" : "h-4 w-4"}`}
                style={{ color: s.k ? "rgb(var(--accent))" : "rgb(var(--text-muted))" }} />
              {s.k && <div className="mt-2 text-sm font-semibold">{s.k}</div>}
              {s.sub && <div className="mt-0.5 text-xs text-ink-500">{s.sub}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* 7 AGENTS */}
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">The 7 agents</h2>
        <Stagger step={0.05} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => (
            <Reveal key={a.n}>
              <motion.div whileHover={{ y: -3 }} className="card h-full p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl text-white"
                    style={{ background: "rgb(var(--accent))" }}>
                    <a.icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span className="font-mono text-xs text-ink-400">0{a.n}</span>
                </div>
                <div className="mt-3 text-base font-semibold">{a.name}</div>
                <div className="mt-0.5 text-xs font-medium text-brand-700">{a.model}</div>
                <p className="mt-2 text-sm text-ink-600">{a.desc}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* MILP DEEP DIVE — the most-misunderstood agent */}
      <section className="card p-6">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
          <h2 className="text-lg font-semibold tracking-tight">How MILP actually solves dispatch</h2>
        </div>
        <p className="mt-2 text-base text-ink-600 sm:text-lg">
          The single most important agent — and the easiest to misunderstand.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3 text-base text-ink-700">
            <p>
              At any moment Bengaluru has hundreds of open civic issues and a dozen BBMP
              crews. The naive answer is FIFO — assign each new issue to the first crew with
              capacity, ignore the map. That's how dispatch works today.
            </p>
            <p>
              <strong>MILP rearranges the day every time a new issue lands.</strong> It picks
              which crew visits which issues in what order, weighing the cost of:
            </p>
            <ul className="ml-5 list-disc space-y-1 text-sm">
              <li><strong>Severity × lateness</strong> — a sev-5 sewage overflow is penalised 5× more than a sev-1 garbage report when running past SLA</li>
              <li><strong>Total km driven</strong> — bunches geographically close stops into one route</li>
              <li><strong>Unserved issues</strong> — pays a heavy penalty for tickets the day can't fit</li>
            </ul>
            <p>
              Subject to: each crew's skill (Roads ≠ Water), capacity (~10 stops/day), and
              shift hours. Solver: <strong>Google OR-Tools</strong>, branch-and-cut + guided
              local search, 15-second cap.
            </p>
            <p className="text-sm italic text-ink-600">
              That's why your Hongasandra report showed{" "}
              <code className="font-mono">scheduled_for: ('7cae7e1c…', 0)</code> — crew 7cae,
              <strong> stop position 0</strong>. The MILP literally moved your high-severity
              issue to the front of the crew's day.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "rgb(var(--border-light))" }}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>Real BBMP backtest</div>
            <table className="mt-2 w-full text-sm">
              <thead className="text-ink-500">
                <tr><th className="text-left">Load</th><th className="text-right">FIFO km</th><th className="text-right">MILP km</th><th className="text-right">Δ</th></tr>
              </thead>
              <tbody className="font-mono">
                <tr><td>120 / 12 crews</td><td className="text-right">874</td><td className="text-right">52</td><td className="text-right text-brand-700">−94%</td></tr>
                <tr><td>250 / 12 crews</td><td className="text-right">1,509</td><td className="text-right">104</td><td className="text-right text-brand-700">−93%</td></tr>
                <tr><td>800 / 12 crews</td><td className="text-right">1,019</td><td className="text-right">107</td><td className="text-right text-brand-700">−89.5%</td></tr>
              </tbody>
            </table>
            <div className="mt-3 text-xs text-ink-500">
              Same crews, same budget, smarter ordering. Reproducible via
              <code className="font-mono"> scripts/run_real_backtest.py</code>.
            </div>
          </div>
        </div>
      </section>

      {/* PREDICTIVE INSIGHTS DEEP DIVE */}
      <section className="card p-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
          <h2 className="text-lg font-semibold tracking-tight">Predictive insights — forecasting tomorrow's hotspots</h2>
        </div>
        <p className="mt-2 text-base text-ink-600 sm:text-lg">
          What the 7th agent feeds, and how it closes the loop back to MILP.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3 text-base text-ink-700">
            <p>
              Every report logged into a panel of <strong>ward × month × rainfall_mm ×
              rainfall_lag1</strong>. We trained a HistGradientBoosting regressor on{" "}
              <strong>14,580 real ward-months</strong> of Bengaluru data (2021–2025):
            </p>
            <pre className="overflow-auto rounded-xl bg-ink-950 p-4 font-mono text-sm text-brand-200">
{`log(road_complaints + 1) ~
   ward_FE + month_FE + rainfall_mm + rainfall_mm_lag1`}
            </pre>
            <p>
              In plain words: <em>given a ward, the calendar month, today's rainfall and last
              month's rainfall, how many pothole complaints will this ward see next month?</em>
            </p>
            <p>
              The model hits <strong>R² = 0.871 on the 2025 hold-out year</strong>. The map's
              hotspot heatmap is its output — wards in red are predicted to spike, so the
              dispatcher pre-positions crews there instead of waiting for the citizen flood.
            </p>
            <p className="text-sm italic text-ink-600">
              Closes the loop: <strong>your report</strong> nudges its ward's count up →{" "}
              <strong>predictor</strong> raises the heatmap there → <strong>MILP</strong> weights
              that ward heavier in tomorrow's solve — even before more reports come in.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "rgb(var(--border-light))" }}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>What feeds the model</div>
            <ul className="mt-2 space-y-2 text-sm">
              <li><strong>14,580</strong> ward-month observations (real)</li>
              <li><strong>60</strong> months of Bengaluru rainfall (real IMD-style panel)</li>
              <li><strong>243</strong> KGIS ward polygons</li>
              <li>Every new report appended live by the Insights agent</li>
            </ul>
            <div className="mt-3 text-xs text-ink-500">
              Reproducible via <code className="font-mono">scripts/build_hotspots.py</code> →
              writes <code className="font-mono">data/processed/hotspots.geojson</code>{" "}
              consumed by <code className="font-mono">/map</code>.
            </div>
          </div>
        </div>
      </section>

      {/* HUB-AND-SPOKE — how a triaged ticket actually reaches BBMP */}
      <section className="card p-6">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
          <h2 className="text-lg font-semibold tracking-tight">
            Hub &amp; spoke — how a ticket leaves NagarikAI
          </h2>
        </div>
        <p className="mt-2 text-base text-ink-600 sm:text-lg">
          We aren&apos;t a parallel BBMP. NagarikAI is the citizen front door + AI triage; each
          department keeps using whatever software they already have. Once Triage picks a
          department, <code className="font-mono">delivery.py</code> pushes the ticket
          out via that department&apos;s preferred channel. The supervisor dashboard is the
          fallback for departments that don&apos;t have their own system.
        </p>

        {/* ASCII-style hub-and-spoke map */}
        <div className="mt-5 rounded-2xl p-5"
          style={{ background: "rgb(var(--bg-canvas))", border: "1px solid rgb(var(--border-light))" }}>
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_60px_1fr]">
            {/* LEFT — NagarikAI hub */}
            <div className="rounded-xl p-4 text-center"
              style={{ background: "rgba(191, 79, 54, 0.08)", border: "1px solid rgba(191, 79, 54, 0.30)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgb(var(--accent))" }}>The hub (us)</div>
              <div className="mt-1 text-base font-semibold">NagarikAI</div>
              <ul className="mt-2 space-y-1 text-left text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                <li>· Citizen submit (photo / video / location)</li>
                <li>· 7-agent triage loop</li>
                <li>· MILP scheduler</li>
                <li>· delivery.py dispatches to spoke</li>
                <li>· sla_watcher.py escalates on silence</li>
              </ul>
            </div>

            {/* MIDDLE — arrow + channel labels */}
            <div className="flex flex-col items-center justify-center gap-2 py-2">
              <ArrowRight className="hidden h-6 w-6 lg:block" style={{ color: "rgb(var(--text-muted))" }} />
              <div className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgb(var(--text-muted))" }}>
                primary_channel
              </div>
            </div>

            {/* RIGHT — 4 spokes */}
            <div className="grid grid-cols-1 gap-2">
              <SpokeRow icon={MessageCircle} channel="WhatsApp"
                depts="BBMP Roads · BBMP SWM"
                note="AiSensy / Gupshup Business API → supervisor's phone" />
              <SpokeRow icon={Mail} channel="Email"
                depts="BWSSB · BESCOM Streetlight"
                note="SMTP → complaints@ inbox the dept already monitors" />
              <SpokeRow icon={Webhook} channel="Webhook"
                depts="BBMP Horticulture"
                note="POST signed JSON to dept's existing complaint API" />
              <SpokeRow icon={Building2} channel="In-app only"
                depts="BBMP Helpdesk · Town Planning"
                note="No external system — supervisor watches /supervisor" />
            </div>
          </div>
        </div>

        {/* Escalation ladder */}
        <div className="mt-5">
          <div className="flex items-center gap-2">
            <Siren className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
            <h3 className="text-base font-semibold sm:text-lg">Escalation ladder — what happens when the dept goes silent</h3>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Step label="Level 0" body="Nominal. Sent via primary_channel. Acked_at expected within SLA." />
            <Step label="Level 1" body="SLA breached. Re-dispatch to supervisor's personal phone. Citizen notified." tone="amber" />
            <Step label="Level 2" body="24h after L1 with no ack. Ward councillor looped in." tone="amber" />
            <Step label="Level 3" body="72h after L2. RTI auto-draft generated; citizen one-tap-files." tone="red" />
          </div>
          <p className="mt-3 text-sm" style={{ color: "rgb(var(--text-muted))" }}>
            Runs every 60s in <code className="font-mono">apps/api/nagarik/jobs/sla_watcher.py</code>.
            Every state change writes a citizen notification — they always know where their ticket stands.
          </p>
        </div>
      </section>

      {/* TECH STACK */}
      <section className="card p-6">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
          <h2 className="text-lg font-semibold tracking-tight">Tech stack at a glance</h2>
        </div>
        <Stagger step={0.03} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((s) => (
            <Reveal key={s.layer}>
              <div className="rounded-xl border p-4 text-sm"
                style={{ borderColor: "rgb(var(--border-light))" }}>
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--accent))" }}>{s.layer}</div>
                <div className="mt-1 font-mono text-ink-800">{s.items}</div>
              </div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* CTAs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <a href="/agents" className="card-glow block p-5 text-base">
          <Database className="mb-2 h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          <div className="font-semibold">Live agent pipeline</div>
          <div className="mt-1 text-sm text-ink-600">/agents — SSE stream with citizen-friendly cards</div>
        </a>
        <a href="/milp" className="card-glow block p-5 text-base">
          <Cpu className="mb-2 h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          <div className="font-semibold">MILP optimizer</div>
          <div className="mt-1 text-sm text-ink-600">/milp — solve a day · compare vs FIFO</div>
        </a>
        <a href="/test-photos" className="card-glow block p-5 text-base">
          <Sparkles className="mb-2 h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          <div className="font-semibold">Test photos</div>
          <div className="mt-1 text-sm text-ink-600">/test-photos — real pothole pairs + 6 category cards</div>
        </a>
      </div>

      <div className="border-t pt-6 text-center text-sm text-ink-500"
        style={{ borderColor: "rgb(var(--border-light))" }}>
        Built for the Coding Ninjas Community Hero challenge. Full implementation provenance
        in <code className="font-mono">docs/PITCH.md</code>, <code className="font-mono"> REAL_DATA.md</code>,
        and <code className="font-mono"> INBOUND_CHANNELS.md</code>.
      </div>
    </motion.div>
  );
}

/* ─── helpers used by the Hub & Spoke section ─── */

function SpokeRow({ icon: Icon, channel, depts, note }:
  { icon: typeof Send; channel: string; depts: string; note: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl p-3"
      style={{ background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-light))" }}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        style={{ background: "rgba(191, 79, 54, 0.10)", color: "rgb(var(--accent))" }}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">{channel}</span>
          <span className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>→</span>
          <span className="truncate text-xs" style={{ color: "rgb(var(--text-secondary))" }}>{depts}</span>
        </div>
        <div className="mt-1 text-sm" style={{ color: "rgb(var(--text-muted))" }}>{note}</div>
      </div>
    </div>
  );
}

function Step({ label, body, tone = "ink" }:
  { label: string; body: string; tone?: "ink" | "amber" | "red" }) {
  const tones: Record<string, { bg: string; border: string; pill: string }> = {
    ink:   { bg: "rgb(var(--bg-surface))",            border: "rgb(var(--border-light))",       pill: "rgb(var(--text-secondary))" },
    amber: { bg: "rgba(245, 158, 11, 0.08)",          border: "rgba(245, 158, 11, 0.30)",       pill: "#b45309" },
    red:   { bg: "rgba(220, 38, 38, 0.08)",           border: "rgba(220, 38, 38, 0.30)",        pill: "#b91c1c" },
  };
  const t = tones[tone];
  return (
    <div className="rounded-xl p-3" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.pill }}>{label}</div>
      <div className="mt-1.5 text-sm" style={{ color: "rgb(var(--text-primary))" }}>{body}</div>
    </div>
  );
}
