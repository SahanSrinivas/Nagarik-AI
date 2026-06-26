"use client";

import { ArrowRight, Camera, CheckCircle2, MapPin, ShieldAlert, Upload } from "lucide-react";
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
