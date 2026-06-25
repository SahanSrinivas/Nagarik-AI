"use client";

import { Cpu, Play, Route, Sigma, Timer } from "lucide-react";
import { useState } from "react";

import { Pill } from "@/components/Pill";
import { api, type ScheduleResponse } from "@/lib/api";

export default function MilpPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<ScheduleResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      setResult(await api.solveSchedule(date));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="card p-6">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-brand-600" />
          <h1 className="text-xl font-semibold tracking-tight">MILP crew optimizer</h1>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          Capacitated VRP with Time Windows + skill matching + severity-weighted lateness.
          Solved with Google OR-Tools.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs uppercase text-ink-500">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
          </label>
          <button onClick={run} disabled={busy} className="btn-primary">
            <Play className="h-4 w-4" /> {busy ? "Solving..." : "Solve"}
          </button>
        </div>
      </header>

      {err && <div className="card p-4 text-sm text-rose-700">{err}</div>}

      {result && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Sigma} label="Status" value={result.solver_status} tone="brand" />
            <Stat icon={Timer} label="Runtime" value={`${result.runtime_seconds}s`} />
            <Stat icon={Route} label="Total km" value={String(result.metrics.total_km ?? "—")} />
            <Stat
              icon={Cpu}
              label="Served"
              value={`${result.metrics.served ?? 0} / ${(result.metrics.served ?? 0) + (result.metrics.unserved ?? 0)}`}
              tone={result.metrics.unserved ? "amber" : "brand"}
            />
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink-700">Routes</h2>
              <Pill tone="ink">{result.routes.length}</Pill>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {result.routes.map((r) => (
                <div key={r.crew_id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-ink-900">
                        Crew <span className="font-mono">{r.crew_id.slice(0, 8)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-500">
                        {r.sequence.length} stops · {r.total_km} km
                      </div>
                    </div>
                    <Pill tone={r.sequence.length ? "brand" : "ink"}>
                      {r.sequence.length ? "scheduled" : "idle"}
                    </Pill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-mono text-ink-500">
                    {r.sequence.length
                      ? r.sequence.map((id, i) => (
                          <span key={i} className="rounded-md bg-ink-100 px-1.5 py-0.5">
                            {id.slice(0, 6)}
                          </span>
                        ))
                      : <span className="text-ink-400">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "ink",
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  tone?: "brand" | "ink" | "amber";
}) {
  const accent =
    tone === "brand" ? "from-brand-500 to-brand-700" : tone === "amber" ? "from-amber-400 to-amber-600" : "from-ink-700 to-ink-900";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-soft`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
          <div className="mt-0.5 text-lg font-semibold text-ink-900">{value}</div>
        </div>
      </div>
    </div>
  );
}
