"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Inbox,
  LogOut,
  MapPin,
  Mic,
  Receipt,
  Send,
  ShieldAlert,
  Siren,
  TrendingUp,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { deptFetch, deptLogout, getDeptSession, type DeptUser } from "@/lib/auth";

interface QueueItem {
  id: string;
  type: string;
  severity: number;
  status: string;
  ward: string | null;
  address: string | null;
  lat: number;
  lng: number;
  description: string;
  before_photo_url: string | null;
  before_video_url: string | null;
  before_audio_url: string | null;
  // V2 — AI Budget Estimator
  estimated_materials: { name: string; qty: number; unit: string }[];
  estimated_cost_inr: number | null;
  // V2 — Voice-first
  audio_transcript: string;
  audio_translation_en: string;
  audio_context: string;
  audio_language: string;
  audio_rejected: boolean;
  delivered_at: string | null;
  delivered_channel: string | null;
  acked_at: string | null;
  escalation_level: number;
  sla_deadline: string | null;
  sla_remaining_min: number | null;
  sla_tone: "red" | "amber" | "green";
  created_at: string;
}

interface QueueResponse {
  department: string;
  summary: {
    total: number;
    breached: number;
    amber: number;
    green: number;
    acked: number;
    escalated: number;
    // V2 rollup — sum of estimated_cost_inr + most-loaded materials
    materials_bill_inr: number;
    materials_top: { name: string; qty: number; unit: string }[];
  };
  items: QueueItem[];
}

interface StatsResponse {
  department: string;
  today: { opened: number; acked: number; resolved: number };
  open_now: number;
  breached_now: number;
  sla_ontime_7d_pct: number | null;
  resolved_7d: number;
}

interface DeliveryEntry {
  ticket_id: string;
  dept?: string;
  channel?: string;
  status?: string;
  escalation?: boolean;
  preview?: string;
  to?: string;
  logged_at?: string;
}

const TYPE_LABEL: Record<string, string> = {
  pothole: "Pothole", garbage: "Garbage", streetlight: "Streetlight",
  water_leak: "Water leak", sewage: "Sewage", tree_fall: "Fallen tree",
  encroachment: "Encroachment", other: "Other",
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", email: "Email", webhook: "Webhook", inapp_only: "In-app",
};

function fmtSlaRemaining(min: number | null): string {
  if (min == null) return "—";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const s = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return min < 0 ? `${s} late` : `${s} left`;
}

export default function SupervisorPage() {
  // Suspense boundary required by Next 14 around useSearchParams during SSG.
  return (
    <Suspense fallback={<div className="card animate-pulse p-6 text-sm">Loading supervisor dashboard…</div>}>
      <SupervisorPageInner />
    </Suspense>
  );
}

function SupervisorPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");

  const [me, setMe] = useState<DeptUser | null>(null);
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [delivery, setDelivery] = useState<DeliveryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Auth gate.
  useEffect(() => {
    const { user, token } = getDeptSession();
    if (!user || !token) { router.replace("/dept-login"); return; }
    setMe(user);
  }, [router]);

  // Poll queue + stats + delivery log every 8s.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    if (!me) return;
    const [q, s, d] = await Promise.all([
      deptFetch("/supervisor/queue").then((r) => r.ok ? r.json() : null),
      deptFetch("/supervisor/stats").then((r) => r.ok ? r.json() : null),
      deptFetch("/supervisor/delivery-log?limit=20").then((r) => r.ok ? r.json() : null),
    ]);
    setQueue(q); setStats(s); setDelivery((d?.entries ?? []) as DeliveryEntry[]);
    if (!selectedId && q?.items?.length) setSelectedId(q.items[0].id);
  }, [me, selectedId]);

  useEffect(() => { refresh(); }, [refresh, tick]);

  async function ack(id: string) {
    setBusy(id);
    try {
      await deptFetch(`/supervisor/issue/${id}/ack`, { method: "POST" });
      await refresh();
    } finally { setBusy(null); }
  }

  async function escalate(id: string) {
    setBusy(id);
    try {
      await deptFetch(`/supervisor/issue/${id}/escalate`, { method: "POST" });
      await refresh();
    } finally { setBusy(null); }
  }

  function signOut() {
    deptLogout();
    router.replace("/dept-login");
  }

  if (!me) {
    return <div className="card animate-pulse p-6 text-sm text-ink-500">Checking your session…</div>;
  }

  const selected = queue?.items.find((q) => q.id === selectedId) ?? queue?.items[0] ?? null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* ─── Header ─── */}
      <header className="card overflow-hidden">
        <div className="bg-hero-gradient p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-brand-200">
                <Building2 className="h-3 w-3" /> Department supervisor
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {me.department_name}
              </h1>
              <div className="mt-1 font-mono text-xs text-ink-300">
                {me.name} · @{me.username} · {me.role}
              </div>
            </div>
            <button onClick={signOut} className="btn-ghost text-xs">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
          {stats && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <KPI label="Open now" value={stats.open_now} />
              <KPI label="Breached" value={stats.breached_now} tone={stats.breached_now > 0 ? "red" : "white"} />
              <KPI label="Opened today" value={stats.today.opened} />
              <KPI label="Acked today" value={stats.today.acked} />
              <KPI label="On-time 7d" value={stats.sla_ontime_7d_pct ?? "—"} suffix={stats.sla_ontime_7d_pct != null ? "%" : ""} />
            </div>
          )}
        </div>

        {/* V2 — Today's truck-loading bill. Sums the per-issue Gemini cost
            estimates across this dept's open queue + lists the most-loaded
            materials so the depot supervisor knows exactly what to pre-load
            on the dispatch truck. The marketing copy says "budgeted line
            item before the truck even leaves the depot" — this is that. */}
        {queue && (queue.summary.materials_bill_inr > 0 || queue.summary.materials_top.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 border-t px-6 py-3"
            style={{
              background: "linear-gradient(90deg, rgba(245, 158, 11, 0.06) 0%, rgb(var(--bg-surface)) 100%)",
              borderColor: "rgba(245, 158, 11, 0.20)",
            }}>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg text-white"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                <Receipt className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-wider"
                  style={{ color: "rgb(var(--text-muted))" }}>
                  Today&apos;s truck-loading bill
                </div>
                <div className="text-base font-semibold">
                  ≈ ₹{queue.summary.materials_bill_inr.toLocaleString("en-IN")}
                  <span className="ml-1 text-[10px] font-normal"
                    style={{ color: "rgb(var(--text-muted))" }}>
                    across {queue.summary.total} open tickets
                  </span>
                </div>
              </div>
            </div>
            {queue.summary.materials_top.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider"
                  style={{ color: "rgb(var(--text-muted))" }}>
                  Pre-load:
                </span>
                {queue.summary.materials_top.map((m, i) => (
                  <span key={`${m.name}-${i}`}
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      background: "rgb(var(--bg-surface-hover))",
                      border: "1px solid rgb(var(--border-light))",
                    }}>
                    <strong>{Number.isInteger(m.qty) ? m.qty : m.qty.toFixed(1)}</strong>{" "}
                    <span style={{ color: "rgb(var(--text-muted))" }}>{m.unit}</span>{" "}
                    · {m.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* ─── Body — 3 columns ─── */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr_300px]">
        {/* ── Left: SLA queue ── */}
        <aside className="space-y-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-700">Queue</h2>
            {queue && (
              <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-500">
                {queue.summary.total} open · {queue.summary.breached} red
              </span>
            )}
          </div>
          <div className="space-y-2">
            {!queue ? (
              <div className="card animate-pulse p-4 text-xs text-ink-400">Loading…</div>
            ) : queue.items.length === 0 ? (
              <div className="card p-4 text-xs text-ink-500">No open tickets. </div>
            ) : queue.items.map((it) => {
              const dotColor =
                it.sla_tone === "red"   ? "#dc2626"
                : it.sla_tone === "amber" ? "#f59e0b"
                : "#10b981";
              const isActive = it.id === selectedId;
              return (
                <button
                  key={it.id}
                  onClick={() => setSelectedId(it.id)}
                  className="block w-full rounded-xl p-3 text-left transition"
                  style={{
                    background: isActive ? "rgba(191, 79, 54, 0.08)" : "rgb(var(--bg-surface))",
                    border: isActive
                      ? "1px solid rgba(191, 79, 54, 0.40)"
                      : "1px solid rgb(var(--border-light))",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dotColor }} />
                      <span className="truncate text-sm font-semibold">
                        {TYPE_LABEL[it.type] ?? it.type}
                      </span>
                      <span className="rounded bg-ink-100 px-1 text-[10px] font-semibold text-ink-700">
                        sev {it.severity}
                      </span>
                    </div>
                    {it.escalation_level > 0 && (
                      <span title={`Escalation level ${it.escalation_level}`}
                        className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-700">
                        ESC L{it.escalation_level}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-ink-500">
                    {it.ward ?? "—"} · {it.address ?? "(no address)"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-mono" style={{ color: dotColor }}>
                      {fmtSlaRemaining(it.sla_remaining_min)}
                    </span>
                    {it.acked_at && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold uppercase text-emerald-700">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Acked
                      </span>
                    )}
                    {it.delivered_channel && (
                      <span className="rounded-full bg-ink-100 px-1.5 py-0.5 font-mono text-ink-600">
                        {CHANNEL_LABEL[it.delivered_channel] ?? it.delivered_channel}
                      </span>
                    )}
                    {/* V2 — Estimator chip: cost lands per row */}
                    {typeof it.estimated_cost_inr === "number" && it.estimated_cost_inr > 0 && (
                      <span title="AI budget estimate"
                        className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                        ≈ ₹{it.estimated_cost_inr.toLocaleString("en-IN")}
                      </span>
                    )}
                    {/* V2 — Voice-note chip with the detected language */}
                    {it.audio_language && !it.audio_rejected && (
                      <span title="Citizen attached a voice note"
                        className="rounded-full bg-purple-100 px-1.5 py-0.5 font-semibold uppercase text-purple-700">
                        🎙 {it.audio_language}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Middle: detail panel ── */}
        <main>
          <AnimatePresence mode="wait">
            {!selected ? (
              <div key="empty" className="card p-8 text-center text-sm text-ink-500">
                <Inbox className="mx-auto mb-2 h-6 w-6 text-ink-400" />
                Pick a ticket from the queue.
              </div>
            ) : (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                {/* Top — title + SLA + actions */}
                <div className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-500">
                        Ticket {selected.id.slice(0, 8)} · {selected.status}
                      </div>
                      <h2 className="mt-0.5 text-xl font-semibold">
                        {TYPE_LABEL[selected.type] ?? selected.type}
                        <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-xs font-semibold text-ink-700">
                          severity {selected.severity}/5
                        </span>
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
                        <MapPin className="h-3 w-3" />
                        {selected.ward ?? "—"} · {selected.address ?? "(no address)"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[10px] uppercase tracking-wider text-ink-500">SLA</div>
                      <div className="flex items-center gap-1 font-mono text-sm font-semibold"
                        style={{
                          color:
                            selected.sla_tone === "red" ? "#dc2626"
                            : selected.sla_tone === "amber" ? "#b45309"
                            : "#15803d",
                        }}>
                        <Clock className="h-3.5 w-3.5" />
                        {fmtSlaRemaining(selected.sla_remaining_min)}
                      </div>
                      {selected.sla_deadline && (
                        <div className="font-mono text-[10px] text-ink-500">
                          due {new Date(selected.sla_deadline).toLocaleString("en-IN", {
                            dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
                          })} IST
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery / ack / escalation status pills */}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    {selected.delivered_at ? (
                      <Pill tone="ink">
                        <Send className="h-3 w-3" /> Sent via {CHANNEL_LABEL[selected.delivered_channel ?? ""] ?? "—"} ·{" "}
                        {new Date(selected.delivered_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST
                      </Pill>
                    ) : (
                      <Pill tone="rose">Not yet dispatched</Pill>
                    )}
                    {selected.acked_at ? (
                      <Pill tone="emerald">
                        <CheckCircle2 className="h-3 w-3" /> Acknowledged ·{" "}
                        {new Date(selected.acked_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST
                      </Pill>
                    ) : (
                      <Pill tone="amber">Awaiting acknowledgement</Pill>
                    )}
                    {selected.escalation_level > 0 && (
                      <Pill tone="rose">
                        <Siren className="h-3 w-3" /> Escalation level {selected.escalation_level}
                      </Pill>
                    )}
                  </div>

                  {/* Action buttons (supervisor only) */}
                  {me.role === "supervisor" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => ack(selected.id)}
                        disabled={!!selected.acked_at || busy === selected.id}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: "rgb(var(--accent))" }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {selected.acked_at ? "Acknowledged" : "Acknowledge"}
                      </button>
                      <button
                        onClick={() => escalate(selected.id)}
                        disabled={selected.escalation_level >= 3 || busy === selected.id}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{
                          background: "rgb(var(--bg-surface-hover))",
                          border: "1px solid rgb(var(--border-color))",
                          color: "rgb(var(--text-primary))",
                        }}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Escalate manually ({selected.escalation_level}/3)
                      </button>
                      <a
                        href={`/tracking/${selected.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                        style={{
                          background: "rgb(var(--bg-surface-hover))",
                          border: "1px solid rgb(var(--border-color))",
                          color: "rgb(var(--text-primary))",
                        }}
                      >
                        Citizen view <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Description + evidence */}
                <div className="card p-5">
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">Citizen description</div>
                  <p className="mt-1 text-sm">{selected.description || "(none)"}</p>
                  {selected.before_video_url ? (
                    <video src={selected.before_video_url} controls playsInline preload="metadata"
                      className="mt-3 max-h-64 w-full rounded-xl border border-ink-200 bg-black object-contain" />
                  ) : selected.before_photo_url ? (
                    <img src={selected.before_photo_url} alt="Evidence"
                      className="mt-3 max-h-64 w-full rounded-xl border border-ink-200 object-contain" />
                  ) : null}
                </div>

                {/* V2 — Voice note + Gemini transcript/translation/context.
                    Surfaces the citizen's actual words AND the AI summary so
                    a Hindi/Kannada/Telugu voice note works for the supervisor
                    who may only read English. PII already redacted server-side. */}
                {(selected.audio_transcript || selected.audio_translation_en || selected.before_audio_url) && (
                  <div className="card p-5"
                    style={{ borderColor: "rgba(168, 85, 247, 0.30)" }}>
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4" style={{ color: "#7e22ce" }} />
                      <div className="text-[10px] uppercase tracking-wider text-ink-500">
                        Citizen voice note
                      </div>
                      {selected.audio_language && (
                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700">
                          {selected.audio_language}
                        </span>
                      )}
                      {selected.audio_rejected && (
                        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                          Rejected by guardrail
                        </span>
                      )}
                    </div>
                    {selected.before_audio_url && (
                      <audio src={selected.before_audio_url} controls className="mt-3 w-full" />
                    )}
                    {selected.audio_transcript && (
                      <div className="mt-3">
                        <div className="text-[10px] uppercase tracking-wider text-ink-500">Verbatim transcript</div>
                        <p className="mt-1 text-sm" dir="auto">
                          {selected.audio_transcript}
                        </p>
                      </div>
                    )}
                    {selected.audio_translation_en && selected.audio_language !== "en" && (
                      <div className="mt-3 rounded-xl p-3"
                        style={{ background: "rgb(var(--bg-surface-hover))", border: "1px solid rgb(var(--border-light))" }}>
                        <div className="text-[10px] uppercase tracking-wider text-ink-500">English translation</div>
                        <p className="mt-1 text-sm italic">{selected.audio_translation_en}</p>
                      </div>
                    )}
                    {selected.audio_context && (
                      <div className="mt-3 rounded-xl p-3"
                        style={{ background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                        <div className="text-[10px] uppercase tracking-wider"
                          style={{ color: "#b45309" }}>What the voice note adds</div>
                        <p className="mt-1 text-sm">{selected.audio_context}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* V2 — Estimator panel (per-issue). Mirrors the rollup at
                    the top of the page but with the specific materials for
                    THIS ticket so the crew knows what to put on the truck. */}
                {(selected.estimated_materials?.length ?? 0) > 0 && (
                  <div className="card p-5">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" style={{ color: "#b45309" }} />
                      <div className="text-[10px] uppercase tracking-wider text-ink-500">
                        AI budget estimate
                      </div>
                      {typeof selected.estimated_cost_inr === "number" && (
                        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-800">
                          ≈ ₹{selected.estimated_cost_inr.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {selected.estimated_materials.map((m, i) => (
                        <li key={`${m.name}-${i}`}
                          className="rounded-xl px-2.5 py-1 text-xs"
                          style={{
                            background: "rgb(var(--bg-surface-hover))",
                            border: "1px solid rgb(var(--border-light))",
                          }}>
                          <span className="font-semibold">{m.qty}</span>{" "}
                          <span className="text-ink-500">{m.unit}</span> · {m.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ── Right: delivery log + escalation feed ── */}
        <aside className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ink-500" />
            <h2 className="text-sm font-semibold text-ink-700">Recent dispatches</h2>
          </div>
          <div className="space-y-2">
            {delivery.length === 0 ? (
              <div className="card p-3 text-xs text-ink-500">No dispatches yet.</div>
            ) : delivery.slice(0, 12).map((e, i) => {
              const isSim = (e.status ?? "").startsWith("simulated");
              return (
                <div key={i} className="card p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">{e.ticket_id?.slice(0, 8)}</span>
                    {e.escalation && (
                      <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-700">
                        Escalation
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Send className="h-3 w-3 text-ink-400" />
                    <span style={{ color: "rgb(var(--text-secondary))" }}>
                      via {CHANNEL_LABEL[e.channel ?? ""] ?? e.channel ?? "—"}
                    </span>
                    {isSim && (
                      <span className="rounded bg-amber-100 px-1 text-[9px] font-semibold uppercase text-amber-700">
                        Simulated
                      </span>
                    )}
                  </div>
                  {e.preview && (
                    <p className="mt-1.5 text-[11px] leading-snug text-ink-600 line-clamp-3">
                      {e.preview}
                    </p>
                  )}
                  {e.to && (
                    <div className="mt-1 font-mono text-[10px] text-ink-400">to {e.to}</div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <footer className="rounded-xl p-3 text-[11px] text-ink-500"
        style={{ background: "rgb(var(--bg-surface-hover))", border: "1px solid rgb(var(--border-light))" }}>
        <ShieldAlert className="mr-1 inline h-3 w-3" />
        Demo mode: WhatsApp / email dispatches are simulated unless WHATSAPP_API_KEY or SMTP_HOST are set in the API .env.
        Every dispatch is recorded in <code className="font-mono">data/delivery_log.jsonl</code>.
        The SLA watcher escalates breached tickets every 60s.
      </footer>
    </motion.div>
  );
}

/* ────────── helpers ────────── */

function KPI({ label, value, suffix = "", tone = "white" }:
  { label: string; value: number | string; suffix?: string; tone?: "white" | "red" }) {
  const color = tone === "red" ? "#fda4af" : "white";
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-3 text-center backdrop-blur">
      <div className="text-2xl font-semibold" style={{ color }}>{value}{suffix}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-300">{label}</div>
    </div>
  );
}

function Pill({ tone, children }:
  { tone: "ink" | "rose" | "emerald" | "amber"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    ink:     "bg-ink-100 text-ink-700",
    rose:    "bg-rose-100 text-rose-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber:   "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${map[tone]}`}>
      {children}
    </span>
  );
}
