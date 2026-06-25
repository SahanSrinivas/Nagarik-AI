"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Play, Route, Scale, Sigma, Timer, TrendingDown } from "lucide-react";
import { useState } from "react";

import { MapView } from "@/components/MapView";
import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";
import { api, type CompareResponse, type ScheduleResponse } from "@/lib/api";

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
