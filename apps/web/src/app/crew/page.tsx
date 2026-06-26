"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPin, Truck, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CrewSummary {
  id: string;
  name: string;
  department: string;
  skills: string[];
  open_today: number;
}

/**
 * Crew index — lists every active BBMP crew with today's open assignments
 * so a judge can pick one and open /crew/[id] without knowing a UUID.
 *
 * The list comes from /crews-summary (added to ops.py to avoid plumbing
 * auth). Each row links to the existing /crew/[id] route.
 */
export default function CrewIndexPage() {
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/ops/crews-summary`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d) => setCrews(d.crews ?? []))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <header className="card p-6">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
          <h1 className="text-xl font-semibold tracking-tight">Crew dashboard</h1>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          Pick a crew to open their day's MILP-assigned route. The crew can mark each stop
          in-progress, snap an after-photo, and the ResolutionAgent's CLIP + pothole-CNN
          audit decides whether to close the ticket or push back.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="brand">{crews.length} active crews</Pill>
          <Pill tone="ink">Each crew handles 1 issue type</Pill>
        </div>
      </header>

      {err && <div className="card p-4 text-sm text-rose-700">{err}</div>}

      {loading && !err && (
        <div className="card animate-pulse p-6 text-sm text-ink-500">Loading crews…</div>
      )}

      <Stagger step={0.04} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {crews.map((c) => (
          <Reveal key={c.id}>
            <Link href={`/crew/${c.id}`} className="block">
              <motion.div whileHover={{ y: -3 }} className="card-glow h-full p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
                    <span className="text-sm font-semibold">{c.name}</span>
                  </div>
                  <Pill tone={c.open_today > 0 ? "amber" : "ink"}>
                    {c.open_today} today
                  </Pill>
                </div>
                <div className="mt-1 text-xs text-ink-500">{c.department}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.skills.map((s) => (
                    <span key={s} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-mono text-ink-700">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs text-brand-700">
                  Open route <ArrowRight className="h-3 w-3" />
                </div>
              </motion.div>
            </Link>
          </Reveal>
        ))}
      </Stagger>

      <div className="card p-4 text-xs text-ink-600">
        <div className="flex items-start gap-2">
          <Wrench className="mt-0.5 h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          <div>
            <strong>Closure verification (the trust differentiator):</strong> when a crew
            uploads an after-photo, the ResolutionAgent runs <code className="font-mono">CLIP</code> scene
            similarity + a pothole-defect CNN. Same location + cleared defect →{" "}
            <code className="font-mono">verified_resolved</code>. Different location → <code className="font-mono">rejected_photo_swap</code>.
            Same place but still defective → <code className="font-mono">rejected_still_defective</code>{" "}
            (the crew has to redo it). This is what BBMP's own apps structurally can't audit.
          </div>
        </div>
      </div>
    </motion.div>
  );
}
