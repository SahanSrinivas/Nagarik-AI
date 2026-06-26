"use client";

import { motion } from "framer-motion";
import { CheckCircle2, LogIn, MapPin, Sparkles, Star, UserPlus } from "lucide-react";
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
  const [home, setHome] = useState<{ lat: number; lng: number } | null>(null);
  const [homeBusy, setHomeBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<{ username: string; password: string } | null>(null);

  function captureHome() {
    if (!navigator.geolocation) {
      setErr("Geolocation isn't supported on this device.");
      return;
    }
    setHomeBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHome({ lat: p.coords.latitude, lng: p.coords.longitude });
        setHomeBusy(false);
        setErr(null);
      },
      (e) => { setErr(e.message); setHomeBusy(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

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
      if (mode === "login") {
        await login(username, password);
      } else {
        await signup(username, password, {
          name: name || undefined,
          ...(home ? { home_lat: home.lat, home_lng: home.lng } : {}),
        });
      }
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

        {/* Verifier opt-in — only shown on signup. Capturing a home location at
            signup time bootstraps the trust graph: we know which other reports
            this user can credibly confirm (within ~500m of their address). */}
        {mode === "signup" && (
          <div
            className="rounded-xl px-3 py-3 text-xs"
            style={{
              background: "rgb(var(--bg-surface-hover))",
              border: "1px solid rgb(var(--border-light))",
            }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-1.5 font-semibold">
              <Star className="h-3.5 w-3.5" style={{ color: "rgb(var(--accent))" }} />
              Become a verifier{" "}
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                style={{ background: "rgb(var(--accent))", color: "#fff" }}
              >
                +5 XP per confirmation
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#b45309",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                }}
                title="Verifier tier unlocks at 250 XP"
              >
                Unlocks at 250 XP
              </span>
            </div>
            <p style={{ color: "rgb(var(--text-secondary))" }}>
              Share your accurate home location now — we&apos;ll use it to know which reports
              you can credibly confirm. The verifier role itself activates when you cross
              the <strong>Verifier tier (250 XP)</strong>, which most active citizens reach
              within ~25 confirmed reports.
            </p>
            <button
              type="button"
              onClick={captureHome}
              disabled={homeBusy}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: home ? "rgba(34,197,94,0.10)" : "rgb(var(--bg-surface))",
                border: home ? "1px solid rgba(34,197,94,0.40)" : "1px solid rgb(var(--border-color))",
                color: "rgb(var(--text-primary))",
              }}
            >
              {home ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#16a34a" }} />
                  Home set ({home.lat.toFixed(4)}, {home.lng.toFixed(4)}) — verifier enabled
                </>
              ) : homeBusy ? (
                <>Locating…</>
              ) : (
                <>
                  <MapPin className="h-3.5 w-3.5" /> Use my current location (optional)
                </>
              )}
            </button>
          </div>
        )}

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

      <p className="text-center text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
        BBMP / BWSSB / BESCOM staff?{" "}
        <a href="/dept-login" className="font-semibold underline" style={{ color: "rgb(var(--accent))" }}>
          Sign in to the department dashboard →
        </a>
      </p>
    </motion.div>
  );
}
