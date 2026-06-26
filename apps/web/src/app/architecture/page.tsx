"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Award,
  Brain,
  Camera,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  FileCode2,
  Flame,
  GitBranch,
  Globe2,
  Languages,
  Layers,
  Link2,
  Map as MapIcon,
  MapPin,
  Network,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";

import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";

const AGENTS = [
  { n: 1, icon: Eye,          name: "Vision",       model: "Gemini 2.5 Flash",     job: "Classify photo → type + severity + confidence" },
  { n: 2, icon: GitBranch,    name: "Dedup",        model: "PostGIS + pgvector",   job: "Merge duplicates within 50m radius" },
  { n: 3, icon: Brain,        name: "Triage",       model: "Claude Haiku 4.5",     job: "Route to BBMP/BWSSB/BESCOM with SLA" },
  { n: 4, icon: CheckCircle2, name: "Verification", model: "Push + gamified XP",   job: "Nearby citizens confirm → status VERIFIED" },
  { n: 5, icon: Cpu,          name: "Scheduler",    model: "Google OR-Tools",      job: "MILP CVRPTW → optimal crew dispatch" },
  { n: 6, icon: Wrench,       name: "Resolution",   model: "CLIP + custom CNN",    job: "2-layer audit on after-photo" },
  { n: 7, icon: TrendingUp,   name: "Insights",     model: "LightGBM/HistGB",       job: "Predict next-30-day hotspots" },
];

const HERO_STATS = [
  { value: 89.5, suffix: "%", label: "MILP km reduction on real BBMP data" },
  { value: 17481, suffix: "",  label: "Real BBMP issues ingested" },
  { value: 16,   suffix: "/16", label: "Injection attempts caught by gate" },
  { value: 0.871,suffix: "",    label: "R² on real rainfall + complaints panel", precise: true },
];

const TECH_STACK = [
  { layer: "Frontend",       items: ["Next.js 14", "Tailwind", "Framer Motion", "Mapbox GL", "lucide-react"] },
  { layer: "Backend",         items: ["FastAPI", "SQLAlchemy 2", "Alembic", "Pydantic"] },
  { layer: "Database",        items: ["PostgreSQL 16", "PostGIS", "pgvector (optional)", "pg_trgm"] },
  { layer: "Agents · LLM",    items: ["LangGraph", "Claude Haiku 4.5", "Gemini 2.5 Flash"] },
  { layer: "Vision",          items: ["Gemini 2.5 Flash", "CLIP ViT-B/32", "Custom pothole CNN (24k params)"] },
  { layer: "Optimization",    items: ["Google OR-Tools", "CVRPTW + skill match", "Severity-weighted lateness"] },
  { layer: "Predictive",      items: ["scikit-learn HistGradientBoosting", "Real rainfall panel (14,580 rows)"] },
  { layer: "Geo",             items: ["EXIF GPS (pillow-heif HEIC)", "Nominatim geocoder", "243 KGIS ward polygons"] },
  { layer: "i18n",            items: ["Gemini build-time (en→kn,hi)", "Gemini runtime cache (notifications)"] },
  { layer: "Blockchain",      items: ["Polygon Amoy testnet", "AuditAnchor.sol (Merkle)", "CivicBadge.sol (soulbound ERC-721)"] },
  { layer: "Real-time",       items: ["Server-Sent Events", "Cloud Tasks (planned)"] },
  { layer: "Infra",           items: ["Docker compose", "postgis/postgis:16-3.4", "Supabase Storage"] },
];

const DATA = [
  { count: 126980, label: "BBMP grievances aggregated",  src: "OpenCity / Janaagraha H1-2025" },
  { count: 243,    label: "Real KGIS ward polygons",     src: "DataMeet Municipal_Spatial_Data" },
  { count: 19194,  label: "Open backlog distributed",    src: "Per-ward, per-category" },
  { count: 14580,  label: "Rainfall × ward panel rows",  src: "Bengaluru 2021-2025, 60 months" },
  { count: 106,    label: "Adversarial routing fixtures", src: "Kannada/Hindi/Tamil + injection" },
  { count: 23938,  label: "CNN params (pothole defect)",  src: "92% test acc, real photos" },
];

