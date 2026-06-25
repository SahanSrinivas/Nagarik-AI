const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Issue {
  id: string;
  type: string;
  severity: number;
  status: string;
  lat: number;
  lng: number;
  address: string | null;
  ward: string | null;
  description: string;
  before_photo_url: string | null;
  after_photo_url: string | null;
  routed_department: string | null;
  sla_deadline: string | null;
  duplicate_of_id: string | null;
  ai_confidence: number;
  resolved_at: string | null;
  created_at: string;
}

export interface AgentEvent {
  agent: string;
  status: string;
  payload: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

export interface ScheduleResponse {
  solver_status: string;
  runtime_seconds: number;
  routes: { crew_id: string; sequence: string[]; total_km: number; total_time_min: number }[];
  metrics: Record<string, number>;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const api = {
  listIssues: (status?: string) =>
    call<Issue[]>(`/issues${status ? `?status=${status}` : ""}`),
  getIssue: (id: string) => call<Issue>(`/issues/${id}`),
  nearbyIssues: (lat: number, lng: number, radius_m = 500) =>
    call<Issue[]>(`/issues/nearby?lat=${lat}&lng=${lng}&radius_m=${radius_m}`),
  createIssue: (body: Partial<Issue> & { lat: number; lng: number }) =>
    call<Issue>("/issues", { method: "POST", body: JSON.stringify(body) }),
  issueEvents: (id: string) => call<AgentEvent[]>(`/issues/${id}/events`),
  verify: (id: string, confirms = true) =>
    call(`/issues/${id}/verify`, { method: "POST", body: JSON.stringify({ confirms }) }),
  solveSchedule: (date: string, ward?: string) =>
    call<ScheduleResponse>("/schedule/solve", {
      method: "POST",
      body: JSON.stringify({ date, ward }),
    }),
  wardStats: () => call<{ ward: string; total: number; resolved: number }[]>("/insights/ward-stats"),
  leaderboard: () =>
    call<{ id: string; name: string; xp: number; badge: string | null }[]>("/insights/leaderboard"),
  hotspots: () =>
    call<{ lat: number; lng: number; risk: number; type: string }[]>("/insights/hotspot-prediction"),
};
