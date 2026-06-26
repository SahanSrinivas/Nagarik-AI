"use client";

import { ArrowRight, Camera, CheckCircle2, FlaskConical, MapPin, ShieldAlert, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useT } from "@/i18n";
import { api, uploadPhoto } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CoverageResult {
  inside_bbmp: boolean;
  ward?: string;
  ward_no?: number;
  message?: string;
}

/**
 * Hackathon location presets. Each is a real KGIS ward centroid lifted from
 * community-hero/data/ward_backlog.json — the same wards the MILP scheduler,
 * dashboard and heatmap already know about. Lets a judge in another city
 * complete the /report flow without faking GPS in DevTools, while the
 * server-side BBMP gate stays strict (these coords pass it for real).
 */
// Each preset is verified to fall inside a real KGIS BBMP ward polygon
// (the same set the gate uses). Whitefield + Horamavu centroids sit on
// the BBMP boundary and miss the polygon — dropped from this list.
const DEMO_LOCATIONS: { label: string; lat: number; lng: number }[] = [
  { label: "Koramangala",   lat: 12.9352, lng: 77.6245 },
  { label: "Indiranagar",   lat: 12.9716, lng: 77.6412 },
  { label: "HSR Layout",    lat: 12.9116, lng: 77.6473 },
  { label: "BTM Layout",    lat: 12.9166, lng: 77.6101 },
  { label: "Jayanagar",     lat: 12.9279, lng: 77.5832 },
  { label: "Malleshwaram",  lat: 13.0036, lng: 77.5712 },
  { label: "Hebbal",        lat: 13.0358, lng: 77.5970 },
  { label: "Sanjayanagar",  lat: 13.0316, lng: 77.5694 },
  { label: "Marathahalli",  lat: 12.9591, lng: 77.6974 },
  { label: "Hongasandra",   lat: 12.8915, lng: 77.6263 },
];

export default function ReportPage() {
  const t = useT();
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);

  function locate() {
    if (!navigator.geolocation) return setErr(t("report.err_geolocation_unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
        setErr(null);
      },
      (e) => setErr(e.message),
    );
  }

  // Whenever the coordinates change, probe the BBMP coverage endpoint so we
  // can warn the citizen inline instead of letting them submit + see a 422.
  useEffect(() => {
    if (lat == null || lng == null) {
      setCoverage(null);
      return;
    }
    let cancelled = false;
    fetch(`${BASE}/coverage/check?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d: CoverageResult) => {
        if (!cancelled) setCoverage(d);
      })
      .catch(() => { if (!cancelled) setCoverage(null); });
    return () => { cancelled = true; };
  }, [lat, lng]);

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
    if (lat == null || lng == null) return setErr(t("report.err_share_location"));
    if (coverage && coverage.inside_bbmp === false) {
      return setErr(coverage.message ?? "This location is outside BBMP jurisdiction.");
    }
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
      // Surface FastAPI 422 detail.message if present.
      const msg = String(e);
      try {
        const jsonStart = msg.indexOf("{");
        if (jsonStart >= 0) {
          const body = JSON.parse(msg.slice(jsonStart));
          if (body?.detail?.message) {
            setErr(body.detail.message);
            return;
          }
        }
      } catch {}
      setErr(msg);
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
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("report.success.title")}</h1>
          <p className="mt-2 text-sm text-ink-600">
            {t("report.success.subtitle_prefix")} <code className="font-mono">{submitted.slice(0, 8)}…</code> {t("report.success.subtitle_suffix")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href={`/tracking/${submitted}`} className="btn-primary">
              {t("common.track_report")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`/agents?issue=${submitted}`} className="btn-ghost">
              {t("common.watch_agents")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const outsideBBMP = coverage?.inside_bbmp === false;

  return (
    <div className="mx-auto max-w-xl space-y-6 animate-fade-up">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("report.title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("report.subtitle")}</p>
      </header>

      <div className="card space-y-5 p-6">
        <button onClick={locate} className={lat != null ? "btn-ghost w-full" : "btn-primary w-full"}>
          <MapPin className="h-4 w-4" />
          {lat != null
            ? `${t("report.locate_button_located")} (${lat.toFixed(4)}, ${lng?.toFixed(4)})`
            : t("report.locate_button_idle")}
        </button>

        {/* Hackathon-mode location presets — real Bengaluru ward centroids
            so a judge anywhere in the world can complete the flow without
            tricking the browser. The server-side BBMP gate stays strict. */}
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{
            background: "rgb(var(--bg-surface-hover))",
            borderColor: "rgb(var(--border-light))",
          }}
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider" style={{ color: "rgb(var(--text-muted))" }}>
            <FlaskConical className="h-3 w-3" /> Demo · pick a Bengaluru ward
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_LOCATIONS.map((d) => (
              <button
                key={d.label}
                onClick={() => { setLat(d.lat); setLng(d.lng); setErr(null); }}
                className="rounded-lg px-2.5 py-1 text-xs transition hover:opacity-80"
                style={{
                  border: "1px solid rgb(var(--border-color))",
                  background: "rgb(var(--bg-surface))",
                  color: "rgb(var(--text-primary))",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Coverage banner — shown once we have coords */}
        {coverage && coverage.inside_bbmp && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            style={{
              background: "rgba(191, 79, 54, 0.08)",
              color: "rgb(var(--text-primary))",
              border: "1px solid rgba(191, 79, 54, 0.30)",
            }}
          >
            <CheckCircle2 className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
            <span>
              Inside BBMP · <strong>{coverage.ward}</strong>
              {coverage.ward_no ? ` (#${coverage.ward_no})` : ""}
            </span>
          </div>
        )}
        {outsideBBMP && (
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
            style={{
              background: "rgba(244, 63, 94, 0.10)",
              color: "rgb(var(--text-primary))",
              border: "1px solid rgba(244, 63, 94, 0.40)",
            }}
          >
            <ShieldAlert className="mt-0.5 h-4 w-4" style={{ color: "#f43f5e" }} />
            <span>
              <strong>Outside BBMP jurisdiction.</strong>{" "}
              {coverage?.message ?? "NagarikAI only handles Bengaluru BBMP wards today."}
            </span>
          </div>
        )}

        <div>
          <span className="block text-xs uppercase tracking-wider text-ink-500">{t("report.photo_label")}</span>
          <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 p-6 text-sm text-ink-600 transition hover:border-brand-400 hover:bg-brand-50/50">
            <Upload className="h-4 w-4" />
            {uploading
              ? t("common.uploading")
              : photoUrl
              ? t("report.photo_dropzone_replace")
              : t("report.photo_dropzone_idle")}
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
          <span className="block text-xs uppercase tracking-wider text-ink-500">{t("report.description_label")}</span>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="input mt-1"
            placeholder={t("report.description_placeholder")}
          />
        </label>

        {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}

        <button
          onClick={submit}
          disabled={busy || uploading || outsideBBMP}
          className="btn-dark w-full"
        >
          <Camera className="h-4 w-4" />
          {busy ? t("common.submitting") : t("common.submit")}
        </button>
      </div>
    </div>
  );
}
