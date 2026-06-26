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

import { Reveal, Stagger } from "@/components/Motion";
import { Pill, SeverityPill, StatusPill } from "@/components/Pill";

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

interface Tracking {
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

const SOURCE_COPY: Record<string, { label: string; tone: "brand" | "amber" | "rose" | "ink" }> = {
  exif_and_browser_agree:           { label: "Located via your photo (verified)", tone: "brand" },
  exif_only:                        { label: "Located via your photo's EXIF",     tone: "brand" },
  browser_only:                     { label: "Browser GPS only — please confirm", tone: "amber" },
  exif_preferred_browser_disagrees: { label: "Photo & GPS disagreed — flagged",   tone: "rose"  },
  geocoded_from_address:            { label: "Located from your address",         tone: "amber" },
  unknown:                          { label: "Location unknown — ops will reach out", tone: "rose" },
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
  const [data, setData] = useState<Tracking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/tracking/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [id, tick]);

  if (err) return <div className="card p-6 text-sm text-rose-700">{err}</div>;
  if (!data) {
    return (
      <div className="card animate-pulse p-6 text-sm text-ink-400">Loading your report…</div>
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
              <div className="text-xs uppercase tracking-wider text-brand-200">Your report</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {issue.address ?? issue.type}
              </h1>
              <p className="mt-1 text-sm text-ink-300">
                Opened {opened.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill value={issue.status} />
              <SeverityPill value={issue.severity} />
              {issue.ward && <Pill tone="ink">{issue.ward}</Pill>}
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <Meta icon={MapPin} label="Location" value={`${issue.lat.toFixed(4)}, ${issue.lng.toFixed(4)}`} />
          <Meta icon={Truck} label="Department" value={issue.routed_department ?? "Routing…"} />
          <Meta
            icon={Clock}
            label="SLA"
            value={issue.sla_deadline ? new Date(issue.sla_deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
          />
        </div>

        {issue.location_resolver && (
          <div className="border-t border-ink-100 px-6 py-3">
            <LocationProvenance loc={issue.location_resolver} ward={issue.ward} />
          </div>
        )}
      </section>

      {/* ---- TIMELINE ---- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-700">Status updates</h2>
          <Pill tone="ink">{timeline.length}</Pill>
        </div>

        <div className="relative pl-6">
          <span className="absolute left-2 top-2 bottom-2 w-px bg-ink-200" aria-hidden />
          <Stagger step={0.06} className="space-y-3">
            <Reveal>
              <TimelineRow
                icon={Camera}
                tone="brand"
                title="You reported this"
                body={issue.description || "No description provided"}
                at={opened}
              />
            </Reveal>

            <AnimatePresence initial={false}>
              {timeline.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Bell;
                return (
                  <Reveal key={n.id}>
                    <TimelineRow
                      icon={Icon}
                      tone={KIND_TONE[n.kind] ?? "ink"}
                      title={n.title}
                      body={n.body}
                      at={new Date(n.created_at)}
                      channelTag={n.channel}
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
                  title="Awaiting next update"
                  body="The agent pipeline pushes the next status here automatically."
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
              <Truck className="h-4 w-4 text-brand-600" /> Assigned crew
            </div>
            <div className="mt-2 text-lg font-semibold">{crew.name}</div>
            <div className="text-xs text-ink-500">{crew.department}</div>
            {issue.scheduled_at && (
              <div className="mt-3 text-xs text-ink-600">
                Scheduled · {new Date(issue.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            )}
          </div>
        )}
        {reporter && (
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Award className="h-4 w-4 text-brand-600" /> Your contribution
            </div>
            <div className="mt-2 text-lg font-semibold">{reporter.name ?? "Anonymous"}</div>
            <div className="mt-1 font-mono text-2xl text-brand-700">{reporter.xp} XP</div>
            <div className="mt-3 text-xs text-ink-500">
              Hit the next badge tier to mint your soulbound NFT.
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}

function LocationProvenance({ loc, ward }: { loc: LocationResolver; ward: string | null }) {
  const meta = SOURCE_COPY[loc.source] ?? { label: loc.source, tone: "ink" as const };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <MapPin className="h-3.5 w-3.5 text-brand-600" />
      <Pill tone={meta.tone}>{meta.label}</Pill>
      {ward && <span className="text-ink-600">· Ward <strong>{ward}</strong>{loc.ward_no ? ` (#${loc.ward_no})` : ""}</span>}
      {loc.cross_check_km != null && (
        <span className="text-ink-500">
          · photo / GPS gap <span className="font-mono">{loc.cross_check_km.toFixed(2)} km</span>
        </span>
      )}
      {loc.geocoded_display && (
        <span className="text-ink-500 truncate max-w-md">· {loc.geocoded_display}</span>
      )}
      {loc.flagged_for_review && <Pill tone="rose">flagged for review</Pill>}
    </div>
  );
}

function LocationProvenance({ loc, ward }: { loc: LocationResolver; ward: string | null }) {
  const copy = SOURCE_COPY[loc.source] ?? { label: loc.source, tone: "ink" as const };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Pill tone={copy.tone}>{copy.label}</Pill>
      {ward && <Pill tone="ink">Ward · {ward}</Pill>}
      {loc.flagged_for_review && <Pill tone="rose">flagged for review</Pill>}
      {loc.cross_check_km != null && (
        <span className="text-ink-500">photo↔GPS gap: <span className="font-mono">{loc.cross_check_km} km</span></span>
      )}
      {loc.geocoded_display && (
        <span className="truncate text-ink-500 max-w-md">via address: {loc.geocoded_display}</span>
      )}
    </div>
  );
}

function LocationProvenance({ loc, ward }: { loc: LocationResolver; ward: string | null }) {
  const copy = SOURCE_COPY[loc.source] ?? SOURCE_COPY.unknown;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Pill tone={copy.tone}>
        <MapPin className="h-3 w-3" /> {copy.label}{ward ? ` · ${ward}` : ""}
      </Pill>
      {loc.cross_check_km != null && (
        <span className="font-mono text-ink-500">EXIF ↔ browser: {loc.cross_check_km.toFixed(1)} km</span>
      )}
      {loc.flagged_for_review && (
        <Pill tone="rose">flagged for ops review</Pill>
      )}
      {loc.geocoded_display && (
        <span className="text-ink-500 truncate">geocoded: “{loc.geocoded_display.slice(0, 80)}”</span>
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
}: {
  icon: typeof Bell;
  tone: "brand" | "amber" | "ink" | "rose" | "blue";
  title: string;
  body: string;
  at?: Date;
  pending?: boolean;
  channelTag?: string;
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
            {at && <span>{at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-600">{body}</p>
      </motion.div>
    </div>
  );
}
