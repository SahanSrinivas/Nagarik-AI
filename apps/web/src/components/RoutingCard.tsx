"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

import { Pill } from "@/components/Pill";

interface RoutingMeta {
  gate_verdict?: string;
  used_sop_fallback?: boolean;
  disagreements?: string[];
  llm_proposed?: { type: string; department: string; sla_hours: number; severity: number } | null;
  final?: { department: string; sla_hours: number; severity: number };
  reasoning?: string;
  severity_verdict?: {
    source: string;
    vision: number | null;
    vision_confidence: number | null;
    llm: number | null;
    sop_baseline: number;
    notes: string[];
  };
}

export function RoutingCard({ meta }: { meta: RoutingMeta }) {
  const llm = meta.llm_proposed;
  const fin = meta.final;
  if (!fin) return null;

  const deptDisagreement = llm && fin && llm.department !== fin.department;
  const slaDisagreement = llm && fin && llm.sla_hours !== fin.sla_hours;
  const sevDisagreement = llm && fin && llm.severity !== fin.severity;

  const verdict = meta.gate_verdict ?? "accepted";
  const overrode = meta.used_sop_fallback === true;

  const verdictTone =
    verdict.startsWith("rejected") || overrode ? "rose"
    : verdict === "corrected" ? "amber"
    : "brand";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="card overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-ink-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-semibold text-ink-900">Routing decision</span>
          <Pill tone={verdictTone}>{verdict.replace(/_/g, " ")}</Pill>
          {overrode && <Pill tone="rose">SOP override</Pill>}
        </div>
        {meta.disagreements && meta.disagreements.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {meta.disagreements.length} disagreement{meta.disagreements.length === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* Propose → Decide flow */}
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_1fr]">
        <Side
          label="LLM proposed"
          icon={Sparkles}
          tone="blue"
          dept={llm?.department ?? "(no proposal)"}
          sla={llm?.sla_hours}
          sev={llm?.severity}
          deptDimmed={deptDisagreement}
          slaDimmed={slaDisagreement}
          sevDimmed={sevDisagreement}
        />
        <div className="hidden self-center sm:block">
          <ArrowRight className="h-5 w-5 text-ink-300" />
        </div>
        <Side
          label={overrode ? "Gate overrode to" : "Gate kept"}
          icon={ShieldCheck}
          tone={overrode ? "rose" : "brand"}
          dept={fin.department}
          sla={fin.sla_hours}
          sev={fin.severity}
          emphasize
        />
      </div>

      {/* Severity verdict — only shown if it's interesting */}
      {meta.severity_verdict && meta.severity_verdict.source !== "vision" && (
        <div className="border-t border-ink-100 bg-ink-50/40 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-500">severity gate:</span>
            <Pill tone={meta.severity_verdict.source.includes("rejected") ? "rose" : meta.severity_verdict.source === "llm_escalation" ? "amber" : "ink"}>
              {meta.severity_verdict.source.replace(/_/g, " ")}
            </Pill>
            <span className="font-mono text-ink-600">
              vision={meta.severity_verdict.vision ?? "—"}
              {meta.severity_verdict.vision_confidence != null && (
                <span className="text-ink-400"> (conf {meta.severity_verdict.vision_confidence.toFixed(2)})</span>
              )}
              {" · "}
              llm={meta.severity_verdict.llm ?? "—"}
              {" · "}
              sop={meta.severity_verdict.sop_baseline}
              {" · "}
              <strong className="text-ink-900">final={fin.severity}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Disagreement chips */}
      {meta.disagreements && meta.disagreements.length > 0 && (
        <div className="border-t border-ink-100 px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {meta.disagreements.map((d, i) => (
              <Pill key={i} tone="amber" className="font-mono">{d}</Pill>
            ))}
          </div>
        </div>
      )}

      {meta.reasoning && (
        <div className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-600">
          <span className="text-ink-500">reasoning:</span> {meta.reasoning}
        </div>
      )}
    </motion.div>
  );
}

function Side({
  label,
  icon: Icon,
  tone,
  dept,
  sla,
  sev,
  emphasize = false,
  deptDimmed = false,
  slaDimmed = false,
  sevDimmed = false,
}: {
  label: string;
  icon: typeof ShieldCheck;
  tone: "blue" | "brand" | "rose";
  dept: string;
  sla?: number;
  sev?: number;
  emphasize?: boolean;
  deptDimmed?: boolean;
  slaDimmed?: boolean;
  sevDimmed?: boolean;
}) {
  const ring =
    tone === "brand" ? "border-brand-200 bg-brand-50/60" :
    tone === "rose" ? "border-rose-200 bg-rose-50/60" :
    "border-blue-200 bg-blue-50/60";

  return (
    <div className={`rounded-2xl border p-3 ${ring}`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-sm ${emphasize ? "font-semibold text-ink-900" : "text-ink-800"} ${deptDimmed ? "line-through text-ink-400" : ""}`}>
        {dept}
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs font-mono text-ink-600">
        {sla != null && <span className={slaDimmed ? "line-through text-ink-400" : ""}>SLA {sla}h</span>}
        {sev != null && <span className={sevDimmed ? "line-through text-ink-400" : ""}>sev {sev}</span>}
      </div>
    </div>
  );
}
