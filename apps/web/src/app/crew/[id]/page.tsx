"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  PlayCircle,
  Truck,
  Wrench,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Reveal, Stagger } from "@/components/Motion";
import { Pill, SeverityPill, StatusPill } from "@/components/Pill";
import { uploadPhoto } from "@/lib/api";

interface Stop {
  id: string;
  type: string;
  severity: number;
  status: string;
  address: string | null;
  ward: string | null;
  lat: number;
  lng: number;
  description: string;
  before_photo_url: string | null;
  after_photo_url: string | null;
  scheduled_at: string | null;
  sla_deadline: string | null;
}

interface TodayResponse {
  crew: {
    id: string;
    name: string;
    department: string;
    skills: string[];
    depot: { lat: number; lng: number };
    shift_start_hour: number;
    shift_end_hour: number;
  };
  date: string;
  stops: Stop[];
  summary: { total: number; completed: number; in_progress: number };
}

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CrewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    fetch(`${BASE}/crew/${id}/today`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  async function start(stopId: string) {
    if (!id) return;
    setBusy(stopId);
    try {
      await fetch(`${BASE}/crew/${id}/start/${stopId}`, { method: "POST" });
      reload();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function complete(stop: Stop, file: File | undefined) {
    if (!id || !file) return;
    setBusy(stop.id);
    try {
      const url = await uploadPhoto(file);
      const params = new URLSearchParams({ after_photo_url: url });
      await fetch(`${BASE}/crew/${id}/complete/${stop.id}?${params.toString()}`, { method: "POST" });
      reload();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  function googleMapsLink(s: Stop) {
    return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  }

  if (err && !data) return <div className="card p-6 text-sm text-rose-700">{err}</div>;
  if (!data) return <div className="card animate-pulse p-6 text-sm text-ink-400">Loading today's route…</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* CREW HEADER */}
      <section className="card overflow-hidden">
        <div className="bg-hero-gradient p-6 text-white">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-brand-200">
            <Truck className="h-3.5 w-3.5" /> Crew · {data.date}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.crew.name}</h1>
          <div className="mt-1 text-sm text-ink-300">
            {data.crew.department} · {data.crew.skills.join(", ")} · shift {data.crew.shift_start_hour}-{data.crew.shift_end_hour}
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <Stat label="Total stops" value={data.summary.total} />
          <Stat label="Completed" value={data.summary.completed} tone="brand" />
          <Stat label="In progress" value={data.summary.in_progress} tone="amber" />
        </div>
      </section>

      {/* STOPS */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-700">Today's MILP-assigned route ({data.stops.length})</h2>
        {data.stops.length === 0 && (
          <div className="card p-8 text-center text-sm text-ink-500">
            No stops assigned today. The scheduler will pick this crew up on the next solve.
          </div>
        )}
        <Stagger step={0.04} className="space-y-3">
          {data.stops.map((s, idx) => (
            <Reveal key={s.id}>
              <motion.div whileHover={{ y: -1 }} className="card overflow-hidden">
                <div className="border-b border-ink-100 bg-ink-50/60 px-4 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="brand">#{idx + 1}</Pill>
                    <Pill tone="ink">{s.type}</Pill>
                    <SeverityPill value={s.severity} />
                    <StatusPill value={s.status} />
                    {s.ward && <Pill tone="ink">Ward · {s.ward}</Pill>}
                    {s.scheduled_at && (
                      <span className="ml-auto font-mono text-ink-500">
                        {new Date(s.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 p-4 md:grid-cols-[140px_1fr_auto]">
                  {s.before_photo_url ? (
                    <img src={s.before_photo_url} alt="" className="h-32 w-32 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-32 w-32 place-items-center rounded-xl bg-ink-100 text-ink-400 text-xs">no photo</div>
                  )}
                  <div className="min-w-0 space-y-1.5">
                    <div className="text-sm font-medium text-ink-900">{s.address ?? "(no address)"}</div>
                    <div className="text-sm text-ink-600 line-clamp-2">{s.description}</div>
                    <div className="font-mono text-xs text-ink-500">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</div>
                    {s.sla_deadline && (
                      <div className="flex items-center gap-1 text-xs text-amber-700">
                        <Clock className="h-3 w-3" /> SLA by {new Date(s.sla_deadline).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    <a
                      href={googleMapsLink(s)}
                      target="_blank"
                      rel="noopener"
                      className="btn-ghost text-xs"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Navigate
                    </a>
                    {s.status !== "in_progress" && !s.after_photo_url && (
                      <button onClick={() => start(s.id)} disabled={busy === s.id} className="btn-primary text-xs">
                        {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                        Start
                      </button>
                    )}
                    {!s.after_photo_url && (
                      <label className="btn-dark cursor-pointer text-xs">
                        <Camera className="h-3.5 w-3.5" />
                        <span>{busy === s.id ? "Uploading…" : "After-photo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => complete(s, e.target.files?.[0])}
                        />
                      </label>
                    )}
                    {s.after_photo_url && (
                      <Pill tone="brand">
                        <CheckCircle2 className="h-3 w-3" /> awaiting CNN audit
                      </Pill>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {s.after_photo_url && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-ink-100 bg-brand-50/40 px-4 py-3 text-xs"
                    >
                      <div className="flex items-center gap-2 text-brand-700">
                        <Wrench className="h-3.5 w-3.5" />
                        <span className="font-semibold">After-photo uploaded.</span>
                        <span>ResolutionAgent runs CLIP scene-similarity + pothole CNN within 3s.</span>
                        <ChevronRight className="h-3 w-3" />
                        <a className="underline" href={`/agents?issue=${s.id}`}>
                          Watch verdict on /agents
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>
    </motion.div>
  );
}

function Stat({ label, value, tone = "ink" }: { label: string; value: number; tone?: "ink" | "brand" | "amber" }) {
  const accent = tone === "brand" ? "from-brand-500 to-brand-700" : tone === "amber" ? "from-amber-400 to-amber-600" : "from-ink-700 to-ink-900";
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className={`mb-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white`}>
        <MapPin className="h-4 w-4" />
      </div>
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold text-ink-900">{value}</div>
    </div>
  );
}
