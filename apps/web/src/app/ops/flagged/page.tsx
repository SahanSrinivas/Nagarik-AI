"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, MapPin, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";

interface FlaggedItem {
  id: string;
  type: string;
  status: string;
  ward: string | null;
  lat: number;
  lng: number;
  address: string | null;
  description: string;
  before_photo_url: string | null;
  created_at: string;
  source: string;
  cross_check_km: number | null;
  exif_lat: number | null;
  exif_lng: number | null;
  browser_lat: number | null;
  browser_lng: number | null;
  geocoded_display: string | null;
  geocoder_confidence: number | null;
}

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function OpsFlaggedPage() {
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/ops/flagged?limit=100`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function act(id: string, action: "exif" | "browser" | "current" | "reject") {
    const url = action === "reject"
      ? `${BASE}/ops/flagged/${id}/reject`
      : `${BASE}/ops/flagged/${id}/confirm?keep=${action}`;
    await fetch(url, { method: "POST" });
    reload();
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <header className="card p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h1 className="text-xl font-semibold tracking-tight">Operator audit — location-flagged reports</h1>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          Reports whose photo-EXIF and browser-GPS disagreed by &gt; 5 km, or where the
          geocoder confidence was low. Confirm which signal to trust, or reject as fraudulent.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
          <Pill tone="amber">{items.length} flagged</Pill>
          {loading && <span>refreshing…</span>}
        </div>
      </header>

      {err && <div className="card p-4 text-sm text-rose-700">{err}</div>}

      {items.length === 0 && !loading && (
        <div className="card p-8 text-center text-sm text-ink-500">
          Nothing flagged. The agent loop is happy.
        </div>
      )}

      <Stagger step={0.04} className="space-y-3">
        {items.map((i) => (
          <Reveal key={i.id}>
            <motion.div whileHover={{ y: -1 }} className="card p-4">
              <div className="grid gap-4 md:grid-cols-[140px_1fr_auto]">
                {i.before_photo_url ? (
                  <img src={i.before_photo_url} alt="" className="h-32 w-32 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-32 w-32 place-items-center rounded-xl bg-ink-100 text-ink-400 text-xs">no photo</div>
                )}
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="rose">{i.source.replace(/_/g, " ")}</Pill>
                    <Pill tone="ink">{i.type}</Pill>
                    {i.ward && <Pill tone="ink">Ward · {i.ward}</Pill>}
                    {i.cross_check_km != null && (
                      <span className="font-mono text-xs text-rose-700">{i.cross_check_km.toFixed(1)} km gap</span>
                    )}
                    {i.geocoder_confidence != null && (
                      <span className="font-mono text-xs text-amber-700">geocoder conf {i.geocoder_confidence.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-ink-900">{i.address ?? "(no address)"}</div>
                  <div className="text-sm text-ink-600 line-clamp-2">{i.description}</div>
                  <div className="grid gap-1.5 text-xs font-mono text-ink-600 sm:grid-cols-2">
                    {i.exif_lat != null && (
                      <span className="rounded-lg bg-ink-50 px-2 py-1">
                        <MapPin className="mr-1 inline h-3 w-3" /> EXIF · {i.exif_lat.toFixed(4)}, {i.exif_lng?.toFixed(4)}
                      </span>
                    )}
                    {i.browser_lat != null && (
                      <span className="rounded-lg bg-ink-50 px-2 py-1">
                        <MapPin className="mr-1 inline h-3 w-3" /> Browser · {i.browser_lat.toFixed(4)}, {i.browser_lng?.toFixed(4)}
                      </span>
                    )}
                    {i.geocoded_display && (
                      <span className="rounded-lg bg-ink-50 px-2 py-1 truncate sm:col-span-2">
                        📍 geocoded · {i.geocoded_display}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 self-start">
                  {i.exif_lat != null && (
                    <button onClick={() => act(i.id, "exif")} className="btn-primary text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Keep EXIF
                    </button>
                  )}
                  {i.browser_lat != null && (
                    <button onClick={() => act(i.id, "browser")} className="btn-ghost text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Keep Browser
                    </button>
                  )}
                  <button onClick={() => act(i.id, "current")} className="btn-ghost text-xs">
                    Confirm current
                  </button>
                  <button
                    onClick={() => act(i.id, "reject")}
                    className="btn text-xs border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            </motion.div>
          </Reveal>
        ))}
      </Stagger>
    </motion.div>
  );
}
