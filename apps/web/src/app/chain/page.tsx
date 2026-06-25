"use client";

import { CheckCircle2, ExternalLink, Hash, Link2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Pill } from "@/components/Pill";
import { api } from "@/lib/api";

export default function ChainPage() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.chainStatus>> | null>(null);
  const [flush, setFlush] = useState<Awaited<ReturnType<typeof api.flushAnchor>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.chainStatus().then(setStatus).catch((e) => setErr(String(e)));
  }, []);

  async function anchorNow() {
    setBusy(true);
    setErr(null);
    try {
      setFlush(await api.flushAnchor());
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const explorer = (tx: string) => `https://amoy.polygonscan.com/tx/${tx}`;

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="card p-6">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-brand-600" />
          <h1 className="text-xl font-semibold tracking-tight">On-chain transparency</h1>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          Every agent decision is hashed and anchored to a public chain. Every citizen badge is a
          soulbound NFT. Transparency isn&apos;t a slide — it&apos;s enforceable.
        </p>
      </header>

      {status && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            icon={ShieldCheck}
            label="Chain"
            value={status.enabled ? status.network : "Shadow mode"}
            tone={status.enabled ? "brand" : "ink"}
          />
          <Card icon={Hash} label="Anchor contract" value={status.anchor_contract ?? "—"} mono />
          <Card icon={Hash} label="Badge contract" value={status.badge_contract ?? "—"} mono />
          <Card icon={Sparkles} label="Milestones" value={`${status.milestones.length} tiers`} />
        </section>
      )}

      {status && (
        <section className="card p-6">
          <div className="text-sm font-semibold text-ink-900">Badge tiers</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {status.milestones.map((m) => (
              <Pill key={m.tier} tone="brand">
                {m.tier} · {m.xp} XP
              </Pill>
            ))}
          </div>
        </section>
      )}

      <section className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Anchor a batch now</h2>
            <p className="mt-1 text-sm text-ink-600">
              Hashes the next batch of agent events and writes the Merkle root to chain.
            </p>
          </div>
          <button onClick={anchorNow} disabled={busy} className="btn-primary">
            {busy ? "Anchoring..." : "Anchor batch"}
          </button>
        </div>

        {flush && (
          <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-xs font-mono text-ink-800">
            <div className="mb-2 flex items-center gap-2 text-brand-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Anchor complete</span>
            </div>
            <div>leaves: {flush.leaf_count}</div>
            <div className="mt-1">root: <span className="break-all">{flush.merkle_root}</span></div>
            {flush.tx_hash ? (
              <div className="mt-1">
                tx:{" "}
                <a className="text-brand-700 underline inline-flex items-center gap-1" href={explorer(flush.tx_hash)} target="_blank" rel="noopener">
                  {flush.tx_hash.slice(0, 22)}… <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <div className="mt-1 text-amber-700">shadow mode — root hashed but not broadcast (CHAIN_ENABLED=false)</div>
            )}
          </div>
        )}
      </section>

      {err && <div className="card p-4 text-sm text-rose-700">{err}</div>}
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  tone = "ink",
  mono = false,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  tone?: "brand" | "ink";
  mono?: boolean;
}) {
  const accent = tone === "brand" ? "from-brand-500 to-brand-700" : "from-ink-700 to-ink-900";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-soft`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
          <div className={`mt-0.5 truncate text-sm ${mono ? "font-mono" : "font-semibold"} text-ink-900`}>{value}</div>
        </div>
      </div>
    </div>
  );
}
