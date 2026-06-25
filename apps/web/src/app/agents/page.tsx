"use client";

import { Activity, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Pill } from "@/components/Pill";
import { api, type AgentEvent } from "@/lib/api";

const PIPELINE = [
  { key: "vision",       label: "Vision",       hint: "Gemini classify" },
  { key: "dedup",        label: "Dedup",        hint: "pgvector + PostGIS" },
  { key: "triage",       label: "Triage",       hint: "SOP route" },
  { key: "verification", label: "Verification", hint: "Community confirm" },
  { key: "scheduler",    label: "Scheduler",    hint: "MILP CVRPTW" },
  { key: "resolution",   label: "Resolution",   hint: "CLIP similarity" },
  { key: "insights",     label: "Insights",     hint: "LightGBM update" },
];

export default function AgentsPage() {
  const [issueId, setIssueId] = useState<string>("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const url = new URL(window.location.href);
    setIssueId(url.searchParams.get("issue") ?? "");
  }, []);

  useEffect(() => {
    if (!issueId) return;
    const t = setInterval(() => setTick((x) => x + 1), 1500);
    return () => clearInterval(t);
  }, [issueId]);

  useEffect(() => {
    if (!issueId) return;
    api.issueEvents(issueId).then(setEvents).catch(() => {});
  }, [issueId, tick]);

  const lastByAgent: Record<string, AgentEvent> = {};
  events.forEach((e) => { lastByAgent[e.agent] = e; });

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-600" />
              <h1 className="text-xl font-semibold tracking-tight">Live agent pipeline</h1>
            </div>
            <p className="mt-1 text-sm text-ink-600">
              Polls every 1.5s · Issue <code className="font-mono text-ink-900">{issueId || "—"}</code>
            </p>
          </div>
          <input
            value={issueId}
            onChange={(e) => setIssueId(e.target.value)}
            placeholder="paste issue id"
            className="input max-w-md"
          />
        </div>
      </header>

      {/* ---------- LIVE PIPELINE ---------- */}
      <section className="card p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {PIPELINE.map((a, i) => {
            const ev = lastByAgent[a.key];
            const state = ev?.status ?? "pending";
            const tone =
              state === "completed"
                ? "border-brand-300 bg-brand-50"
                : state === "started"
                ? "border-amber-300 bg-amber-50 animate-pulse-ring"
                : state === "failed"
                ? "border-rose-300 bg-rose-50"
                : "border-ink-200 bg-white";
            const icon =
              state === "completed" ? CheckCircle2 : state === "failed" ? AlertTriangle : state === "started" ? Loader2 : null;
            return (
              <div key={a.key} className={`rounded-2xl border p-4 transition ${tone}`}>
                <div className="flex items-center justify-between text-xs font-mono text-ink-400">
                  <span>0{i + 1}</span>
                  {icon ? (
                    <icon className={`h-4 w-4 ${state === "started" ? "animate-spin text-amber-600" : state === "completed" ? "text-brand-600" : "text-rose-600"}`} />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-ink-300" />
                  )}
                </div>
                <div className="mt-2 text-sm font-semibold text-ink-900">{a.label}</div>
                <div className="mt-0.5 text-[11px] text-ink-500">{a.hint}</div>
                <div className="mt-3 text-[11px] text-ink-600">
                  {state}
                  {ev?.duration_ms != null && <span className="ml-1 text-ink-400">· {ev.duration_ms}ms</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- EVENT LOG ---------- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-700">Event log</h2>
          <Pill tone="ink">{events.length}</Pill>
        </div>
        <div className="space-y-2">
          {events.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-500">
              No events yet. Paste an issue id above or report one to see the pipeline fire.
            </div>
          )}
          {events.map((e, i) => (
            <div key={i} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Pill tone="brand">{e.agent}</Pill>
                <Pill tone={e.status === "completed" ? "lime" : e.status === "failed" ? "rose" : "amber"}>
                  {e.status}
                </Pill>
                <span className="text-ink-500">{e.duration_ms ?? "—"}ms</span>
                <span className="text-ink-400">{new Date(e.created_at).toLocaleTimeString()}</span>
              </div>
              <pre className="mt-2 overflow-auto rounded-lg bg-ink-950 p-3 font-mono text-[11px] text-brand-200">
{JSON.stringify(e.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
