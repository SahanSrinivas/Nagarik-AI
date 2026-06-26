"use client";

import { motion } from "framer-motion";
import { LogIn, Sparkles, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, me } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<{ username: string; password: string } | null>(null);

  useEffect(() => {
    // If already signed in, bounce to citizen home.
    if (me) router.replace("/home");
  }, [me, router]);

  useEffect(() => {
    fetch(`${BASE}/auth/demo-credentials`).then((r) => r.json()).then(setDemo).catch(() => {});
  }, []);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (mode === "login") await login(username, password);
      else await signup(username, password, name || undefined);
      router.replace("/home");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  function useDemo() {
    if (!demo) return;
    setU(demo.username); setP(demo.password); setMode("login");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md space-y-5 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Sign in to NagarikAI" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Report civic issues, track them in real time, earn XP for verified fixes.
        </p>
      </header>

      {/* Hackathon demo credentials banner */}
      {demo && mode === "login" && (
        <div
          className="rounded-xl px-4 py-3 text-xs"
          style={{
            background: "rgba(191, 79, 54, 0.08)",
            border: "1px solid rgba(191, 79, 54, 0.30)",
            color: "rgb(var(--text-primary))",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "rgb(var(--accent))" }} />
            Hackathon demo account
          </div>
          <div className="font-mono">
            username: <strong>{demo.username}</strong>
          </div>
          <div className="font-mono">
            password: <strong>{demo.password}</strong>
          </div>
          <button onClick={useDemo} className="btn-primary mt-2 w-full text-xs">
            Use demo credentials
          </button>
        </div>
      )}

      <div className="card space-y-4 p-6">
        {mode === "signup" && (
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-ink-500">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="input mt-1" placeholder="Ramesh K." />
          </label>
        )}
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-ink-500">Username</span>
          <input value={username} onChange={(e) => setU(e.target.value)} autoCapitalize="off"
            className="input mt-1" placeholder="ramesh.k" />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-ink-500">Password</span>
          <input type="password" value={password} onChange={(e) => setP(e.target.value)}
            className="input mt-1" placeholder="••••••••" />
        </label>

        {err && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}

        <button onClick={submit} disabled={busy || !username || !password}
          className="btn-primary w-full">
          {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(null); }}
          className="w-full text-center text-xs text-ink-600 underline">
          {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>

      <p className="text-center text-xs text-ink-500">
        Tokens are JWT (HS256, 24-hour expiry). Passwords stored as PBKDF2-SHA256
        with 200k iterations.
      </p>
    </motion.div>
  );
}
