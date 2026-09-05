// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the RNTBCI Digital Twin frontend
// ─────────────────────────────────────────────────────────────────────────────

// ── API types ────────────────────────────────────────────────────────────────

export type Tier = "small" | "medium" | "large";

export interface SystemSetupResponse {
  status: string;
  tier: Tier;
  contractedPowerKva: number;
  currentRatingA: number;
}

export interface PowerBudget {
  totalDrawWatts: number;
  limitWatts: number;
  status: string;
  perDevice: Array<{ deviceId: string; watts: number }>;
}

export interface AlertRecord {
  id: number | string;
  severity: string;
  alertType: string;
  message: string;
  totalDrawWatts: number;
  limitWatts: number;
  raisedAt: string;
}

export interface DeviceListItem {
  deviceId: string;
  deviceType: string;
  operationalState: string;
  powerWatts: number;
}

export interface MatterEnvelope {
  device_id: string;
  device_type: string;
  clusters: Record<string, { attributes: Record<string, unknown> }>;
  meta: { timestamp: string; operational_state: string };
}

export interface PowerSummary {
  totalWatts: number;
  limitWatts: number;
  budgetStatus: string;
  utilisationPct: number;
  perDevice: Array<{
    deviceId: string;
    deviceType: string;
    operationalState: string;
    powerWatts: number;
  }>;
  timestamp: string;
}

export interface PowerHistoryItem {
  deviceId: string;
  timestamp: string;
  watts: number;
}

export interface EvSessionSnapshot {
  deviceId: string;
  operationalState: string;
  socPercent: number;
  powerWatts: number;
  isTapering: boolean;
  taperStartSocPercent: number;
  ratedPowerWatts: number;
  energyAddedKwh: number;
  minutesToFull: number | null;
}

export interface EvSessionRecord {
  sessionId: number;
  startedAt: string;
  endedAt: string | null;
  startSocPct: number;
  endSocPct: number;
  energyAddedKwh: number;
  peakPowerWatts: number;
  completed: boolean;
}

export interface LocationInfo {
  setupComplete: boolean;
  tier: string | null;
  phaseConfig: string | null;
  voltageV: number | null;
  contractedPowerKva: number | null;
  currentRatingA: number | null;
}

export interface DeviceHealthItem {
  deviceId: string;
  deviceType: string;
  health: "healthy" | "degraded" | "fault" | "offline";
  operationalState: string;
  uptimeSeconds: number;
  lastSeen: string | null;
  faultMessage: string | null;
}

export interface HouseholdHealth {
  overall: string;
  healthyCount: number;
  degradedCount: number;
  faultCount: number;
  offlineCount: number;
  devices: DeviceHealthItem[];
  timestamp: string;
}

// ── WebSocket event types ─────────────────────────────────────────────────────

export type WsEventType =
  | "setup_incomplete"
  | "setup_complete"
  | "power_reading"
  | "state_change"
  | "duty_cycle_toggle"
  | "soc_taper_update"
  | "alert"
  | "pong"
  | "keepalive";

export interface WsSetupIncomplete {
  type: "setup_incomplete";
  data: { message: string };
}

export interface WsSetupComplete {
  type: "setup_complete";
  data: { tier: string; contractedPowerKva: number; currentRatingA: number };
}

export interface WsPowerReading {
  type: "power_reading";
  data: {
    totalDrawWatts: number;
    limitWatts: number;
    status: string;
    perDevice: Array<{ deviceId: string; watts: number }>;
  };
}

export interface WsStateChange {
  type: "state_change";
  deviceId: string;
  data: {
    operationalState: string;
    powerWatts: number;
    metadata: Record<string, unknown>;
  };
}

export interface WsDutyCycleToggle {
  type: "duty_cycle_toggle";
  deviceId: string;
  data: { compressorOn: boolean; powerWatts: number };
}

export interface WsSocTaperUpdate {
  type: "soc_taper_update";
  deviceId: string;
  data: { socPercent: number; powerWatts: number; enteredTaper: boolean };
}

export interface WsAlert {
  type: "alert";
  data: {
    alertType: string;
    message: string;
    totalLoadWatts: number;
    limitWatts: number;
  };
}

export interface WsPong {
  type: "pong";
  timestamp: string;
}

export interface WsKeepalive {
  type: "keepalive";
  timestamp: string;
}

export type WsEvent =
  | WsSetupIncomplete
  | WsSetupComplete
  | WsPowerReading
  | WsStateChange
  | WsDutyCycleToggle
  | WsSocTaperUpdate
  | WsAlert
  | WsPong
  | WsKeepalive;

// ── Device state stored in WS store ──────────────────────────────────────────

export interface DeviceState {
  deviceId: string;
  deviceType: string;
  operationalState: string;
  powerWatts: number;
  metadata: Record<string, unknown>;
}

// ── Control action payloads ───────────────────────────────────────────────────

export interface ControlRequest {
  action: string;
  parameters?: Record<string, unknown>;
}
