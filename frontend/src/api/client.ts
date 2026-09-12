/**
 * REST client for the digital-twin backend (mock_server.py shape).
 *
 * Only the setup flow + a thin control passthrough live here. The 3D
 * environment never imports this file — it is used by the connection hook
 * and the dev control harness.
 */
import axios from 'axios';

import { API_BASE_URL } from '../config';
import type { DeviceType } from '../types';

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

export interface HealthResponse {
  status: string;
  mode?: string;
  setupComplete: boolean;
  devicesRegistered?: number;
}

/** `/health` sits at the server root, not under `/api/v1`. */
const ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await axios.get<HealthResponse>(`${ROOT_URL}/health`, {
    timeout: 8000,
  });
  return data;
}

export interface SetupResponse {
  status: string;
  tier: string;
  contractedPowerKva: number;
  currentRatingA: number;
  phaseConfig: string;
  voltageV: number;
}

export async function setupSystem(tier: string): Promise<SetupResponse> {
  const { data } = await http.post<SetupResponse>('/system/setup', { tier });
  return data;
}

export interface DeviceListEntry {
  deviceId: string;
  deviceType: DeviceType;
  operationalState: string;
  powerWatts: number;
}

export async function listDevices(): Promise<DeviceListEntry[]> {
  const { data } = await http.get<{ devices: DeviceListEntry[] }>('/devices');
  return data.devices;
}

export interface PowerSummaryEntry {
  deviceId: string;
  deviceType: DeviceType;
  operationalState: string;
  powerWatts: number;
}

export async function getPowerSummary(): Promise<{
  totalWatts: number;
  /** Present once the backend has solar PV support (device_registry.py: solar_panel_01). */
  solarGenerationWatts?: number;
  netWatts?: number;
  limitWatts: number;
  budgetStatus: string;
  perDevice: PowerSummaryEntry[];
}> {
  const { data } = await http.get('/modules/power/summary');
  return data;
}

export interface EvSession {
  deviceId: string;
  operationalState: string;
  socPercent: number;
  powerWatts: number;
  isTapering: boolean;
  taperStartSocPercent: number;
  ratedPowerWatts: number;
  minutesToFull: number | null;
}

export async function getEvSession(): Promise<EvSession> {
  const { data } = await http.get<EvSession>('/modules/ev/session');
  return data;
}

export interface RawAlert {
  id: string;
  severity: 'warning' | 'critical';
  message: string;
  total_draw_watts: number;
  limit_watts: number;
  raised_at: string;
}

export async function getAlerts(): Promise<RawAlert[]> {
  const { data } = await http.get<RawAlert[]>('/system/alerts');
  return data;
}

/** Generic device control passthrough — mirrors mock_server control endpoint. */
export async function controlDevice(
  deviceId: string,
  action: string,
  parameters?: Record<string, unknown>,
): Promise<unknown> {
  const { data } = await http.post(`/devices/${deviceId}/control`, {
    action,
    parameters,
  });
  return data;
}
