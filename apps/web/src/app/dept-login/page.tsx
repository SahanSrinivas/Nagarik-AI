"use client";

import { motion } from "framer-motion";
import { Building2, LogIn, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { deptLogin, getDeptSession } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DemoCreds {
  password: string;
  accounts: { department: string; username: string; role: string }[];
}

export default function DeptLoginPage() {
  const router = useRouter();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<DemoCreds | null>(null);

  // Already signed in? Bounce.
  useEffect(() => {
    const { user, token } = getDeptSession();
    if (user && token) {
      router.replace(user.role === "supervisor" ? "/supervisor" : `/crew/${user.department_id}`);
    }
  }, [router]);

  useEffect(() => {
    fetch(`${BASE}/auth/dept-demo-credentials`).then((r) => r.json()).then(setDemo).catch(() => {});
  }, []);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const user = await deptLogin(username, password);
      router.replace(user.role === "supervisor" ? "/supervisor" : `/crew/${user.department_id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  function useAccount(a: { username: string }) {
    setU(a.username);
    setP(demo?.password ?? "");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md space-y-5 py-8">
      <header className="text-center">
        <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl"
          style={{ background: "rgba(191, 79, 54, 0.10)", color: "rgb(var(--accent))" }}>
          <Building2 className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Department sign in</h1>
        <p className="mt-1 text-sm text-ink-600">
          BBMP / BWSSB / BESCOM supervisors and crew leads sign in here. Citizens use{" "}
          <a href="/login" className="underline">/login</a>.
        </p>
      </header>

      {/* Demo credentials banner — judges click one and they're in. */}
      {demo && demo.accounts.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 text-xs"
          style={{
            background: "rgba(191, 79, 54, 0.08)",
            border: "1px solid rgba(191, 79, 54, 0.30)",
            color: "rgb(var(--text-primary))",
          }}
        >
          <div className="mb-2 flex items-center gap-1.5 font-semibold">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "rgb(var(--accent))" }} />
            Demo accounts · password: <code className="font-mono">{demo.password}</code>
          </div>
          <div className="space-y-1">
            {demo.accounts.map((a) => (
              <button
                key={a.username}
                onClick={() => useAccount(a)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:opacity-80"
                style={{ background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-light))" }}
              >
                <span className="font-mono">{a.username}</span>
                <span className="text-[10px]" style={{ color: "rgb(var(--text-muted))" }}>
                  {a.department}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card space-y-4 p-6">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-ink-500">Username</span>
          <input value={username} onChange={(e) => setU(e.target.value)} autoCapitalize="off"
            className="input mt-1" placeholder="bbmp_roads_supervisor" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-ink-500">Password</span>
          <input type="password" value={password} onChange={(e) => setP(e.target.value)}
            className="input mt-1" placeholder="••••••••" />
        </label>

        {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}

        <button onClick={submit} disabled={busy || !username || !password}
          className="btn-primary w-full">
          <LogIn className="h-4 w-4" />
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </motion.div>
  );
}
