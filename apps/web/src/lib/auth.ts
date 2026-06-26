"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import React from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "nagarik.token";
const USER_KEY = "nagarik.user";
const DEPT_TOKEN_KEY = "nagarik.dept.token";
const DEPT_USER_KEY = "nagarik.dept.user";

export interface DeptUser {
  id: string;
  username: string;
  name: string | null;
  role: "supervisor" | "crew_lead";
  phone: string | null;
  department_id: string;
  department_name: string | null;
  department_code: string | null;
  primary_channel: string | null;
}

/** Department-side login. Stored separately from citizen JWT so a tester
 *  can have BOTH a citizen and a supervisor session in the same browser. */
export async function deptLogin(username: string, password: string): Promise<DeptUser> {
  const r = await fetch(`${BASE}/auth/dept-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? r.statusText);
  }
  const d = await r.json();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DEPT_TOKEN_KEY, d.access_token);
    window.localStorage.setItem(DEPT_USER_KEY, JSON.stringify(d.user));
  }
  return d.user as DeptUser;
}

export function deptLogout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEPT_TOKEN_KEY);
  window.localStorage.removeItem(DEPT_USER_KEY);
}

export function getDeptSession(): { token: string | null; user: DeptUser | null } {
  if (typeof window === "undefined") return { token: null, user: null };
  const token = window.localStorage.getItem(DEPT_TOKEN_KEY);
  const raw = window.localStorage.getItem(DEPT_USER_KEY);
  let user: DeptUser | null = null;
  try { user = raw ? JSON.parse(raw) as DeptUser : null; } catch { user = null; }
  return { token, user };
}

/** Authorized fetch for dept routes — sends the dept JWT, not the citizen one. */
export async function deptFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { token } = getDeptSession();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BASE}${path}`, { ...init, headers });
}

export interface Me {
  id: string;
  username: string | null;
  name: string | null;
  phone: string | null;
  xp: number;
  badge: string | null;
  is_verifier?: boolean;
  home_lat?: number | null;
  home_lng?: number | null;
}

export interface SignupExtras {
  name?: string;
  home_lat?: number;
  home_lng?: number;
}

interface AuthCtx {
  token: string | null;
  me: Me | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, extras?: SignupExtras) => Promise<void>;
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

  const signup = useCallback(async (username: string, password: string, extras: SignupExtras = {}) => {
    const r = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, ...extras }),
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
