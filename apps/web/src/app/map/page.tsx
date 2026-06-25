"use client";

import { Map as MapIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { MapView } from "@/components/MapView";
import { Pill, SeverityPill, StatusPill } from "@/components/Pill";
import { api, type Issue } from "@/lib/api";

export default function MapPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.listIssues().then(setIssues).catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-brand-600" />
              <h1 className="text-xl font-semibold tracking-tight">Live issue map</h1>
            </div>
            <p className="mt-1 text-sm text-ink-600">{issues.length} issues across Bangalore.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <SeverityPill key={s} value={s} />
            ))}
          </div>
        </div>
      </header>

      {err && <div className="card p-4 text-sm text-rose-700">{err}</div>}

      <div className="card overflow-hidden p-2">
        <MapView issues={issues} className="h-[65vh] w-full rounded-xl" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {issues.slice(0, 9).map((i) => (
          <div key={i.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm font-semibold text-ink-900">{i.address ?? i.type}</div>
              <Pill tone="ink">{i.ward ?? "—"}</Pill>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-ink-600">{i.description}</p>
            <div className="mt-3 flex items-center gap-2">
              <SeverityPill value={i.severity} />
              <StatusPill value={i.status} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
