"use client";

import { ArrowRight, Camera, CheckCircle2, FlaskConical, MapPin, ShieldAlert, Upload, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useT } from "@/i18n";
import { uploadPhoto, uploadVideo } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CoverageResult {
  inside_bbmp: boolean;
  ward?: string;
  ward_no?: number;
  message?: string;
}

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
  const router = useRouter();
  const { token } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);

  // Login wall — if no JWT in localStorage, bounce to /login with a return path.
  useEffect(() => {
    const id = setTimeout(() => {
      if (!token) {
        router.replace(`/login?next=${encodeURIComponent("/report")}`);
      } else {
        setAuthChecked(true);
      }
    }, 250); // small grace for AuthProvider to hydrate
    return () => clearTimeout(id);
  }, [token, router]);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [evidenceKind, setEvidenceKind] = useState<"photo" | "video">("photo");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);

  function locate() {
    if (!navigator.geolocation) return setErr(t("report.err_geolocation_unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => { setLat(p.coords.latitude); setLng(p.coords.longitude); setErr(null); },
      (e) => setErr(e.message),
    );
  }

  // Whenever coords change, probe BBMP coverage so we don't let the user submit
  // an out-of-jurisdiction report and see a 422 they can't read.
  useEffect(() => {
    if (lat == null || lng == null) { setCoverage(null); return; }
    let cancelled = false;
    fetch(`${BASE}/coverage/check?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d: CoverageResult) => { if (!cancelled) setCoverage(d); })
      .catch(() => { if (!cancelled) setCoverage(null); });
    return () => { cancelled = true; };
  }, [lat, lng]);

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      if (evidenceKind === "video") {
        setVideoUrl(await uploadVideo(file));
      } else {
        setPhotoUrl(await uploadPhoto(file));
      }
    } catch (e) { setErr(String(e)); }
    finally { setUploading(false); }
  }

  async function submit() {
    if (lat == null || lng == null) return setErr(t("report.err_share_location"));
    if (coverage && coverage.inside_bbmp === false) {
      return setErr(coverage.message ?? "This location is outside BBMP jurisdiction.");
    }
    setBusy(true); setErr(null);
    try {
      // Send Authorization so the server attributes the report to the
      // logged-in citizen and awards XP.
      const r = await fetch(`${BASE}/issues`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          lat, lng, description: desc,
          before_photo_url: evidenceKind === "photo" ? photoUrl : null,
          before_video_url: evidenceKind === "video" ? videoUrl : null,
        }),
      });
      if (!r.ok) {
        const body = await r.text();
        try {
          const parsed = JSON.parse(body);
          if (parsed?.detail?.message) { setErr(parsed.detail.message); return; }
        } catch {}
        throw new Error(`${r.status} ${body}`);
      }
      const created = await r.json();
      setSubmitted(created.id);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!authChecked) {
    return <div className="card animate-pulse p-6 text-sm text-ink-500">Checking your session…</div>;
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
            {t("report.success.subtitle_prefix")} <code className="font-mono">{submitted.slice(0, 8)}…</code>{" "}
            {t("report.success.subtitle_suffix")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {/* Default action: watch the 7 agents fire one-by-one in real time. */}
            <Link href={`/agents?issue=${submitted}`} className="btn-primary">
              {t("common.watch_agents")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`/tracking/${submitted}`} className="btn-ghost">
              {t("common.track_report")}
            </Link>
          </div>
          <p className="mt-3 text-xs text-ink-500">+5 XP earned for this submission.</p>
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

        <div
          className="rounded-xl border px-3 py-2.5"
          style={{ background: "rgb(var(--bg-surface-hover))", borderColor: "rgb(var(--border-light))" }}
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider"
            style={{ color: "rgb(var(--text-muted))" }}>
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
          <div className="flex items-center justify-between">
            <span className="block text-xs uppercase tracking-wider text-ink-500">{t("report.photo_label")}</span>
            {/* Photo|Video toggle — Gemini 2.5 Flash handles both natively */}
            <div
              role="tablist"
              className="inline-flex rounded-lg p-0.5"
              style={{
                background: "rgb(var(--bg-surface-hover))",
                border: "1px solid rgb(var(--border-light))",
              }}
            >
              {(["photo", "video"] as const).map((kind) => {
                const active = evidenceKind === kind;
                const Icon = kind === "photo" ? Camera : Video;
                return (
                  <button
                    key={kind}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setEvidenceKind(kind)}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition"
                    style={{
                      background: active ? "rgb(var(--accent))" : "transparent",
                      color: active ? "#fff" : "rgb(var(--text-secondary))",
                    }}
                  >
                    <Icon className="h-3 w-3" /> {kind}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 p-6 text-sm text-ink-600 transition hover:border-brand-400 hover:bg-brand-50/50">
            <Upload className="h-4 w-4" />
            {uploading
              ? t("common.uploading")
              : evidenceKind === "photo"
              ? (photoUrl ? t("report.photo_dropzone_replace") : t("report.photo_dropzone_idle"))
              : (videoUrl ? "Replace video" : "Tap to upload a video (≤30s recommended)")}
            <input
              type="file"
              accept={evidenceKind === "photo" ? "image/*" : "video/*"}
              capture="environment"
              onChange={(e) => onPickFile(e.target.files?.[0])}
              className="hidden"
            />
          </label>
          {evidenceKind === "photo" && photoUrl && (
            <img src={photoUrl} alt="" className="mt-3 h-40 w-full rounded-xl border border-ink-200 object-cover" />
          )}
          {evidenceKind === "video" && videoUrl && (
            <video
              src={videoUrl}
              controls
              playsInline
              className="mt-3 h-48 w-full rounded-xl border border-ink-200 bg-black object-contain"
            />
          )}
          {evidenceKind === "video" && (
            <p className="mt-2 text-[11px] text-ink-500">
              Gemini 2.5 Flash samples frames from the clip — useful for moving water, traffic-blocking debris,
              or anything a still photo can&apos;t convey.
            </p>
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
