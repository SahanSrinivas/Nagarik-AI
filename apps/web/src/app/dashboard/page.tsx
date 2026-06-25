"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export default function DashboardPage() {
  const [wards, setWards] = useState<{ ward: string; total: number; resolved: number }[]>([]);

  useEffect(() => {
    api.wardStats().then(setWards).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">City dashboard</h1>
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr><th className="p-3">Ward</th><th className="p-3">Total</th><th className="p-3">Resolved</th><th className="p-3">Rate</th></tr>
          </thead>
          <tbody>
            {wards.map((w) => (
              <tr key={w.ward} className="border-t">
                <td className="p-3">{w.ward}</td>
                <td className="p-3">{w.total}</td>
                <td className="p-3">{w.resolved}</td>
                <td className="p-3">{w.total ? Math.round((100 * w.resolved) / w.total) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
