"use client";

import { useEffect, useState } from "react";

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
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">On-chain transparency</h1>
        <p className="text-sm text-zinc-600">
          Every agent decision is hashed and anchored to a public chain. Every citizen badge is a
          soulbound NFT. Transparency isn&apos;t a slide — it&apos;s enforceable.
        </p>
      </header>

      {status && (
        <section className="grid gap-3 sm:grid-cols-2">
          <Card label="Chain" value={status.enabled ? status.network : "Disabled (shadow mode)"} />
          <Card label="Anchor contract" value={status.anchor_contract ?? "—"} />
          <Card label="Badge contract" value={status.badge_contract ?? "—"} />
          <Card label="Milestones" value={status.milestones.map((m) => `${m.tier} @ ${m.xp}xp`).join(", ")} />
        </section>
      )}

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-base font-semibold">Anchor a batch now</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Hashes the next batch of agent events and writes the Merkle root to chain.
        </p>
        <button
          onClick={anchorNow}
          disabled={busy}
          className="mt-3 rounded bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Anchoring..." : "Anchor batch"}
        </button>

        {flush && (
          <div className="mt-3 rounded bg-zinc-50 p-3 text-xs font-mono">
            <div>leaves: {flush.leaf_count}</div>
            <div>merkle_root: <span className="break-all">{flush.merkle_root}</span></div>
            {flush.tx_hash ? (
              <div>
                tx: <a className="text-brand underline" href={explorer(flush.tx_hash)} target="_blank" rel="noopener">{flush.tx_hash.slice(0, 18)}…</a>
              </div>
            ) : (
              <div className="text-amber-700">shadow mode — root hashed but not broadcast (CHAIN_ENABLED=false)</div>
            )}
          </div>
        )}
      </section>

      {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 break-all text-sm font-mono">{value}</div>
    </div>
  );
}
