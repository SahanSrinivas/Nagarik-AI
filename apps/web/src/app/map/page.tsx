"use client";

import { useEffect, useState } from "react";

import { MapView } from "@/components/MapView";
import { api, type Issue } from "@/lib/api";

export default function MapPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.listIssues().then(setIssues).catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Live issue map</h1>
        <p className="text-sm text-zinc-600">{issues.length} issues loaded.</p>
      </header>
      {err && <div className="rounded border bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      <MapView issues={issues} />
    </div>
  );
}
