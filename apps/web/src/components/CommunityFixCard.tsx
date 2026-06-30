"use client";

import { CalendarClock, HandCoins, Hammer, ShieldAlert, Users, Wallet2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { type DiyState, pledgesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Community DIY + crowdfunding module.
 *
 * Renders a STATELESS overview of an issue's DIY pledge ladder. Only
 * surfaces itself when the backend reports `unlocked=true` (which happens
 * when a sev≤2 issue's level-3 SLA breaches).
 *
 * Citizens can pledge funds or volunteer hours from inside the card. The
 * threshold is held server-side (`routes/pledges.py::HOURS_THRESHOLD` and
 * `FUNDS_THRESHOLD`); when it crosses, the DIY schedule appears inline.
 */
export function CommunityFixCard({ issueId }: { issueId: string }) {
  const { token } = useAuth();
  const [state, setState] = useState<DiyState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    pledgesApi.state(issueId).then(setState).catch((e) => setErr(String(e)));
  }, [issueId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  async function pledge(kind: "funds" | "hours", value: number) {
    setBusy(true); setErr(null);
    try {
      await pledgesApi.create(
        issueId,
        kind === "funds" ? { kind, amount_inr: value } : { kind, hours: value },
        token,
      );
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  if (!state.unlocked) return null;

  // The backend hands us a free-form dict — cast once so we can read it
  // without per-field unknown-narrowing in JSX.
  const schedule = state.schedule as {
    title?: string;
    when?: string;
    what?: string;
    safety?: string;
    meet?: string;
    tools?: string[];
  };
  const tools = schedule.tools ?? [];

  return (
    <section
      className="card overflow-hidden"
      style={{ borderColor: "rgba(168, 85, 247, 0.45)" }}
    >
      <div
        className="flex items-center gap-3 px-6 py-3"
        style={{
          background: "linear-gradient(90deg, rgba(168, 85, 247, 0.12), rgba(236, 72, 153, 0.08))",
          borderBottom: "1px solid rgba(168, 85, 247, 0.30)",
        }}
      >
        <span className="grid h-8 w-8 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}>
          <Hammer className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
            Community DIY · the system gave up, neighbours can step in
          </div>
          <div className="text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
            Unlocked because the issue breached its level-3 SLA without action.
          </div>
        </div>
        {state.threshold_met && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: "rgba(16, 185, 129, 0.18)", color: "#047857" }}>
            Threshold met
          </span>
        )}
      </div>

      <div className="grid gap-6 p-6 sm:grid-cols-2">
        {/* ── Pledge column ─────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "rgb(var(--accent))" }}>
              <HandCoins className="h-3.5 w-3.5" /> Pledge funds (mocked)
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[100, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => pledge("funds", amt)}
                  disabled={busy}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium"
                  style={{
                    background: "rgb(var(--bg-surface-hover))",
                    border: "1px solid rgb(var(--border-color))",
                  }}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              <Wallet2 className="mr-1 inline h-3 w-3" />
              {state.funds_total_inr.toLocaleString("en-IN")} / 1,500 INR pledged
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "rgb(var(--accent))" }}>
              <Users className="h-3.5 w-3.5" /> Volunteer hours
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 4].map((h) => (
                <button
                  key={h}
                  onClick={() => pledge("hours", h)}
                  disabled={busy}
                  className="rounded-xl px-3 py-1.5 text-sm font-medium"
                  style={{
                    background: "rgb(var(--bg-surface-hover))",
                    border: "1px solid rgb(var(--border-color))",
                  }}
                >
                  {h} hr{h > 1 ? "s" : ""}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              <Users className="mr-1 inline h-3 w-3" />
              {state.hours_total.toFixed(1)} / 5 volunteer-hours pledged
            </div>
          </div>

          {err && (
            <div className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">{err}</div>
          )}
        </div>

        {/* ── Schedule column (only when threshold met) ── */}
        <div className="space-y-2">
          {state.threshold_met && schedule.title ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgb(var(--accent))" }}>
                <CalendarClock className="h-3.5 w-3.5" /> Your DIY workplan
              </div>
              <div className="rounded-2xl p-4"
                style={{ background: "rgb(var(--bg-surface-hover))", border: "1px solid rgb(var(--border-light))" }}>
                <div className="text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                  {schedule.title}
                </div>
                {schedule.when && (
                  <div className="mt-1 text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
                    🗓 {schedule.when}
                  </div>
                )}
                {schedule.what && (
                  <p className="mt-2 text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
                    {schedule.what}
                  </p>
                )}
                {tools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tools.map((tool) => (
                      <span key={tool}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: "rgba(168, 85, 247, 0.12)",
                          color: "#7e22ce",
                        }}>
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
                {schedule.safety && (
                  <div className="mt-2 flex items-start gap-1.5 text-[11px]"
                    style={{ color: "#b91c1c" }}>
                    <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{schedule.safety}</span>
                  </div>
                )}
                {schedule.meet && (
                  <div className="mt-2 text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                    📍 Meet: {schedule.meet}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl p-4 text-xs"
              style={{
                background: "rgb(var(--bg-surface-hover))",
                border: "1px dashed rgb(var(--border-color))",
                color: "rgb(var(--text-muted))",
              }}>
              The DIY workplan unlocks when pledges cross the threshold — either
              5 volunteer-hours OR ₹1,500. {state.pledges.length} pledge
              {state.pledges.length === 1 ? "" : "s"} so far.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
