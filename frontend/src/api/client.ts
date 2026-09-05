import { API_BASE } from "../config";
import type {
  AlertRecord,
  ControlRequest,
  DeviceListItem,
  EvSessionRecord,
  EvSessionSnapshot,
  HouseholdHealth,
  LocationInfo,
  MatterEnvelope,
  PowerBudget,
  PowerHistoryItem,
  PowerSummary,
  SystemSetupResponse,
  Tier,
} from "../types";

// ── Generic fetch helper ───────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `POST ${path} → ${res.status}`);
  }
  return res.json();
}

// ── System ─────────────────────────────────────────────────────────────────────

export function setupSystem(tier: Tier) {
  return post<SystemSetupResponse>("/system/setup", { tier });
}

export function getPowerBudget() {
  return get<PowerBudget>("/system/power-budget");
}

export function getAlerts(limit = 50) {
  return get<AlertRecord[]>(`/system/alerts?limit=${limit}`);
}

export function getExportUrl(opts: {
  format: "csv" | "xlsx";
  device_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const params = new URLSearchParams({ format: opts.format });
  if (opts.device_id) params.set("device_id", opts.device_id);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.limit) params.set("limit", String(opts.limit));
  return `${API_BASE}/system/export?${params.toString()}`;
}

// ── Devices ────────────────────────────────────────────────────────────────────

export function listDevices(): Promise<{ devices: DeviceListItem[] }> {
  return get("/devices");
}

export function getDevice(id: string): Promise<MatterEnvelope> {
  return get(`/devices/${id}`);
}

export function controlDevice(id: string, body: ControlRequest): Promise<MatterEnvelope> {
  return post(`/devices/${id}/control`, body);
}

// ── Modules ────────────────────────────────────────────────────────────────────

export function getPowerSummary(): Promise<PowerSummary> {
  return get("/modules/power/summary");
}

export interface PowerHistoryParams {
  device_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export function getPowerHistory(params: PowerHistoryParams = {}): Promise<PowerHistoryItem[]> {
  const p = new URLSearchParams();
  if (params.device_id) p.set("device_id", params.device_id);
  if (params.from) p.set("from", params.from);
  if (params.to) p.set("to", params.to);
  if (params.limit) p.set("limit", String(params.limit));
  const qs = p.toString();
  return get(`/modules/power/history${qs ? `?${qs}` : ""}`);
}

export function getEvSession(): Promise<EvSessionSnapshot | null> {
  return get("/modules/ev/session");
}

export function getEvSessions(limit = 20): Promise<EvSessionRecord[]> {
  return get(`/modules/ev/sessions?limit=${limit}`);
}

export function getLocation(): Promise<LocationInfo> {
  return get("/modules/location");
}

export function getHealth(): Promise<HouseholdHealth> {
  return get("/modules/health");
}

export function getDeviceHealth(id: string) {
  return get(`/modules/health/${id}`);
}
