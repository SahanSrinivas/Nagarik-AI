"use client";

import { motion } from "framer-motion";
import { Award, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Counter, Reveal, Stagger } from "@/components/Motion";
import { Pill } from "@/components/Pill";
import { api } from "@/lib/api";

export default function ImpactPage() {
  const [board, setBoard] = useState<{ id: string; name: string; xp: number; badge: string | null }[]>([]);

  useEffect(() => {
    api.leaderboard().then(setBoard).catch(() => {});
  }, []);

  const top = board.slice(0, 3);
  const rest = board.slice(3);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <header className="card p-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-600" />
          <h1 className="text-xl font-semibold tracking-tight">Citizen leaderboard</h1>
        </div>
        <p className="mt-1 text-sm text-ink-600">Top contributors. Each badge is a soulbound NFT.</p>
      </header>

      {top.length > 0 && (
        <Stagger step={0.08} className="grid gap-4 sm:grid-cols-3">
          {top.map((c, i) => (
            <Reveal key={c.id}>
              <Link href={`/wallet/${c.id}`} className="block">
                <motion.div
                  whileHover={{ y: -3 }}
                  className="card p-6 text-center"
                  style={{ background: i === 0 ? "linear-gradient(180deg, #ecfdf5 0%, #ffffff 60%)" : undefined }}
                >
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
                    <Award className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-wider text-ink-500">Rank #{i + 1}</div>
                  <div className="mt-1 text-lg font-semibold">{c.name}</div>
                  <div className="mt-1 font-mono text-2xl text-brand-700">
                    <Counter to={c.xp} suffix=" XP" />
                  </div>
                  {/* Wallet link + badge sit on ONE line so the card height
                      stays uniform across all three podium slots. */}
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-brand-700">
                      <Wallet className="h-3 w-3" /> view wallet
                    </span>
                    {c.badge && <Pill tone="brand">{c.badge}</Pill>}
                  </div>
                </motion.div>
              </Link>
            </Reveal>
          ))}
        </Stagger>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr><th className="p-4">#</th><th className="p-4">Name</th><th className="p-4 text-right">XP</th><th className="p-4">Badge</th></tr>
          </thead>
          <tbody>
            {rest.map((c, i) => (
              <motion.tr
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className="border-t border-ink-100 hover:bg-ink-50"
              >
                <td className="p-4 text-ink-500">{i + 4}</td>
                <td className="p-4 font-medium text-ink-900">
                  <Link href={`/wallet/${c.id}`} className="hover:text-brand-700">{c.name}</Link>
                </td>
                <td className="p-4 text-right font-mono">{c.xp}</td>
                <td className="p-4">{c.badge ? <Pill tone="brand">{c.badge}</Pill> : <span className="text-ink-400">—</span>}</td>
              </motion.tr>
            ))}
            {board.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-ink-500">No citizens yet — run `python -m scripts.seed`.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
