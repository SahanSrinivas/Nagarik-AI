"use client";

import { useState } from "react";

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
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">MILP crew optimizer</h1>
        <p className="text-sm text-zinc-600">
          Solves a Capacitated VRP with time windows + skill matching across today's open issues.
        </p>
      </header>

      <div className="flex items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded border px-2 py-1.5"
          />
        </label>
        <button
          onClick={run}
          disabled={busy}
          className="rounded bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Solving..." : "Solve"}
        </button>
      </div>

      {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {result && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Status" value={result.solver_status} />
            <Stat label="Runtime" value={`${result.runtime_seconds}s`} />
            <Stat label="Total km" value={String(result.metrics.total_km ?? "—")} />
            <Stat label="Served" value={`${result.metrics.served ?? 0} / ${(result.metrics.served ?? 0) + (result.metrics.unserved ?? 0)}`} />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-zinc-700">Routes</h2>
            <div className="space-y-2">
              {result.routes.map((r) => (
                <div key={r.crew_id} className="rounded border bg-white p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Crew {r.crew_id.slice(0, 8)}</span>
                    <span className="text-zinc-500">{r.total_km} km · {r.sequence.length} stops</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-zinc-600">{r.sequence.join(" → ") || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
