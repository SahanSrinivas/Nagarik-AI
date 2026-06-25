"use client";

import { useEffect, useState } from "react";

import { api, type AgentEvent } from "@/lib/api";

const PIPELINE = [
  "vision",
  "dedup",
  "triage",
  "verification",
  "scheduler",
  "resolution",
  "insights",
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
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Live agent pipeline</h1>
        <p className="text-sm text-zinc-600">
          Issue: <code>{issueId || "—"}</code>. Polls every 1.5s.
        </p>
        <input
          value={issueId}
          onChange={(e) => setIssueId(e.target.value)}
          placeholder="paste issue id"
          className="mt-2 w-full max-w-md rounded border px-2 py-1.5 text-sm"
        />
      </header>

      <div className="grid grid-cols-7 gap-2">
        {PIPELINE.map((a, i) => {
          const ev = lastByAgent[a];
          const color =
            ev?.status === "completed"
              ? "bg-emerald-100 border-emerald-400"
              : ev?.status === "started"
              ? "bg-amber-100 border-amber-400 animate-pulse"
              : ev?.status === "failed"
              ? "bg-red-100 border-red-400"
              : "bg-zinc-50 border-zinc-200";
          return (
            <div key={a} className={`rounded-lg border p-3 text-center text-xs ${color}`}>
              <div className="font-semibold capitalize">{i + 1}. {a}</div>
              <div className="mt-1 text-zinc-600">{ev?.status ?? "pending"}</div>
              {ev?.duration_ms != null && (
                <div className="mt-0.5 text-zinc-500">{ev.duration_ms} ms</div>
              )}
            </div>
          );
        })}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Event log</h2>
        <div className="space-y-1 font-mono text-xs">
          {events.map((e, i) => (
            <div key={i} className="rounded border bg-white p-2">
              <span className="text-brand">{e.agent}</span> · {e.status} · {e.duration_ms ?? "-"}ms
              <pre className="mt-1 overflow-auto text-[10px] text-zinc-600">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
