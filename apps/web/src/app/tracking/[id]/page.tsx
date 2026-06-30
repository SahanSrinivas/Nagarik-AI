"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Shield,
  Sparkles,
  Truck,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CommunityFixCard } from "@/components/CommunityFixCard";
import { Reveal, Stagger } from "@/components/Motion";
import { Pill, SeverityPill, StatusPill } from "@/components/Pill";
import { ShareFixButton } from "@/components/ShareFixButton";
import { useI18n } from "@/i18n";

interface LocationResolver {
  source: string;
  ward: string | null;
  ward_no: number | null;
  exif_lat: number | null;
  exif_lng: number | null;
  browser_lat: number | null;
  browser_lng: number | null;
  cross_check_km: number | null;
  flagged_for_review: boolean;
  geocoded_display: string | null;
  geocoder_confidence: number | null;
}

interface WhatsAppMark {
  logged_at: string;
  status: string;
  to: string;
}

interface Tracking {
  whatsapp_opt_in?: boolean;
  whatsapp_to?: string | null;
  whatsapp_by_kind?: Record<string, WhatsAppMark>;
  issue: {
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
    before_video_url?: string | null;
    after_video_url?: string | null;
    before_audio_url?: string | null;
    audio_transcript?: string;
    audio_translation_en?: string;
    audio_context?: string;
    audio_language?: string;
    audio_rejected?: boolean;
    share_image_url?: string | null;
    diy_unlocked_at?: string | null;
    estimated_materials?: { name: string; qty: number; unit: string }[];
    estimated_cost_inr?: number | null;
    ai_confidence?: number;
    ai_bbox?: [number, number, number, number] | null;   // normalised 0-1
    ai_focus_label?: string | null;
    ai_notes?: string | null;
    routed_department: string | null;
    sla_deadline: string | null;
    scheduled_at: string | null;
    resolved_at: string | null;
    created_at: string;
    location_resolver: LocationResolver | null;
  };
  reporter: { id: string | null; name: string | null; xp: number };
  crew: { id: string; name: string; department: string } | null;
  timeline: { id: string; kind: string; title: string; body: string; channel: string; created_at: string; read_at: string | null }[];
}

const SOURCE_TONE: Record<string, "brand" | "amber" | "rose" | "ink"> = {
  exif_and_browser_agree:           "brand",
  exif_only:                        "brand",
  browser_only:                     "amber",
  exif_preferred_browser_disagrees: "rose",
  geocoded_from_address:            "amber",
  unknown:                          "rose",
};

const KIND_ICON: Record<string, typeof Bell> = {
  classified: Sparkles,
  deduped: Shield,
  triaged: ChevronRight,
  verified: CheckCircle2,
  scheduled: Truck,
  in_progress: Truck,
  resolved: Award,
  rejected: Shield,
};

