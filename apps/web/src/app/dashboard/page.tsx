"use client";

import { LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export default function DashboardPage() {
  const [wards, setWards] = useState<{ ward: string; total: number; resolved: number }[]>([]);

  useEffect(() => {
    api.wardStats().then(setWards).catch(() => {});
  }, []);

  const maxTotal = Math.max(1, ...wards.map((w) => w.total));

  return (
    <div className="space-y-6 animate-fade-up">
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
            {wards.map((w) => {
              const rate = w.total ? Math.round((100 * w.resolved) / w.total) : 0;
              const width = (100 * w.total) / maxTotal;
              return (
                <tr key={w.ward} className="border-t border-ink-100">
                  <td className="p-4 font-medium text-ink-900">{w.ward}</td>
                  <td className="p-4">
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-4 text-ink-600">{w.total}</td>
                  <td className="p-4 text-ink-600">{w.resolved}</td>
                  <td className="p-4 text-right font-mono text-ink-900">{rate}%</td>
                </tr>
              );
            })}
            {wards.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-ink-500">No data yet — run `python -m scripts.seed`.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
