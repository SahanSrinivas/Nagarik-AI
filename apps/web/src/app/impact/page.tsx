"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export default function ImpactPage() {
  const [board, setBoard] = useState<{ id: string; name: string; xp: number; badge: string | null }[]>([]);

  useEffect(() => {
    api.leaderboard().then(setBoard).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Citizen leaderboard</h1>
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr><th className="p-3">#</th><th className="p-3">Name</th><th className="p-3">XP</th><th className="p-3">Badge</th></tr>
          </thead>
          <tbody>
            {board.map((c, i) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{i + 1}</td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.xp}</td>
                <td className="p-3">{c.badge ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
