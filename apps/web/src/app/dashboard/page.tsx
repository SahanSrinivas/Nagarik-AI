"use client";

import { motion } from "framer-motion";
import { LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export default function DashboardPage() {
  const [wards, setWards] = useState<{ ward: string; total: number; resolved: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.wardStats()
      .then((rows) => { if (!cancelled) setWards(rows); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const maxTotal = Math.max(1, ...wards.map((w) => w.total));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <header className="card p-6">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-brand-600" />
          <h1 className="text-xl font-semibold tracking-tight">Ward dashboard</h1>
        </div>
        <p className="mt-1 text-sm text-ink-600">Throughput and resolution rate per ward.</p>
      </header>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr>
              <th className="p-4">Ward</th>
              <th className="p-4">Volume</th>
              <th className="p-4">Total</th>
              <th className="p-4">Resolved</th>
              <th className="p-4 text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {wards.map((w, i) => {
              const rate = w.total ? Math.round((100 * w.resolved) / w.total) : 0;
              const width = (100 * w.total) / maxTotal;
              return (
                <motion.tr
                  key={w.ward}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-t border-ink-100"
                >
                  <td className="p-4 font-medium text-ink-900">{w.ward}</td>
                  <td className="p-4">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-ink-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                      />
                    </div>
                  </td>
                  <td className="p-4 text-ink-600">{w.total}</td>
                  <td className="p-4 text-ink-600">{w.resolved}</td>
                  <td className="p-4 text-right font-mono text-ink-900">{rate}%</td>
                </motion.tr>
              );
            })}
            {!loaded && [0, 1, 2, 3, 4].map((i) => (
              <tr key={`sk-${i}`} className="border-t border-ink-100">
                <td className="p-4"><div className="h-3 w-32 animate-pulse rounded bg-ink-100" /></td>
                <td className="p-4"><div className="h-2 w-40 animate-pulse rounded-full bg-ink-100" /></td>
                <td className="p-4"><div className="h-3 w-10 animate-pulse rounded bg-ink-100" /></td>
                <td className="p-4"><div className="h-3 w-10 animate-pulse rounded bg-ink-100" /></td>
                <td className="p-4 text-right"><div className="ml-auto h-3 w-12 animate-pulse rounded bg-ink-100" /></td>
              </tr>
            ))}
            {loaded && wards.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-ink-500">
                No ward activity yet — once citizens start reporting, ward-level throughput will show here.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