const KIND_TONE: Record<string, "brand" | "amber" | "ink" | "rose" | "blue"> = {
  classified: "blue",
  deduped: "ink",
  triaged: "blue",
  verified: "brand",
  scheduled: "amber",
  in_progress: "amber",
  resolved: "brand",
  rejected: "rose",
};

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useI18n();
  const [data, setData] = useState<Tracking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Poll while the issue is still progressing; stop once it's resolved
  // (no further state changes possible — saves a continuous 2s-cadence
  // request storm that was making the page feel slow).
  // Was: setInterval(... 2000). Now: 8s while active, no polling once
  // the timeline is terminal.
  const isTerminal =
    data?.issue?.status === "resolved" ||
    data?.issue?.status === "closed" ||
    data?.issue?.status === "rejected";

  useEffect(() => {
    if (isTerminal) return;
    const t = setInterval(() => setTick((x) => x + 1), 8000);
    return () => clearInterval(t);
  }, [isTerminal]);

  useEffect(() => {
    if (!id) return;
    // Pass lang so the backend translates notification title/body via Gemini.
    fetch(`${BASE}/tracking/${id}?lang=${encodeURIComponent(lang)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [id, tick, lang]);

  if (err) return <div className="card p-6 text-sm text-rose-700">{err}</div>;
  if (!data) {
    // Don't use the i18n "common.uploading" key here — the Gemini-translated
    // EN string for it literally says "Uploading…" which is misleading on
    // the tracking page (the user is just waiting for the page to fetch).
    return (
      <div className="card animate-pulse p-6 text-sm text-ink-400">
        Loading issue details…
      </div>
    );
  }

  const { issue, reporter, crew, timeline } = data;
  const opened = new Date(issue.created_at);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* ---- HEADER ---- */}
      <section className="card overflow-hidden">
        <div className="bg-hero-gradient p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-brand-200">{t("tracking.your_report")}</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {issue.address ?? t(`issue.type.${issue.type}`, issue.type)}
              </h1>
              <p className="mt-1 text-sm text-ink-300">
                {t("tracking.opened")} {opened.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill value={issue.status} />
              <SeverityPill value={issue.severity} />
              {issue.ward && (
                <span className="pill bg-white/15 text-white ring-1 ring-inset ring-white/25">
                  {issue.ward}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <Meta icon={MapPin} label={t("tracking.location")} value={`${issue.lat.toFixed(4)}, ${issue.lng.toFixed(4)}`} />
          <Meta icon={Truck} label={t("tracking.department")} value={issue.routed_department ?? t("tracking.routing")} />
          <Meta
            icon={Clock}
            label={t("tracking.sla")}
            value={issue.sla_deadline ? new Date(issue.sla_deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) + " IST" : "—"}
          />
        </div>

        {issue.location_resolver && (
          <div className="border-t border-ink-100 px-6 py-3">
            <LocationProvenance loc={issue.location_resolver} ward={issue.ward} />
          </div>
        )}

        {(issue.before_video_url || issue.before_photo_url) && (
          <div className="border-t border-ink-100 px-6 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgb(var(--accent))" }}>
                {issue.before_video_url ? "Video evidence · AI focus" : "Photo / video evidence · AI focus"}
              </div>
              {issue.ai_focus_label && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  AI saw · {(issue.ai_confidence ?? 0) > 0 ? `${Math.round((issue.ai_confidence ?? 0) * 100)}% conf` : "verified"}
                </span>
              )}
            </div>
            {issue.before_video_url ? (
              <video
                src={issue.before_video_url}
                controls
                playsInline
                preload="metadata"
                className="mt-2 max-h-72 w-full rounded-xl border border-ink-200 bg-black object-contain"
              />
            ) : (
              <AIPhotoMask
                url={issue.before_photo_url!}
                bbox={issue.ai_bbox ?? null}
                label={issue.ai_focus_label ?? prettifyType(issue.type)}
              />
            )}
            {issue.ai_notes && (
              <p className="mt-2 text-xs italic" style={{ color: "rgb(var(--text-muted))" }}>
                AI notes: &ldquo;{issue.ai_notes}&rdquo;
              </p>
            )}
          </div>
        )}

        {issue.after_photo_url && (
          <div className="border-t border-ink-100 px-6 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#15803d" }}>
                After-photo · CLIP + CNN verified
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Fix verified
              </span>
            </div>
            <AIPhotoMask
              url={issue.after_photo_url}
              bbox={issue.ai_bbox ?? null}
              label="fix verified"
              tone="verified"
            />
            {/* Viral before/after share — one-tap share to WhatsApp/X via
                Web Share API. The PNG is rendered server-side by share.py. */}
            <div className="mt-3">
              <ShareFixButton
                issueId={issue.id}
                shareImagePath={issue.share_image_url ?? null}
                resolvedAt={issue.resolved_at}
                createdAt={issue.created_at}
                issueType={issue.type}
              />
            </div>
          </div>
        )}

        {/* V2 — Voice-first transcript + translation. Shown to the citizen
            so they can verify what was understood + see the Gemini
            context-summary that goes to the dispatcher. */}
        {(issue.audio_transcript || issue.before_audio_url) && (
          <div className="border-t border-ink-100 px-6 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgb(var(--accent))" }}>
                Your voice note · Gemini multimodal
              </div>
              <div className="flex items-center gap-1.5">
                {issue.audio_language && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-purple-700">
                    {issue.audio_language}
                  </span>
                )}
                {issue.audio_rejected && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                    Voice note rejected
                  </span>
                )}
              </div>
            </div>
            {issue.before_audio_url && (
              <audio src={issue.before_audio_url} controls className="mt-2 w-full" />
            )}
            {issue.audio_transcript && (
              <p className="mt-2 text-sm" dir="auto" style={{ color: "rgb(var(--text-primary))" }}>
                &ldquo;{issue.audio_transcript}&rdquo;
              </p>
            )}
            {issue.audio_translation_en && issue.audio_language !== "en" && (
              <p className="mt-1 text-xs italic" style={{ color: "rgb(var(--text-muted))" }}>
                EN: {issue.audio_translation_en}
              </p>
            )}
            {issue.audio_context && (
              <p className="mt-2 text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
                <strong>Dispatcher hint:</strong> {issue.audio_context}
              </p>
            )}
          </div>
        )}

        {/* AI Budget Estimator — surfaces the Vision Agent's materials/cost
            so a supervisor can plan truck-loading at a glance. */}
        {(issue.estimated_materials?.length ?? 0) > 0 && (
          <div className="border-t border-ink-100 px-6 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgb(var(--accent))" }}>
                AI budget estimate
              </div>
              {typeof issue.estimated_cost_inr === "number" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                  ≈ ₹{issue.estimated_cost_inr.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {(issue.estimated_materials ?? []).map((m, i) => (
                <li key={`${m.name}-${i}`}
                  className="rounded-xl px-2.5 py-1 text-xs"
                  style={{
                    background: "rgb(var(--bg-surface-hover))",
                    border: "1px solid rgb(var(--border-light))",
                  }}>
                  <span className="font-semibold">{m.qty}</span>{" "}
                  <span style={{ color: "rgb(var(--text-muted))" }}>{m.unit}</span>{" "}
                  · {m.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
              Gemini estimates physical dimensions from the photo, then maps
              to a fixed unit-price table. Helps the dispatcher pre-load the truck.
            </p>
          </div>
        )}
      </section>

      {/* Community DIY + crowdfunding — only renders when sev≤2 issue has
          breached its level-3 SLA. The card no-ops otherwise. */}
      <CommunityFixCard issueId={issue.id} />

      {/* ---- TIMELINE ---- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-700">{t("tracking.status_updates")}</h2>
          <Pill tone="ink">{timeline.length}</Pill>
        </div>

        <div className="relative pl-6">
          <span className="absolute left-2 top-2 bottom-2 w-px bg-ink-200" aria-hidden />
          <Stagger step={0.06} className="space-y-3">
            <Reveal>
              <TimelineRow
                icon={Camera}
                tone="brand"
                title={t("tracking.you_reported_this")}
                body={issue.description || t("tracking.no_description")}
                at={opened}
              />
            </Reveal>

            <AnimatePresence initial={false}>
              {timeline.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Bell;
                const wa = data.whatsapp_by_kind?.[n.kind];
                return (
                  <Reveal key={n.id}>
                    <TimelineRow
                      icon={Icon}
                      tone={KIND_TONE[n.kind] ?? "ink"}
                      title={n.title}
                      body={n.body}
                      at={new Date(n.created_at)}
                      channelTag={n.channel}
                      whatsapp={wa ? { sent_at: wa.logged_at, status: wa.status } : undefined}
                    />
                  </Reveal>
                );
              })}
            </AnimatePresence>

            {issue.status !== "resolved" && (
              <Reveal>
                <TimelineRow
                  icon={Clock}
                  tone="ink"
                  pending
                  title={t("tracking.awaiting_next")}
                  body={t("tracking.awaiting_body")}
                />
              </Reveal>
            )}
          </Stagger>
        </div>
      </section>

      {/* ---- SIDE INFO ---- */}
      <section className="grid gap-4 sm:grid-cols-2">
        {crew && (
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Truck className="h-4 w-4 text-brand-600" /> {t("tracking.assigned_crew")}
            </div>
            <div className="mt-2 text-lg font-semibold">{crew.name}</div>
            <div className="text-xs text-ink-500">{crew.department}</div>
            {issue.scheduled_at && (
              <div className="mt-3 text-xs text-ink-600">
                {t("tracking.scheduled")} · {new Date(issue.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST
              </div>
            )}
          </div>
        )}
        {reporter && (
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Award className="h-4 w-4 text-brand-600" /> {t("tracking.your_contribution")}
            </div>
            <div className="mt-2 text-lg font-semibold">{reporter.name ?? "Anonymous"}</div>
            <div className="mt-1 font-mono text-2xl text-brand-700">{reporter.xp} XP</div>
            <div className="mt-3 text-xs text-ink-500">
              {t("tracking.next_badge_hint")}
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}

function LocationProvenance({ loc, ward }: { loc: LocationResolver; ward: string | null }) {
  const { t } = useI18n();
  const tone = SOURCE_TONE[loc.source] ?? "ink";
  const label = t(`loc.${loc.source}`, loc.source);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Pill tone={tone}>
        <MapPin className="h-3 w-3" /> {label}{ward ? ` · ${ward}${loc.ward_no ? ` (#${loc.ward_no})` : ""}` : ""}
      </Pill>
      {loc.cross_check_km != null && (
        <span className="font-mono text-ink-500">EXIF ↔ browser: {loc.cross_check_km.toFixed(1)} km</span>
      )}
      {loc.flagged_for_review && (
        <Pill tone="rose">{t("loc.flagged_for_review")}</Pill>
      )}
      {loc.geocoded_display && (
        <span className="text-ink-500 truncate">{loc.geocoded_display.slice(0, 80)}</span>
      )}
    </div>
  );
}


function Meta({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-ink-900">{value}</div>
      </div>
    </div>
  );
}

function TimelineRow({
  icon: Icon,
  tone,
  title,
  body,
  at,
  pending = false,
  channelTag,
  whatsapp,
}: {
  icon: typeof Bell;
  tone: "brand" | "amber" | "ink" | "rose" | "blue";
  title: string;
  body: string;
  at?: Date;
  pending?: boolean;
  channelTag?: string;
  whatsapp?: { sent_at?: string; status?: string };
}) {
  const accent =
    tone === "brand" ? "bg-brand-500" :
    tone === "amber" ? "bg-amber-500" :
    tone === "rose" ? "bg-rose-500" :
    tone === "blue" ? "bg-blue-500" :
    "bg-ink-400";
  return (
    <div className="relative">
      <span
        className={`absolute -left-[18px] top-3 grid h-5 w-5 place-items-center rounded-full ${pending ? "bg-ink-200" : accent} text-white shadow`}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      <motion.div
        layout
        whileHover={{ y: -2 }}
        className={`card p-4 ${pending ? "opacity-70" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-ink-900">{title}</div>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            {channelTag && <Pill tone="ink">{channelTag}</Pill>}
            {at && <span>{at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST</span>}
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-600">{body}</p>
        {whatsapp && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]"
            style={{
              background: "rgba(37, 211, 102, 0.10)",
              color: "#15803d",
              border: "1px solid rgba(37, 211, 102, 0.30)",
            }}
          >
            <Bell className="h-2.5 w-2.5" />
            Forwarded to WhatsApp
            {whatsapp.sent_at && (
              <span className="font-mono">
                · {new Date(whatsapp.sent_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST
              </span>
            )}
            {whatsapp.status === "simulated" && (
              <span className="rounded bg-amber-100 px-1 text-[9px] font-semibold uppercase text-amber-700">
                sim
              </span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/**
 * AIPhotoMask — renders the citizen's photo with an SVG overlay showing
 * the bounding box the Vision agent returned. The box is drawn in
 * normalised viewBox coordinates so it lines up no matter what aspect
 * ratio the photo has.
 *
 * If Gemini didn't return a usable bbox we fall back to a centred 60%
 * crop so the layout still reads as 'AI focused here', just with less
 * precision. The 'verified' tone (used on the after-photo) flips the
 * stroke to emerald to signal a passed CLIP+CNN audit.
 */
function AIPhotoMask({ url, bbox, label, tone = "default" }:
  { url: string; bbox: [number, number, number, number] | null; label: string;
    tone?: "default" | "verified" }) {
  // Fallback box: centred 60% × 60%. Keeps the demo from breaking when the
  // model didn't return a bbox (e.g., stub fallback when GOOGLE_API_KEY is unset).
  const [x0, y0, x1, y1] = bbox ?? [0.2, 0.2, 0.8, 0.8];
  const stroke = tone === "verified" ? "#10b981" : "rgb(var(--accent))";
  const fill   = tone === "verified" ? "rgba(16,185,129,0.10)" : "rgba(191,79,54,0.10)";

  return (
    <div className="relative mt-2 overflow-hidden rounded-xl border border-ink-200">
      <img src={url} alt="Reported issue" className="block max-h-72 w-full object-contain" />
      {/* Overlay — absolutely positioned to match the image, uses % to track resize */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label={`AI focus area · ${label}`}
      >
        {/* Tint mask — slight dim outside the bbox so the focus area pops */}
        <defs>
          <mask id={`ai-mask-${tone}-${Math.round(x0 * 1000)}`}>
            <rect x={0} y={0} width={100} height={100} fill="white" />
            <rect x={x0 * 100} y={y0 * 100}
              width={(x1 - x0) * 100} height={(y1 - y0) * 100} fill="black" />
          </mask>
        </defs>
        <rect x={0} y={0} width={100} height={100}
          fill="rgba(0,0,0,0.20)"
          mask={`url(#ai-mask-${tone}-${Math.round(x0 * 1000)})`} />
        {/* The focus box itself */}
        <rect
          x={x0 * 100} y={y0 * 100}
          width={(x1 - x0) * 100} height={(y1 - y0) * 100}
          fill={fill} stroke={stroke} strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
        {/* Corner ticks for the 'targeting reticule' look */}
        {[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([cx, cy], i) => (
          <g key={i}>
            <line x1={cx * 100 - 2} y1={cy * 100} x2={cx * 100 + 2} y2={cy * 100}
              stroke={stroke} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
            <line x1={cx * 100} y1={cy * 100 - 2} x2={cx * 100} y2={cy * 100 + 2}
              stroke={stroke} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      {/* Label pill — anchored at top-right inside the overlay */}
      <span
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow"
        style={{ background: stroke }}
      >
        {tone === "verified" ? "✓" : "◎"} {label}
      </span>
      {!bbox && (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white">
          fallback crop — Gemini bbox unavailable
        </span>
      )}
    </div>
  );
}

function prettifyType(t: string): string {
  const m: Record<string, string> = {
    pothole: "pothole", garbage: "garbage", streetlight: "broken light",
    water_leak: "water leak", sewage: "sewage", tree_fall: "fallen tree",
    encroachment: "encroachment", other: "issue",
  };
  return m[t] ?? t;
}