export default function ArchitecturePage() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-16">

      {/* ----------------- HERO ----------------- */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-gradient px-6 py-14 text-white">
        <div className="absolute inset-0 bg-mesh opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-4xl text-center">
          <Pill tone="brand" className="bg-white/10 text-brand-200 ring-white/10">
            <FileCode2 className="h-3.5 w-3.5" /> System architecture
          </Pill>
          <h1 className="mt-4 text-3xl font-semibold tracking-tightest sm:text-5xl">
            How NagarikAI works
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-300 sm:text-base">
            One citizen photo flows through <strong>7 specialized agents</strong>, three
            deterministic gates, an <strong>MILP solver</strong>, a 2-layer closure audit,
            and a public on-chain anchor — in under ten seconds. Every layer is
            validated on real Bengaluru BBMP data.
          </p>
        </div>

        <Stagger delay={0.3} step={0.08} className="relative mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 text-center sm:grid-cols-4">
          {HERO_STATS.map((s) => (
            <Reveal key={s.label}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="text-2xl font-semibold text-brand-300 sm:text-3xl">
                  {s.precise
                    ? s.value.toFixed(3)
                    : <Counter to={s.value} suffix={s.suffix} />}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-ink-400">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </Stagger>
      </section>

      {/* ----------------- CITIZEN FLOW ----------------- */}
      <Section icon={Camera} title="The citizen flow" subtitle="What happens from photo to fix">
        <div className="grid gap-3 sm:grid-cols-7">
          {[
            { ic: Camera,       label: "Snap + GPS",      sub: "/report" },
            { ic: ArrowRight,   label: "",                sub: "" },
            { ic: Network,      label: "7-agent loop",    sub: "< 10s" },
            { ic: ArrowRight,   label: "",                sub: "" },
            { ic: Truck,        label: "MILP dispatch",   sub: "OR-Tools" },
            { ic: ArrowRight,   label: "",                sub: "" },
            { ic: CheckCircle2, label: "Closure audit",   sub: "CLIP + CNN" },
          ].map((s, i) => (
            <div key={i} className={`flex items-center justify-center ${s.label ? "card p-4 text-center" : ""}`}>
              <div>
                <s.ic className={`mx-auto ${s.label ? "h-6 w-6 text-brand-600" : "h-5 w-5 text-ink-300"}`} />
                {s.label && <div className="mt-2 text-xs font-semibold text-ink-900">{s.label}</div>}
                {s.sub && <div className="font-mono text-[10px] text-ink-500">{s.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ----------------- 7 AGENTS ----------------- */}
      <Section icon={Network} title="The 7-agent LangGraph loop" subtitle="Each agent isolates a single concern. Failure of one doesn't kill the loop.">
        <Stagger step={0.04} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {AGENTS.map((a) => (
            <Reveal key={a.n}>
              <motion.div whileHover={{ y: -3 }} className="card h-full p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <a.icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span className="font-mono text-xs text-ink-400">0{a.n}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-ink-900">{a.name}</div>
                <div className="mt-1 text-[11px] text-brand-700">{a.model}</div>
                <p className="mt-2 text-xs text-ink-600">{a.job}</p>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
        <div className="mt-4 text-center text-xs text-ink-500">
          <Pill tone="ink">SSE-streamed</Pill>{" "}
          live to <code className="font-mono text-ink-700">/agents?issue=&lt;id&gt;</code>{" "}
          with per-step latency and gate verdicts.
        </div>
      </Section>

      {/* ----------------- 3-STAGE TRIAGE ----------------- */}
      <Section icon={ShieldCheck} title="3-stage triage: model proposes, gate decides" subtitle="The most defensive part of the system">
        <div className="grid gap-4 lg:grid-cols-3">
          <StageCard
            n="1"
            title="LLM proposes"
            chip="Claude Haiku 4.5"
            tone="blue"
            bullets={[
              "Tool-use with strict JSON schema (enum allowlists)",
              "Hard-coded system message, citizen text wrapped in <citizen_report>",
              "Temperature 0.1, max_tokens 400",
            ]}
          />
          <StageCard
            n="2"
            title="Routing gate"
            chip="guardrails.py"
            tone="brand"
            bullets={[
              "Type ∈ allowlist · Department ∈ allowlist",
              "Type↔Department matches canonical SOP",
              "SLA bounds [1, 720h] · severity bounds [1,5]",
              "PII scrub (phone/email/Aadhaar) · injection markers",
              "Any failure → SOP fallback. Always.",
            ]}
          />
          <StageCard
            n="3"
            title="Severity gate"
            chip="severity_gate.py"
            tone="amber"
            bullets={[
              "3 votes: Vision (photo) · LLM (text) · SOP baseline",
              "Vision wins when confidence ≥ 0.70",
              "LLM may ESCALATE (school zone, dialysis) — never de-escalate",
              "SLA halved when severity ≥ 4",
            ]}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-center">
          <NumberCard value="101/106" label="LLM accepted (94%)" tone="brand" />
          <NumberCard value="5/106"   label="Gate overrode misroute" tone="amber" />
          <NumberCard value="0/16"    label="Injection slipped past Claude" tone="brand" />
        </div>
      </Section>

      {/* ----------------- MILP ----------------- */}
      <Section icon={Cpu} title="MILP scheduler" subtitle="Capacitated VRP with Time Windows + Skill Matching — the math behind crew dispatch">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="card p-6">
            <pre className="overflow-auto rounded-xl bg-ink-950 p-4 font-mono text-[12px] leading-relaxed text-brand-200">
{`minimize  α · Σ wᵢ · max(0, tᵢ - SLAᵢ)        ← severity-weighted lateness
        + β · Σ dᵢⱼ · xᵢⱼₖ                    ← travel km
        + γ · Σ wᵢ · uᵢ                       ← unserved penalty

x_ijk ∈ {0,1}    crew k traverses arc i→j
y_ik  ∈ {0,1}    issue i served by crew k
t_ik  ≥ 0        arrival time at i

subject to:  each issue served ≤ 1 time
             crew skill matches issue type
             crew daily capacity respected
             time windows respected
             flow conservation`}
            </pre>
          </div>
          <div className="space-y-3">
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wider text-ink-500">Solver</div>
              <div className="mt-1 text-base font-semibold">Google OR-Tools</div>
              <div className="mt-1 text-xs text-ink-600">Path-Cheapest-Arc + Guided Local Search · 15s cap · solves 200×10 in ~8s</div>
            </div>
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wider text-ink-500">Backtest on real BBMP</div>
              <table className="mt-2 w-full text-xs">
                <thead className="text-ink-500">
                  <tr><th className="text-left">load</th><th className="text-right">FIFO km</th><th className="text-right">MILP km</th><th className="text-right">Δ</th></tr>
                </thead>
                <tbody className="font-mono text-ink-900">
                  <tr><td>120 / 12</td><td className="text-right">874</td><td className="text-right">52</td><td className="text-right text-brand-700">−94%</td></tr>
                  <tr><td>250 / 12</td><td className="text-right">1,509</td><td className="text-right">104</td><td className="text-right text-brand-700">−93%</td></tr>
                  <tr><td>800 / 12</td><td className="text-right">1,019</td><td className="text-right">107</td><td className="text-right text-brand-700">−89.5%</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      {/* ----------------- LOCATION ----------------- */}
      <Section icon={MapPin} title="Location resolver — 4-tier priority" subtitle="How the agent always knows where the report is">
        <div className="grid gap-3 lg:grid-cols-4">
          {[
            { n: 1, title: "EXIF GPS",        sub: "From the photo itself (JPEG + HEIC via pillow-heif)", chip: "Most truthful" },
            { n: 2, title: "Browser GPS",     sub: "navigator.geolocation submitted by /report",          chip: "Cross-checked" },
            { n: 3, title: "Geocoder",        sub: "OSM Nominatim, Bengaluru viewbox-biased",             chip: "Free fallback" },
            { n: 4, title: "Unknown",         sub: "Surfaced to /ops/flagged for human review",           chip: "Never silent" },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 text-xs">
                <Pill tone={i === 0 ? "brand" : i === 3 ? "rose" : "amber"}>{s.n}</Pill>
                <Pill tone="ink">{s.chip}</Pill>
              </div>
              <div className="mt-2 text-sm font-semibold text-ink-900">{s.title}</div>
              <div className="mt-1 text-xs text-ink-600">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-ink-200 bg-ink-50 p-4 text-xs text-ink-700">
          <strong>Cross-check rule:</strong> if EXIF and browser GPS disagree by more
          than 5 km the report is <Pill tone="rose">flagged_for_review</Pill> and the
          operator picks at <code className="font-mono">/ops/flagged</code>. Whatever
          coordinate wins, we do point-in-polygon against the <strong>243 real KGIS
          BBMP ward polygons</strong> to set <code className="font-mono">Issue.ward</code>.
        </div>
      </Section>

      {/* ----------------- CLOSURE AUDIT ----------------- */}
      <Section icon={ShieldCheck} title="Closure verification — the trust differentiator" subtitle="2-layer audit on every after-photo">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-brand-600" />
              <span className="text-sm font-semibold">Layer 1 — Scene similarity</span>
            </div>
            <p className="mt-2 text-xs text-ink-600">
              CLIP ViT-B/32 cosine between before & after photos. Catches photo swaps —
              the crew can't post a different street and mark the issue resolved.
            </p>
            <div className="mt-3 font-mono text-xs text-ink-500">sim &lt; 0.40 → rejected_photo_swap</div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-brand-600" />
              <span className="text-sm font-semibold">Layer 2 — Defect CNN</span>
            </div>
            <p className="mt-2 text-xs text-ink-600">
              24,938-parameter pothole detector trained from scratch (~92% test acc).
              Catches "same hole reposted" — crew photographs the unrepaired pothole;
              CNN sees it's still defective.
            </p>
            <div className="mt-3 font-mono text-xs text-ink-500">
              p(defect) ≥ 0.55 → rejected_still_defective<br/>
              0.30 ≤ p &lt; 0.55 → needs_review<br/>
              p &lt; 0.30        → verified_resolved
            </div>
          </div>
        </div>
      </Section>

      {/* ----------------- i18n ----------------- */}
      <Section icon={Languages} title="Two-layer i18n (Gemini)" subtitle="Build-time for UI, runtime cached for dynamic notifications">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-brand-600" />
              <span className="text-sm font-semibold">Build-time</span>
            </div>
            <p className="mt-2 text-xs text-ink-600">
              <code className="font-mono">scripts/translate_ui.py</code> → Gemini 2.5
              Flash translates <code>en.json</code> (64 strings) to <code>kn.json</code>{" "}
              + <code>hi.json</code> in one call per language. Ships as static assets.
            </p>
            <div className="mt-3 flex gap-2 text-xs">
              <Pill tone="brand">EN</Pill>
              <Pill tone="brand">हि (Hindi)</Pill>
              <Pill tone="brand">ಕ (Kannada)</Pill>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-semibold">Runtime</span>
            </div>
            <p className="mt-2 text-xs text-ink-600">
              <code className="font-mono">nagarik/i18n_runtime.py</code> batches
              notification title+body in ONE call to Gemini with an LRU cache.
              Steady-state cost: 0 LLM calls after the first hit per language.
            </p>
            <div className="mt-3 font-mono text-[11px] text-ink-600">
              cache: ~16 entries · Gemini primary · Claude fallback on 429
            </div>
          </div>
        </div>
      </Section>

      {/* ----------------- BLOCKCHAIN ----------------- */}
      <Section icon={Link2} title="On-chain transparency (opt-in)" subtitle="Polygon Amoy testnet — public proofs anyone can verify">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              <span className="text-sm font-semibold">AuditAnchor.sol</span>
            </div>
            <p className="mt-2 text-xs text-ink-600">
              Append-only registry of Merkle roots. Every batch of AgentEvents gets
              SHA-256 leaf-hashed; the Merkle root lands on chain. Any auditor can
              verify a past agent decision happened, when, and unchanged.
            </p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-brand-600" />
              <span className="text-sm font-semibold">CivicBadge.sol — soulbound ERC-721</span>
            </div>
            <p className="mt-2 text-xs text-ink-600">
              All transfers + approvals revert. Citizens earn badges at XP milestones
              (Reporter 100 / Verifier 250 / Watchdog 500 / Sentinel 1k / Hero 2.5k).
              Tied to a deterministic phone-derived wallet.
            </p>
          </div>
        </div>
      </Section>

      {/* ----------------- DATA PROVENANCE ----------------- */}
      <Section icon={Database} title="Real data, not synthetic" subtitle="Every number in this app traces to a real source">
        <Stagger step={0.04} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DATA.map((d) => (
            <Reveal key={d.label}>
              <div className="card p-4">
                <div className="font-mono text-2xl font-semibold text-brand-700">
                  <Counter to={d.count} />
                </div>
                <div className="mt-1 text-sm text-ink-900">{d.label}</div>
                <div className="mt-0.5 text-[11px] text-ink-500">{d.src}</div>
              </div>
            </Reveal>
          ))}
        </Stagger>
      </Section>

      {/* ----------------- TECH STACK ----------------- */}
      <Section icon={Layers} title="Tech stack" subtitle="Every layer of the system">
        <Stagger step={0.03} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TECH_STACK.map((g) => (
            <Reveal key={g.layer}>
              <div className="card p-4">
                <div className="text-xs uppercase tracking-wider text-ink-500">{g.layer}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.items.map((x) => (
                    <span key={x} className="rounded-lg bg-ink-100 px-2 py-0.5 text-[11px] font-mono text-ink-700">{x}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </Stagger>
      </Section>

      {/* ----------------- ROUTES INDEX ----------------- */}
      <Section icon={Globe2} title="Routes you can hit right now">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { p: "/report",       d: "Citizen reports a civic issue (now in EN/HI/KN)" },
            { p: "/tracking/[id]", d: "Citizen-facing live status timeline" },
            { p: "/map",          d: "17k real issues + KGIS wards + LightGBM hotspots" },
            { p: "/agents",       d: "SSE-streamed 7-agent pipeline with RoutingCard" },
            { p: "/milp",         d: "Solve & visualize · Compare vs FIFO" },
            { p: "/dashboard",    d: "Ward-level throughput + resolution rate" },
            { p: "/impact",       d: "Citizen leaderboard (links to /wallet)" },
            { p: "/wallet/[id]",  d: "Soulbound NFT badges + Polygonscan link" },
            { p: "/chain",        d: "Anchor batches to Polygon Amoy live" },
            { p: "/ops/flagged",  d: "Operator audit — location mismatches" },
            { p: "/crew/[id]",    d: "Crew app — today's MILP route + after-photo" },
            { p: "/architecture", d: "This page" },
          ].map((r) => (
            <div key={r.p} className="card flex items-start gap-3 p-3">
              <Radio className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <div>
                <div className="font-mono text-xs text-ink-900">{r.p}</div>
                <div className="mt-0.5 text-xs text-ink-600">{r.d}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="border-t border-ink-200 pt-8 text-center text-xs text-ink-500">
        Built for the Coding Ninjas Community Hero challenge. All implementation
        provenance documented in <code className="font-mono">docs/PITCH.md</code>,
        <code className="font-mono"> docs/REAL_DATA.md</code>,
        <code className="font-mono"> docs/INBOUND_CHANNELS.md</code>.
      </div>
    </motion.div>
  );
}

/* ---------- helpers ---------- */

function Section({
  icon: Icon, title, subtitle, children,
}: { icon: typeof Eye; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink-900 text-white">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-sm text-ink-600">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function StageCard({
  n, title, chip, tone, bullets,
}: { n: string; title: string; chip: string; tone: "blue" | "brand" | "amber"; bullets: string[] }) {
  const border =
    tone === "brand" ? "border-brand-200 bg-brand-50/40" :
    tone === "amber" ? "border-amber-200 bg-amber-50/40" :
    "border-blue-200 bg-blue-50/40";
  return (
    <div className={`rounded-2xl border p-5 ${border}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-500">
        Stage {n}
      </div>
      <div className="mt-1 text-lg font-semibold text-ink-900">{title}</div>
      <Pill tone={tone === "blue" ? "blue" : tone} className="mt-1">{chip}</Pill>
      <ul className="mt-3 space-y-1.5 text-xs text-ink-700">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NumberCard({ value, label, tone }: { value: string; label: string; tone: "brand" | "amber" | "rose" }) {
  const ring =
    tone === "brand" ? "ring-brand-200 bg-brand-50/40 text-brand-700" :
    tone === "amber" ? "ring-amber-200 bg-amber-50/40 text-amber-700" :
    "ring-rose-200 bg-rose-50/40 text-rose-700";
  return (
    <div className={`rounded-2xl p-4 ring-1 ring-inset ${ring}`}>
      <div className="font-mono text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-ink-600">{label}</div>
    </div>
  );
}
