/**
 * Shared types for the digital-twin frontend.
 *
 * The 3D environment components (Purva) only ever *read* these — device state
 * arrives as props from the store, which Shruti's control UI also writes into.
 * No 3D component calls the API directly.
 */

export type DeviceType =
  | 'evse'
  | 'light'
  | 'dishwasher'
  | 'washing_machine'
  | 'water_heater'
  | 'heat_pump'
  | 'cctv'
  | 'microwave'
  | 'refrigerator';

/** Raw operational_state strings the mock server emits. */
export type OperationalState = 'off' | 'on' | 'running' | 'idle' | 'fault';

export interface DeviceState {
  deviceId: string;
  deviceType: DeviceType;
  operationalState: OperationalState;
  powerWatts: number;

  /** Optional per-type extras, filled from state_change metadata / WS events. */
  level?: number; // light: Matter level 0-254
  mode?: string; // appliances
  targetTemperatureCelsius?: number;
  socPercent?: number; // evse
  isTapering?: boolean; // evse
  ratedPowerWatts?: number; // evse
  compressorOn?: boolean; // refrigerator
  streaming?: boolean; // cctv
  recording?: boolean; // cctv
  cookTimeSecondsRemaining?: number; // microwave
}

export interface SystemAlert {
  id: string;
  severity: 'warning' | 'critical';
  message: string;
  totalDrawWatts: number;
  limitWatts: number;
  raisedAt: string;
}

export interface PowerReading {
  totalDrawWatts: number;
  limitWatts: number;
  status: 'ok' | 'warning' | 'critical';
  perDevice: { deviceId: string; watts: number }[];
}

export type TimeOfDay = 'day' | 'night';

/** True when the device is drawing power / should show its active glow. */
export function isDeviceActive(d: Pick<DeviceState, 'operationalState'>): boolean {
  return d.operationalState === 'on' || d.operationalState === 'running';
}
