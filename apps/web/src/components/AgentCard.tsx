"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  Code2,
  Cpu,
  Eye,
  GitBranch,
  Send,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Pill } from "@/components/Pill";

interface AgentEvent {
  agent: string;
  status: string;
  payload: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

/**
 * Citizen-friendly renderer for a single AgentEvent.
 *
 * Instead of dumping JSON, each agent gets a hand-tuned card that says in
 * plain language what it just did, with the underlying numbers as small
 * highlights. The raw JSON is still available behind a "show details" toggle
 * for technical viewers.
 */
export function AgentCard({ event }: { event: AgentEvent }) {
  const [showJson, setShowJson] = useState(false);
  const meta = AGENT_META[event.agent] ?? { icon: Cpu, label: event.agent, hint: "" };
  const Icon = meta.icon;
  const p = event.payload || {};
  const dupSkip = isDownstreamDupSkip(event);
  const isStarted = event.status === "started";
  const isFailed = event.status === "failed";

  const tone =
    isFailed ? "rose"
    : isStarted ? "amber"
    : dupSkip ? "ink"
    : "lime";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="card overflow-hidden"
    >
      {/* Header band */}
      <div
        className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-xs"
        style={{
          borderColor: "rgb(var(--border-light))",
          backgroundColor: "rgb(var(--bg-surface-hover))",
        }}
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-lg"
          style={{ background: "rgb(var(--accent))", color: "white" }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="font-semibold text-ink-900">{meta.label}</span>
        <Pill tone={tone}>{event.status}</Pill>
        {event.duration_ms != null && (
          <span className="font-mono text-ink-500">{event.duration_ms}ms</span>
        )}
        <span className="ml-auto text-ink-400">
          {new Date(event.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {isStarted ? (
          <p className="text-sm text-ink-600">{meta.startedCopy ?? "Starting…"}</p>
        ) : dupSkip ? (
          <DupSkipBody payload={p} />
        ) : (
          renderByAgent(event)
        )}
      </div>

      {/* Footer — raw JSON toggle for nerds */}
      <button
        onClick={() => setShowJson((s) => !s)}
        className="flex w-full items-center gap-1.5 border-t px-4 py-2 text-[11px] text-ink-500 hover:bg-surface-hover"
        style={{ borderColor: "rgb(var(--border-light))" }}
      >
        <Code2 className="h-3 w-3" />
        {showJson ? "Hide raw payload" : "Show raw payload"}
        <ChevronDown className={`ml-auto h-3 w-3 transition ${showJson ? "rotate-180" : ""}`} />
      </button>
      {showJson && (
        <pre className="overflow-auto bg-ink-950 p-3 font-mono text-[10px] text-brand-200">
{JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Per-agent renderers — the "humane" view.
 * ────────────────────────────────────────────────────────────────────── */

const AGENT_META: Record<string, { icon: typeof Cpu; label: string; hint: string; startedCopy?: string }> = {
  vision:       { icon: Eye,          label: "Vision",       hint: "Gemini reads the photo",     startedCopy: "Looking at the photo with Gemini…" },
  dedup:        { icon: GitBranch,    label: "Dedup",        hint: "Find lookalikes nearby",     startedCopy: "Searching for nearby duplicates…" },
  triage:       { icon: Brain,        label: "Triage",       hint: "Pick the right department",  startedCopy: "Routing with LLM + SOP gate…" },
  verification: { icon: CheckCircle2, label: "Verification", hint: "Ping nearby neighbours",     startedCopy: "Notifying nearby citizens…" },
  scheduler:    { icon: Cpu,          label: "Scheduler",    hint: "MILP crew dispatch",         startedCopy: "Solving the MILP for tomorrow's routes…" },
  resolution:   { icon: Wrench,       label: "Resolution",   hint: "CLIP + CNN audit the fix",   startedCopy: "Awaiting after-photo for the audit…" },
  insights:     { icon: TrendingUp,   label: "Insights",     hint: "Feed predictive layer",      startedCopy: "Updating the predictor…" },
};

function renderByAgent(e: AgentEvent): ReactNode {
  switch (e.agent) {
    case "vision":       return <VisionBody payload={e.payload} />;
    case "dedup":        return <DedupBody payload={e.payload} />;
    case "triage":       return <TriageBody payload={e.payload} />;
    case "verification": return <VerificationBody payload={e.payload} />;
    case "scheduler":    return <SchedulerBody payload={e.payload} />;
    case "resolution":   return <ResolutionBody payload={e.payload} />;
    case "insights":     return <InsightsBody payload={e.payload} />;
    default:             return <DefaultBody payload={e.payload} />;
  }
}

function VisionBody({ payload }: { payload: Record<string, unknown> }) {
  const ai = (payload.ai_meta || {}) as Record<string, unknown>;
  const t = String(payload.classified_type ?? "unknown");
  const sev = Number(payload.severity ?? 0);
  const conf = Number(payload.ai_confidence ?? 0);
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-800">
        Gemini saw a <strong>{prettyType(t)}</strong>, called it{" "}
        <strong>severity {sev}/5</strong> ({severityWord(sev)}), with{" "}
        <strong>{Math.round(conf * 100)}% confidence</strong>.
      </p>
      {ai.notes ? (
        <blockquote
          className="rounded-lg border-l-4 px-3 py-2 text-xs italic text-ink-700"
          style={{ borderColor: "rgb(var(--accent))", background: "rgb(var(--bg-surface-hover))" }}
        >
          “{String(ai.notes)}”
        </blockquote>
      ) : null}
      <FactGrid
        items={[
          { k: "Width",  v: ai.width_m  != null ? `${ai.width_m} m`   : null },
          { k: "Depth",  v: ai.depth_cm != null ? `${ai.depth_cm} cm` : null },
          { k: "Hazard to", v: ai.hazard_to ? String(ai.hazard_to)    : null },
        ]}
      />
    </div>
  );
}

function DedupBody({ payload }: { payload: Record<string, unknown> }) {
  const dup = payload.is_duplicate === true;
  const dupOf = payload.duplicate_of_id as string | undefined;
  if (dup) {
    return (
      <p className="text-sm text-ink-800">
        Matched an <strong>earlier report</strong> within 50 m of the same type.{" "}
        Merging into ticket <code className="font-mono">{dupOf?.slice(0, 8)}…</code> so the
        crew isn't dispatched twice.
      </p>
    );
  }
  return (
    <p className="text-sm text-ink-800">
      Searched a <strong>50 m radius</strong> for similar issues — none found. This is a{" "}
      <strong>fresh report</strong>, moving to triage.
    </p>
  );
}

function TriageBody({ payload }: { payload: Record<string, unknown> }) {
  const ai = (payload.ai_meta || {}) as Record<string, unknown>;
  const r = (ai.routing || {}) as Record<string, unknown>;
  const final = (r.final || {}) as Record<string, unknown>;
  const llm = (r.llm_proposed || {}) as Record<string, unknown>;
  const sev = (r.severity_verdict || {}) as Record<string, unknown>;
  const dept = String(final.department ?? payload.routed_department ?? "—");
  const sla = Number(final.sla_hours ?? payload.sla_hours ?? 0);
  const verdict = String(r.gate_verdict ?? "accepted");
  const overrode = r.used_sop_fallback === true;

  const llmDept = llm.department ? String(llm.department) : null;
  const llmSla = llm.sla_hours ? Number(llm.sla_hours) : null;
  const slaWasHalved = llmSla != null && llmSla > sla;

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-800">
        Routed to <strong>{dept}</strong>, due in <strong>{sla} hours</strong>.
      </p>
      {r.reasoning ? (
        <p className="text-xs italic text-ink-600">“{String(r.reasoning)}”</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <Pill tone={overrode ? "rose" : "lime"}>
          {overrode ? "Gate overrode the LLM" : "Gate accepted the LLM"}
        </Pill>
        {slaWasHalved && <Pill tone="amber">SLA halved (severity ≥ 4)</Pill>}
        {sev.source ? <Pill tone="ink">severity from {String(sev.source).replace(/_/g, " ")}</Pill> : null}
      </div>
      {llmDept && llmDept !== dept && (
        <p className="text-xs text-ink-600">
          LLM had picked <strong>{llmDept}</strong> — the SOP table caught it and switched to{" "}
          <strong>{dept}</strong>.
        </p>
      )}
    </div>
  );
}

function VerificationBody({ payload }: { payload: Record<string, unknown> }) {
  const n = Number(payload.notified_citizens ?? 0);
  if (n === 0) {
    return (
      <p className="text-sm text-ink-800">
        Looked for nearby citizens to confirm — none registered close enough yet.
      </p>
    );
  }
  return (
    <p className="text-sm text-ink-800">
      Pushed a "Can you confirm?" notification to{" "}
      <strong>{n} {n === 1 ? "citizen" : "citizens"}</strong> in the area. Three confirmations
      will promote the issue to <strong>VERIFIED</strong> and unlock the dispatcher.
    </p>
  );
}

function SchedulerBody({ payload }: { payload: Record<string, unknown> }) {
  const scheduled = payload.scheduled_for as string | null | undefined;
  if (!scheduled || scheduled === "null") {
    return (
      <p className="text-sm text-ink-800">
        MILP solver ran but the issue wasn't picked up this round — no crew with matching
        skills had capacity, or it's queued for the next solve.
      </p>
    );
  }
  // scheduled_for is a serialized tuple like "('crew-uuid', 0)"
  const match = scheduled.match(/'([^']+)'\s*,\s*(\d+)/);
  const crew = match?.[1]?.slice(0, 8);
  const slot = match?.[2];
  return (
    <p className="text-sm text-ink-800">
      MILP CVRPTW solver picked the optimal assignment. Going to crew{" "}
      <code className="font-mono">{crew ?? "—"}…</code>, stop number{" "}
      <strong>{slot != null ? Number(slot) + 1 : "?"}</strong> on their route.
    </p>
  );
}

function ResolutionBody({ payload }: { payload: Record<string, unknown> }) {
  const sim = Number(payload.resolution_similarity ?? 0);
  if (sim === 0) {
    return (
      <p className="text-sm text-ink-800">
        Waiting for the crew's <strong>after-photo</strong>. When it lands we'll run
        CLIP scene-match + the pothole CNN to verify the fix is real (and not the same
        unrepaired pothole re-photographed).
      </p>
    );
  }
  return (
    <p className="text-sm text-ink-800">
      Audit complete. CLIP scene similarity{" "}
      <strong>{Math.round(sim * 100)}%</strong> — close enough to confirm same location.
      Verdict on the CNN check is in the routing card.
    </p>
  );
}

function InsightsBody({ payload }: { payload: Record<string, unknown> }) {
  const contrib = payload.contributes_to_prediction === true;
  return (
    <p className="text-sm text-ink-800">
      {contrib
        ? "This report is now part of the predictive model — it'll nudge the next-30-day hotspot heatmap shown on /map."
        : "Skipped the predictor (issue was rejected or out of scope)."}
    </p>
  );
}

function DefaultBody({ payload }: { payload: Record<string, unknown> }) {
  const keys = Object.keys(payload).length;
  return <p className="text-sm text-ink-600">Agent completed. {keys} payload fields.</p>;
}

function DupSkipBody({ payload }: { payload: Record<string, unknown> }) {
  const dupOf = payload.duplicate_of_id as string | undefined;
  return (
    <div className="flex items-start gap-2 text-sm text-ink-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
      <span>
        Skipped — this report was deduplicated into ticket{" "}
        <code className="font-mono">{dupOf?.slice(0, 8)}…</code>.{" "}
        Each downstream agent intentionally short-circuits when an issue is a duplicate so we
        don't double-dispatch or double-notify.
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────── */

function isDownstreamDupSkip(e: AgentEvent): boolean {
  if (e.status !== "completed") return false;
  if (!["triage", "verification", "scheduler", "resolution", "insights"].includes(e.agent)) return false;
  return (e.payload as Record<string, unknown>).is_duplicate === true;
}

function prettyType(t: string): string {
  return {
    pothole: "pothole",
    garbage: "garbage / waste",
    streetlight: "broken streetlight",
    water_leak: "water leak",
    sewage: "sewage / drain issue",
    tree_fall: "fallen tree",
    encroachment: "encroachment",
    other: "civic issue",
  }[t] || t;
}

function severityWord(s: number): string {
  return ["", "minor", "low", "moderate", "high", "critical"][s] || "unknown";
}

function FactGrid({ items }: { items: { k: string; v: string | null }[] }) {
  const filled = items.filter((i) => i.v);
  if (filled.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2 pt-1">
      {filled.map((i) => (
        <div
          key={i.k}
          className="rounded-lg border px-2 py-1.5 text-xs"
          style={{ borderColor: "rgb(var(--border-light))", background: "rgb(var(--bg-surface))" }}
        >
          <div className="text-[10px] uppercase tracking-wider text-ink-500">{i.k}</div>
          <div className="font-mono text-ink-800">{i.v}</div>
        </div>
      ))}
    </div>
  );
}
