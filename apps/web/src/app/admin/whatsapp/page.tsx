"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MessageCircle,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Recipient {
  phone: string;
  first_seen: string;
  last_attempt?: string;
  send_count: number;
  meta_status?: "registered" | "unregistered" | "unknown" | "error";
  last_error?: string;
}

interface Summary {
  slots_total: number;
  slots_used: number;
  slots_free: number;
  pending_adds: number;
  all_recipients: Recipient[];
  provider: string;
  sender_number?: string | null;
  phone_number_id?: string | null;
  business_account_id?: string | null;
  meta_dashboard_url?: string;
}

const META_DASHBOARD = "https://developers.facebook.com/apps/";

export default function WhatsAppAdminPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch(`${BASE}/whatsapp/recipients`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  function copyPhone(phone: string) {
    navigator.clipboard.writeText(phone).then(() => {
      setCopied(phone);
      setTimeout(() => setCopied(null), 1600);
    });
  }

  if (!data) {
    return <div className="card animate-pulse p-6 text-sm">Loading WhatsApp roster…</div>;
  }

  const dashUrl = data.business_account_id
    ? `https://business.facebook.com/wa/manage/phone-numbers/?waba_id=${data.business_account_id}`
    : META_DASHBOARD;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl space-y-6">
      <header className="card overflow-hidden">
        <div className="bg-hero-gradient p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-brand-200">
                <MessageCircle className="h-3 w-3" /> WhatsApp · sandbox
              </div>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Test recipient roster</h1>
              <div className="mt-1 text-sm text-ink-300">
                Sender: <code className="font-mono">{data.sender_number ?? "—"}</code>
                {data.phone_number_id && (
                  <> · phone_number_id <code className="font-mono">{data.phone_number_id}</code></>
                )}
              </div>
            </div>
            <SlotMeter used={data.slots_used} total={data.slots_total} />
          </div>
        </div>
      </header>

      {/* Why this exists */}
      <section className="rounded-2xl border p-5 text-sm"
        style={{
          background: "rgba(245, 158, 11, 0.10)",
          borderColor: "rgba(245, 158, 11, 0.40)",
          color: "rgb(var(--text-primary))",
        }}>
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" style={{ color: "#b45309" }} />
          Why we can&apos;t auto-add recipients
        </div>
        <p style={{ color: "rgb(var(--text-secondary))" }}>
          Meta&apos;s WhatsApp Cloud API <strong>doesn&apos;t expose a programmatic endpoint</strong>{" "}
          to add test recipients — they require OTP verification through the dashboard so the
          recipient proves they own the number. Sandbox apps get <strong>{data.slots_total} slots</strong>{" "}
          total. Below is every number a citizen has submitted on{" "}
          <Link href="/report" className="font-semibold underline">/report</Link> — copy the phone,
          paste it into Meta&apos;s &quot;add recipient&quot; dialog, verify with OTP, and from that
          moment on every status update for that number lands as a real WhatsApp message instead
          of a simulated one.
        </p>
        <a
          href={dashUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "#25D366" }}
        >
          Open Meta WhatsApp dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </section>

      {/* Counter card row */}
      <section className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Provider" value={data.provider} accent={data.provider !== "simulated"} />
        <Kpi label="Slots used" value={`${data.slots_used} / ${data.slots_total}`} />
        <Kpi label="Slots free" value={`${data.slots_free}`} accent={data.slots_free > 0} />
        <Kpi label="Awaiting add" value={`${data.pending_adds}`}
          accent={data.pending_adds > 0} tone="amber" />
      </section>

      {/* Recipient table */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h2 className="text-base font-semibold">Submitted numbers</h2>
          <span className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
            · ordered by most recent first
          </span>
        </div>
        {data.all_recipients.length === 0 ? (
          <div className="rounded-2xl border p-6 text-center text-sm"
            style={{ borderColor: "rgb(var(--border-light))", color: "rgb(var(--text-muted))" }}>
            No numbers submitted yet. Go to <Link href="/report" className="underline">/report</Link> and add one.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "rgb(var(--border-light))" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgb(var(--bg-surface-hover))" }}>
                  <th className="p-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(var(--text-muted))" }}>Phone</th>
                  <th className="p-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(var(--text-muted))" }}>Meta status</th>
                  <th className="p-3 text-right text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(var(--text-muted))" }}>Sends</th>
                  <th className="p-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(var(--text-muted))" }}>Last attempt</th>
                  <th className="p-3 text-right text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(var(--text-muted))" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.all_recipients.map((r, i) => (
                  <tr key={r.phone}
                    style={{
                      borderTop: i === 0 ? undefined : "1px solid rgb(var(--border-light))",
                      background: "rgb(var(--bg-surface))",
                    }}>
                    <td className="p-3 font-mono">{r.phone}</td>
                    <td className="p-3">
                      <StatusPill status={r.meta_status ?? "unknown"} />
                      {r.last_error && (
                        <div className="mt-0.5 text-[10px]" style={{ color: "#b45309" }}>
                          {r.last_error}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">{r.send_count}</td>
                    <td className="p-3 text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                      {r.last_attempt
                        ? new Date(r.last_attempt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {r.meta_status !== "registered" ? (
                        <button onClick={() => copyPhone(r.phone)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: copied === r.phone ? "rgba(16,185,129,0.18)" : "rgba(37,211,102,0.18)",
                            color: copied === r.phone ? "#15803d" : "#15803d",
                            border: "1px solid rgba(37,211,102,0.45)",
                          }}>
                          {copied === r.phone ? (
                            <><CheckCircle2 className="h-3 w-3" /> Copied</>
                          ) : (
                            <><Copy className="h-3 w-3" /> Copy + open Meta</>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px]" style={{ color: "#15803d" }}>
                          Live ✓
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* How-to-add walkthrough */}
      <section className="rounded-2xl p-5 text-sm"
        style={{ background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-light))" }}>
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <ArrowRight className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          Adding a recipient in Meta (30 seconds)
        </div>
        <ol className="space-y-1.5 pl-5 text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
          <li>1. Open the Meta dashboard above. Find <strong>WhatsApp → API Setup → To</strong>.</li>
          <li>2. Click <strong>Manage phone number list → Add phone number</strong>.</li>
          <li>3. Paste the copied number. Meta sends a 6-digit OTP to that phone.</li>
          <li>4. Enter the OTP. The recipient now shows in the dropdown.</li>
          <li>5. Resubmit a ticket on <Link href="/report" className="underline">/report</Link> from the same number.
            The next status update will arrive as a real WhatsApp message — the table row
            here will flip from <em>unregistered</em> to <em>Live ✓</em>.</li>
        </ol>
      </section>
    </motion.div>
  );
}

/* ────────── helpers ────────── */

function SlotMeter({ used, total }: { used: number; total: number }) {
  const pct = (used / total) * 100;
  return (
    <div className="w-44">
      <div className="flex items-baseline justify-between text-xs uppercase tracking-wider text-ink-300">
        <span>WhatsApp slots</span>
        <span className="font-mono font-semibold text-white">{used}/{total}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          className="h-full"
          style={{ background: "#25D366" }}
        />
      </div>
      <div className="mt-1 text-[10px] text-ink-300">
        {total - used} free for new recipients
      </div>
    </div>
  );
}

function Kpi({ label, value, accent = false, tone = "green" }:
  { label: string; value: string | number; accent?: boolean; tone?: "green" | "amber" }) {
  const bg = !accent ? "rgb(var(--bg-surface-hover))"
    : tone === "amber" ? "rgba(245,158,11,0.14)" : "rgba(37,211,102,0.14)";
  const color = !accent ? "rgb(var(--text-primary))"
    : tone === "amber" ? "#b45309" : "#15803d";
  return (
    <div className="rounded-2xl p-4"
      style={{ background: bg, border: "1px solid rgb(var(--border-light))" }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "rgb(var(--text-muted))" }}>{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Recipient["meta_status"] }) {
  const map: Record<string, { label: string; bg: string; color: string; icon: typeof CheckCircle2 }> = {
    registered:   { label: "Registered · live sends", bg: "rgba(16,185,129,0.12)", color: "#15803d", icon: CheckCircle2 },
    unregistered: { label: "Not in test list", bg: "rgba(220,38,38,0.12)", color: "#b91c1c", icon: AlertTriangle },
    unknown:      { label: "Awaiting send / simulated", bg: "rgba(245,158,11,0.12)", color: "#b45309", icon: Clock },
    error:        { label: "Meta error", bg: "rgba(220,38,38,0.12)", color: "#b91c1c", icon: AlertTriangle },
  };
  const x = map[status ?? "unknown"];
  const Icon = x.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: x.bg, color: x.color }}>
      <Icon className="h-3 w-3" /> {x.label}
    </span>
  );
}
