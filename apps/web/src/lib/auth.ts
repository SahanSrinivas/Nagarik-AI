"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import React from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "nagarik.token";
const USER_KEY = "nagarik.user";

export interface Me {
  id: string;
  username: string | null;
  name: string | null;
  phone: string | null;
  xp: number;
  badge: string | null;
}

interface AuthCtx {
  token: string | null;
  me: Me | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  // Bootstrap from localStorage on mount (SSR-safe).
  useEffect(() => {
    try {
      const t = window.localStorage.getItem(TOKEN_KEY);
      const u = window.localStorage.getItem(USER_KEY);
      if (t) setToken(t);
      if (u) setMe(JSON.parse(u));
    } catch {}
  }, []);

  const persist = useCallback((t: string | null, u: Me | null) => {
    setToken(t);
    setMe(u);
    try {
      if (t) window.localStorage.setItem(TOKEN_KEY, t);
      else window.localStorage.removeItem(TOKEN_KEY);
      if (u) window.localStorage.setItem(USER_KEY, JSON.stringify(u));
      else window.localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
    const d = await r.json();
    persist(d.access_token, d.citizen);
  }, [persist]);

  const signup = useCallback(async (username: string, password: string, name?: string) => {
    const r = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, name }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail ?? r.statusText);
    }
    const d = await r.json();
    persist(d.access_token, d.citizen);
  }, [persist]);

  const logout = useCallback(() => persist(null, null), [persist]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const u = await r.json();
        persist(token, u);
      }
    } catch {}
  }, [token, persist]);

  const value: AuthCtx = { token, me, login, signup, logout, refresh };
  return React.createElement(Ctx.Provider, { value }, children);
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) {
    return {
      token: null, me: null,
      login: async () => {}, signup: async () => {},
      logout: () => {}, refresh: async () => {},
    };
  }
  return c;
}

/** Authorized fetch — drops Authorization if no token. */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BASE}${path}`, { ...init, headers });
}
