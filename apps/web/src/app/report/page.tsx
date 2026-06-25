"use client";

import { useState } from "react";

import { api } from "@/lib/api";

export default function ReportPage() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) return setErr("geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
      },
      (e) => setErr(e.message),
    );
  }

  async function submit() {
    if (lat == null || lng == null) return setErr("share your location first");
    setBusy(true);
    setErr(null);
    try {
      const created = await api.createIssue({
        lat,
        lng,
        description: desc,
        before_photo_url: photo || null,
      } as Parameters<typeof api.createIssue>[0]);
      setSubmitted(created.id);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Reported.</h1>
        <p className="text-sm text-zinc-600">
          Issue <code>{submitted}</code> is now flowing through the agent pipeline.
        </p>
        <a className="text-brand underline" href={`/agents?issue=${submitted}`}>
          Watch the agents work →
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Report a civic issue</h1>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <button
          onClick={locate}
          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white"
        >
          {lat != null ? `Located ✓ (${lat.toFixed(4)}, ${lng?.toFixed(4)})` : "Use my location"}
        </button>

        <label className="block text-sm">
          Photo URL (Supabase upload wired in Week 1 Day 2)
          <input
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block text-sm">
          What did you see?
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            placeholder="Big pothole near 14th Cross, water collects after rain..."
          />
        </label>

        {err && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
