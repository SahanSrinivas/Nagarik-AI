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
  before_video_url?: string | null;
  after_video_url?: string | null;
  before_audio_url?: string | null;
  routed_department: string | null;
  sla_deadline: string | null;
  duplicate_of_id: string | null;
  ai_confidence: number;
  // V2 fields — populated post-classification / post-resolution
  estimated_materials?: { name: string; qty: number; unit: string }[];
  estimated_cost_inr?: number | null;
  share_image_url?: string | null;
  diy_unlocked_at?: string | null;
  diy_threshold_met_at?: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Pledge {
  id: string;
  issue_id: string;
  citizen_id: string;
  kind: "funds" | "hours";
  amount_inr: number | null;
  hours: number | null;
  note: string | null;
  created_at: string;
}

export interface DiyState {
  unlocked: boolean;
  unlocked_at: string | null;
  threshold_met: boolean;
  threshold_met_at: string | null;
  funds_total_inr: number;
  hours_total: number;
  pledges: Pledge[];
  schedule: Record<string, unknown>;
}

export interface AgentEvent {
  agent: string;
  status: string;
  payload: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

export interface RouteStop {
  issue_id: string;
  lat: number;
  lng: number;
  type: string;
  severity: number;
  address: string | null;
  arrival_clock_min?: number | null;   // minutes from midnight, UTC
  depart_clock_min?: number | null;
  service_min?: number | null;
  travel_min_from_prev?: number | null;
}

export interface CrewRoute {
  crew_id: string;
  crew_name: string;
  department: string;
  depot: { lat: number; lng: number };
  stops: RouteStop[];
  total_km: number;
  total_time_min: number;
  shift_start_hour?: number;
  shift_end_hour?: number;
}

export interface ScheduleResponse {
  solver_status: string;
  runtime_seconds: number;
  routes: CrewRoute[];
  metrics: Record<string, number>;
}

export interface CompareResponse {
  fifo: Record<string, number>;
  milp: Record<string, number>;
  improvement: { km_reduction_pct: number | null; additional_served: number };
  n_issues: number;
  n_crews: number;
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

export interface SignedUpload {
  provider: string;
  key: string;
  upload_url: string | null;
  token?: string;
  public_url: string;
  note?: string;
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
  compareSchedule: (date: string, ward?: string) =>
    call<CompareResponse>("/schedule/compare", {
      method: "POST",
      body: JSON.stringify({ date, ward }),
    }),
  wardStats: () => call<{ ward: string; total: number; resolved: number }[]>("/insights/ward-stats"),
  leaderboard: () =>
    call<{ id: string; name: string; xp: number; badge: string | null }[]>("/insights/leaderboard"),
  hotspots: () =>
    call<{ lat: number; lng: number; risk: number; type: string }[]>("/insights/hotspot-prediction"),
  hotspotsGeoJSON: () =>
    call<GeoJSON.FeatureCollection>("/insights/hotspots.geojson"),
  wardsGeoJSON: () =>
    call<GeoJSON.FeatureCollection>("/insights/wards.geojson"),
  signedUpload: (contentType = "image/jpeg") =>
    call<SignedUpload>(`/uploads/signed-url?content_type=${encodeURIComponent(contentType)}`, {
      method: "POST",
    }),
  chainStatus: () =>
    call<{ enabled: boolean; network: string; anchor_contract: string | null; badge_contract: string | null; milestones: { xp: number; tier: string }[] }>("/chain/status"),
  flushAnchor: () =>
    call<{ enabled: boolean; merkle_root: string; tx_hash: string | null; batch_id: number | null; leaf_count: number }>("/chain/anchor/flush", { method: "POST" }),
  mintBadge: (citizenId: string) =>
    call<{ minted: boolean; shadow_mode: boolean; tier: string; wallet: string | null; tx_hash: string | null }>(`/chain/badge/check/${citizenId}`, { method: "POST" }),
  wallet: (citizenId: string) =>
    call<{
      citizen: { id: string; name: string; phone_masked: string; xp: number; current_badge: string | null };
      wallet_address: string;
      chain: { enabled: boolean; network: string; badge_contract: string | null; explorer_base: string | null };
      earned_count: number;
      badges: { tier: string; xp_threshold: number; image: string; earned: boolean; is_current: boolean }[];
      next_tier: { tier: string; xp_threshold: number; xp_to_go: number; progress_pct: number } | null;
    }>(`/chain/wallet/${citizenId}`),
};

export async function uploadPhoto(file: File): Promise<string> {
  const slot = await api.signedUpload(file.type || "image/jpeg");
  if (!slot.upload_url) return slot.public_url; // stub mode
  await fetch(slot.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  return slot.public_url;
}

/** Same flow as uploadPhoto but for video — content-type just propagates. */
export async function uploadVideo(file: File): Promise<string> {
  const slot = await api.signedUpload(file.type || "video/mp4");
  if (!slot.upload_url) return slot.public_url; // stub mode → returns a pothole demo clip
  await fetch(slot.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "video/mp4" },
    body: file,
  });
  return slot.public_url;
}

/** Upload a recorded voice note (m4a / webm-opus). Same signed-URL dance. */
export async function uploadAudio(blob: Blob, mime = "audio/m4a"): Promise<string> {
  const slot = await api.signedUpload(mime);
  if (!slot.upload_url) return slot.public_url;
  await fetch(slot.upload_url, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: blob,
  });
  return slot.public_url;
}

export const pledgesApi = {
  state: (issueId: string) => call<DiyState>(`/issues/${issueId}/diy`),
  create: (
    issueId: string,
    body: { kind: "funds" | "hours"; amount_inr?: number; hours?: number; note?: string },
    token?: string | null,
  ) =>
    fetch(`${BASE}/issues/${issueId}/pledges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      return r.json() as Promise<Pledge>;
    }),
};
