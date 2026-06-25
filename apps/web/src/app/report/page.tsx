"use client";

import { ArrowRight, Camera, CheckCircle2, MapPin, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { api, uploadPhoto } from "@/lib/api";

export default function ReportPage() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      setPhotoUrl(await uploadPhoto(file));
    } catch (e) {
      setErr(String(e));
    } finally {
      setUploading(false);
    }
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
        before_photo_url: photoUrl,
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
      <div className="mx-auto max-w-lg space-y-6 animate-fade-up">
        <div className="card p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Reported</h1>
          <p className="mt-2 text-sm text-ink-600">
            Issue <code className="font-mono">{submitted.slice(0, 8)}…</code> is flowing through the agent pipeline.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href={`/tracking/${submitted}`} className="btn-primary">
              Track your report <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`/agents?issue=${submitted}`} className="btn-ghost">
              Watch the agents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 animate-fade-up">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Report a civic issue</h1>
        <p className="mt-1 text-sm text-ink-600">Snap a photo. Drop your location. We handle the rest.</p>
      </header>

      <div className="card space-y-5 p-6">
        <button onClick={locate} className={lat != null ? "btn-ghost w-full" : "btn-primary w-full"}>
          <MapPin className="h-4 w-4" />
          {lat != null ? `Located ✓ (${lat.toFixed(4)}, ${lng?.toFixed(4)})` : "Use my location"}
        </button>

        <div>
          <span className="block text-xs uppercase tracking-wider text-ink-500">Photo</span>
          <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 p-6 text-sm text-ink-600 transition hover:border-brand-400 hover:bg-brand-50/50">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : photoUrl ? "Replace photo" : "Tap to choose or capture"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPickFile(e.target.files?.[0])}
              className="hidden"
            />
          </label>
          {photoUrl && (
            <img src={photoUrl} alt="" className="mt-3 h-40 w-full rounded-xl border border-ink-200 object-cover" />
          )}
        </div>

        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-ink-500">What did you see?</span>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="input mt-1"
            placeholder="Big pothole near 14th Cross, water collects after rain..."
          />
        </label>

        {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}

        <button onClick={submit} disabled={busy || uploading} className="btn-dark w-full">
          <Camera className="h-4 w-4" />
          {busy ? "Submitting..." : "Submit report"}
        </button>
      </div>
    </div>
  );
}
