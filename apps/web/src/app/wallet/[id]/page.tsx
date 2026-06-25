"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Award, ExternalLink, Lock, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";
import { api } from "@/lib/api";

type WalletData = Awaited<ReturnType<typeof api.wallet>>;

export default function WalletPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<WalletData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintResult, setMintResult] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.wallet(id).then(setData).catch((e) => setErr(String(e)));
  }, [id]);

  async function tryMint() {
    if (!id) return;
    setMinting(true);
    setMintResult(null);
    try {
      const r = await api.mintBadge(id);
      setMintResult(
        r.minted
          ? `Minted ${r.tier} · tx ${r.tx_hash?.slice(0, 12)}…`
          : r.shadow_mode
          ? `Shadow mode: would mint ${r.tier} to ${r.wallet?.slice(0, 12)}… (set CHAIN_ENABLED=true to broadcast)`
          : `No badge eligible — earn more XP`,
      );
      const fresh = await api.wallet(id);
      setData(fresh);
    } catch (e) {
      setMintResult(String(e));
    } finally {
      setMinting(false);
    }
  }

  if (err) return <div className="card p-6 text-sm text-rose-700">{err}</div>;
  if (!data) return <div className="card animate-pulse p-6 text-sm text-ink-400">Loading wallet…</div>;

  const { citizen, wallet_address, chain, badges, next_tier, earned_count } = data;
  const explorerUrl = chain.explorer_base ? chain.explorer_base + wallet_address : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* HEADER */}
      <section className="card overflow-hidden">
        <div className="bg-hero-gradient p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-brand-200">
                <Wallet className="h-3.5 w-3.5" /> Citizen wallet
              </div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{citizen.name}</h1>
              <p className="mt-1 text-sm text-ink-300">{citizen.phone_masked}</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-semibold text-brand-300">
                <Counter to={citizen.xp} />
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-ink-400">XP earned</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Wallet address ({chain.network})
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="break-all font-mono text-sm text-brand-200">{wallet_address}</code>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 text-xs text-brand-300 underline inline-flex items-center gap-1"
                >
                  Polygonscan <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {!chain.enabled && (
              <div className="mt-2 text-xs text-amber-200">
                Shadow mode — set CHAIN_ENABLED=true and deploy contracts to broadcast.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <StatCard icon={Award} label="Badges earned" value={earned_count} />
          <StatCard icon={Sparkles} label="Current tier" value={citizen.current_badge ?? "—"} />
          <StatCard
            icon={Lock}
            label="Next milestone"
            value={next_tier ? `${next_tier.xp_to_go} XP to ${next_tier.tier}` : "All earned"}
          />
        </div>
      </section>

      {/* NEXT TIER PROGRESS */}
      <AnimatePresence>
        {next_tier && (
          <motion.div
            key="next"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="card p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-500">Next tier</div>
                <div className="mt-1 text-lg font-semibold">{next_tier.tier}</div>
                <div className="text-xs text-ink-500">
                  {citizen.xp} / {next_tier.xp_threshold} XP
                </div>
              </div>
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={tryMint} disabled={minting} className="btn-primary">
                {minting ? "Checking…" : "Mint eligible badge"}
              </motion.button>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, next_tier.progress_pct)}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            {mintResult && (
              <div className="mt-3 rounded-xl bg-brand-50 p-3 text-xs font-mono text-ink-800">
                {mintResult}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BADGES */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-700">Soulbound badges</h2>
        <Stagger step={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {badges.map((b) => (
            <Reveal key={b.tier}>
              <motion.div
                whileHover={{ y: -4, rotate: b.earned ? -1 : 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className={`card p-5 text-center ${b.earned ? "" : "opacity-50 grayscale"}`}
                style={
                  b.is_current
                    ? { background: "linear-gradient(180deg, #ecfdf5 0%, #ffffff 60%)" }
                    : undefined
                }
              >
                <div
                  className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${
                    b.earned ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow" : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {b.earned ? <Award className="h-8 w-8" /> : <Lock className="h-7 w-7" />}
                </div>
                <div className="mt-3 text-base font-semibold">{b.tier}</div>
                <div className="mt-0.5 font-mono text-xs text-ink-500">{b.xp_threshold} XP</div>
                {b.is_current && <Pill tone="brand" className="mt-2">current</Pill>}
                {b.earned && !b.is_current && <Pill tone="lime" className="mt-2">earned</Pill>}
              </motion.div>
            </Reveal>
          ))}
        </Stagger>
      </section>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: string | number }) {
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
