"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Building2, Cpu, Plane, Play, Route, Scale, Sigma, Timer, TrendingDown } from "lucide-react";
import { useState } from "react";

import { MapView } from "@/components/MapView";
import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";
import { api, type CompareResponse, type CrewRoute, type ScheduleResponse } from "@/lib/api";

/** Convert "minutes since midnight" → HH:MM string. */
function fmtHHMM(minOfDay: number | null | undefined): string {
  if (minOfDay == null) return "—";
  const h = Math.floor(minOfDay / 60) % 24;
  const m = Math.floor(minOfDay) % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

const TYPE_LABEL: Record<string, string> = {
  pothole: "Pothole", garbage: "Garbage", streetlight: "Streetlight",
  water_leak: "Water leak", sewage: "Sewage", tree_fall: "Fallen tree",
  encroachment: "Encroachment", other: "Other",
};

export default function MilpPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<ScheduleResponse | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyCmp, setBusyCmp] = useState(false);
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

  async function compare() {
    setBusyCmp(true);
    setErr(null);
    try {
      setComparison(await api.compareSchedule(date));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusyCmp(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <header className="card p-6">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-brand-600" />
          <h1 className="text-xl font-semibold tracking-tight">Crew schedule — MILP optimizer</h1>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          Shortest-path crew routing as a Capacitated VRP with Time Windows: every open civic
          issue is a node, every crew a vehicle. OR-Tools minimises total kilometres while
          respecting daily capacity, shift hours, severity-weighted SLA lateness, and skill
          matching (a streetlight crew can&apos;t pick up potholes).
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs uppercase text-ink-500">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" />
          </label>
          <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} onClick={run} disabled={busy} className="btn-primary">
            <Play className="h-4 w-4" /> {busy ? "Solving..." : "Solve & visualize"}
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} onClick={compare} disabled={busyCmp} className="btn-dark">
            <Scale className="h-4 w-4" /> {busyCmp ? "Comparing..." : "Compare vs FIFO"}
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {err && (
          <motion.div key="err" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="card p-4 text-sm text-rose-700">
            {err}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- COMPARISON SUMMARY ---------- */}
      <AnimatePresence mode="wait">
        {comparison && (
          <motion.section
            key="cmp"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="card overflow-hidden"
          >
            <div className="bg-hero-gradient p-6 text-white">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-brand-200">
                <TrendingDown className="h-3.5 w-3.5" /> Baseline comparison
              </div>
              <div className="mt-1 text-lg font-semibold">FIFO vs. MILP on {comparison.n_issues} live issues, {comparison.n_crews} crews</div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <BigStat label="km reduction" value={comparison.improvement.km_reduction_pct ?? 0} suffix="%" />
                <BigStat label="extra served" value={comparison.improvement.additional_served} suffix=" issues" />
                <BigStat
                  label="km: fifo → milp"
                  value={Math.round(comparison.fifo.total_km ?? 0)}
                  suffix={` → ${Math.round(comparison.milp.total_km ?? 0)}`}
                />
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ---------- MAP + STATS ---------- */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="space-y-6">
            <Stagger step={0.05} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Reveal><Stat icon={Sigma} label="Status" value={result.solver_status} tone="brand" /></Reveal>
              <Reveal><Stat icon={Timer} label="Runtime" valueNumeric={result.runtime_seconds} suffix="s" /></Reveal>
              <Reveal><Stat icon={Route} label="Total km" valueNumeric={Number(result.metrics.total_km ?? 0)} /></Reveal>
              <Reveal>
                <Stat
                  icon={Cpu}
                  label="Served"
                  value={`${result.metrics.served ?? 0} / ${(result.metrics.served ?? 0) + (result.metrics.unserved ?? 0)}`}
                  tone={result.metrics.unserved ? "amber" : "brand"}
                />
              </Reveal>
            </Stagger>

            {/* ─── FLIGHT BOARD — chronological per-crew timetable ─── */}
            <FlightBoard routes={result.routes} />

            <div className="card p-2">
              <MapView routes={result.routes} className="h-[65vh] w-full rounded-xl" />
            </div>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink-700">Routes</h2>
                <Pill tone="ink">{result.routes.length}</Pill>
              </div>
              <Stagger step={0.04} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {result.routes.map((r, idx) => (
                  <Reveal key={r.crew_id}>
                    <motion.div whileHover={{ y: -2 }} className="card p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ background: ["#10b981","#3b82f6","#a855f7","#f59e0b","#ec4899","#0ea5e9","#84cc16","#f97316","#8b5cf6","#14b8a6"][idx % 10] }}
                            />
                            {r.crew_name}
                          </div>
                          <div className="mt-0.5 text-xs text-ink-500">
                            {r.department} · {r.stops.length} stops · {r.total_km} km
                          </div>
                        </div>
                        <Pill tone={r.stops.length ? "brand" : "ink"}>{r.stops.length ? "scheduled" : "idle"}</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-mono text-ink-500">
                        {r.stops.length ? (
                          r.stops.map((s, i) => (
                            <motion.span
                              key={i}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.04 * i }}
                              className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5"
                              title={s.address ?? s.type}
                            >
                              <span>{i + 1}</span>
                              <span className="text-ink-400">·</span>
                              <span>{s.type}</span>
                            </motion.span>
                          ))
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </div>
                    </motion.div>
                  </Reveal>
                ))}
              </Stagger>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Stat({
  icon: Icon, label, value, valueNumeric, suffix = "", tone = "ink",
}: { icon: typeof Cpu; label: string; value?: string; valueNumeric?: number; suffix?: string; tone?: "brand" | "ink" | "amber" }) {
  const accent = tone === "brand" ? "from-brand-500 to-brand-700" : tone === "amber" ? "from-amber-400 to-amber-600" : "from-ink-700 to-ink-900";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-soft`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
          <div className="mt-0.5 text-lg font-semibold text-ink-900">
            {valueNumeric != null ? <Counter to={valueNumeric} suffix={suffix} /> : value}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Flight board ───────────────────── */
/**
 * Displays today's MILP solution as a departures-board: one row per crew,
 * chronological chips for each stop (HH:MM · severity · type · address).
 * Idle crews still appear so judges see the model decided NOT to route them.
 */
function FlightBoard({ routes }: { routes: CrewRoute[] }) {
  const palette = ["#10b981","#3b82f6","#a855f7","#f59e0b","#ec4899","#0ea5e9","#84cc16","#f97316","#8b5cf6","#14b8a6"];
  const grouped = [...routes].sort((a, b) => {
    if (a.department === b.department) return a.crew_name.localeCompare(b.crew_name);
    return a.department.localeCompare(b.department);
  });
  return (
    <section
      className="rounded-3xl border p-6"
      style={{
        background: "linear-gradient(180deg, rgba(191,79,54,0.04) 0%, rgb(var(--bg-surface)) 100%)",
        borderColor: "rgba(191, 79, 54, 0.25)",
      }}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} strokeWidth={2.25} />
          <h2 className="text-lg font-semibold">Today&apos;s crew timetable</h2>
        </div>
        <div className="text-[10px] uppercase tracking-wider"
          style={{ color: "rgb(var(--text-muted))" }}>
          {routes.reduce((n, r) => n + r.stops.length, 0)} stops · {routes.length} crews · OR-Tools CVRPTW
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border"
        style={{ borderColor: "rgb(var(--border-light))" }}>
        {/* Column header strip */}
        <div className="grid grid-cols-[180px_1fr_120px] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: "rgb(var(--bg-canvas))",
            color: "rgb(var(--text-muted))",
            borderBottom: "1px solid rgb(var(--border-light))",
          }}>
          <div>Crew · Department</div>
          <div>Stops (HH:MM · type · km from prev)</div>
          <div className="text-right">Total km · time</div>
        </div>

        {grouped.map((r, idx) => {
          const dot = palette[idx % palette.length];
          const idle = r.stops.length === 0;
          return (
            <div
              key={r.crew_id}
              className="grid grid-cols-[180px_1fr_120px] items-start gap-3 px-4 py-3 text-xs"
              style={{
                borderTop: idx === 0 ? undefined : "1px solid rgb(var(--border-light))",
                background: idle ? "rgba(0,0,0,0.02)" : undefined,
              }}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
                  <span className="font-semibold">{r.crew_name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px]"
                  style={{ color: "rgb(var(--text-muted))" }}>
                  <Building2 className="h-2.5 w-2.5" /> {r.department}
                </div>
                {r.shift_start_hour != null && (
                  <div className="mt-0.5 font-mono text-[10px]"
                    style={{ color: "rgb(var(--text-muted))" }}>
                    shift {String(r.shift_start_hour).padStart(2,"0")}:00–{String(r.shift_end_hour).padStart(2,"0")}:00
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {idle ? (
                  <span className="rounded-md px-2 py-0.5 text-[11px]"
                    style={{
                      background: "rgb(var(--bg-surface-hover))",
                      color: "rgb(var(--text-muted))",
                    }}>
                    Idle today — solver did not assign this crew
                  </span>
                ) : r.stops.map((s, si) => {
                  const sevColor =
                    s.severity >= 4 ? "#dc2626"
                    : s.severity === 3 ? "#f59e0b"
                    : "#10b981";
                  return (
                    <motion.div
                      key={s.issue_id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.025 * si }}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px]"
                      style={{
                        background: "rgb(var(--bg-surface))",
                        border: "1px solid rgb(var(--border-light))",
                        color: "rgb(var(--text-primary))",
                      }}
                      title={s.address ?? "(no address)"}
                    >
                      <span className="rounded px-1 font-semibold tabular-nums"
                        style={{ background: "rgb(var(--bg-surface-hover))" }}>
                        {fmtHHMM(s.arrival_clock_min)}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: sevColor }} />
                      <span>{TYPE_LABEL[s.type] ?? s.type}</span>
                      {s.travel_min_from_prev != null && s.travel_min_from_prev > 0 && (
                        <span style={{ color: "rgb(var(--text-muted))" }}>
                          +{s.travel_min_from_prev}m
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <div className="text-right">
                <div className="font-mono font-semibold tabular-nums">{r.total_km.toFixed(1)} km</div>
                <div className="font-mono text-[10px]"
                  style={{ color: "rgb(var(--text-muted))" }}>
                  {r.total_time_min} min
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
        Times are computed from the OR-Tools <em>Time</em> dimension: arrival = shift_start_hour ×
        60 + cumulative travel + service. Severity dots: <span className="text-rose-600">●</span> sev≥4
        <span className="ml-2 text-amber-600">●</span> sev=3 <span className="ml-2 text-emerald-600">●</span> sev≤2.
      </p>
    </section>
  );
}

function BigStat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-center backdrop-blur">
      <div className="text-3xl font-semibold text-brand-300">
        <Counter to={value} suffix={suffix} />
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-ink-300">{label}</div>
    </div>
  );
}
