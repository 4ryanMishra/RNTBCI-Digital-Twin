/**
 * Central twin state store (zustand).
 *
 * This is the single source of truth the 3D scene reads from. Shruti's control
 * UI and the WebSocket connection hook both write here; the 3D components only
 * subscribe. Keeping the store framework-agnostic means the environment work
 * never needs to know where the data came from.
 */
import { create } from 'zustand';

import type {
  DeviceState,
  DeviceType,
  PowerReading,
  SystemAlert,
  TimeOfDay,
} from '../types';

/** Seed models for all 10 devices — matches device_registry.py. */
const SEED_DEVICES: DeviceType[] = [
  'evse',
  'light',
  'dishwasher',
  'washing_machine',
  'water_heater',
  'heat_pump',
  'cctv',
  'microwave',
  'refrigerator',
  'solar_panel',
];

function seedDevice(type: DeviceType): DeviceState {
  const alwaysOn = type === 'cctv' || type === 'refrigerator' || type === 'solar_panel';
  return {
    deviceId: `${type}_01`,
    deviceType: type,
    operationalState: alwaysOn ? 'running' : 'off',
    powerWatts: 0,
    ...(type === 'cctv' ? { streaming: true, recording: true } : {}),
    ...(type === 'refrigerator' ? { compressorOn: true } : {}),
    ...(type === 'evse' ? { socPercent: 62, isTapering: false, ratedPowerWatts: 7000 } : {}),
    ...(type === 'light' ? { level: 254 } : {}),
    ...(type === 'solar_panel' ? { generationWatts: 0 } : {}),
  };
}

interface TwinState {
  connected: boolean;
  setupComplete: boolean;
  tier: string | null;
  limitWatts: number | null;

  devices: Record<string, DeviceState>;
  power: PowerReading | null;
  alert: SystemAlert | null;

  /** Environment-only view state (owned by Purva's 3D work). */
  timeOfDay: TimeOfDay;
  roofVisible: boolean;

  // --- actions ---
  setConnected: (v: boolean) => void;
  setSetup: (tier: string, limitWatts: number) => void;
  upsertDevice: (patch: Partial<DeviceState> & { deviceId: string; deviceType?: DeviceType }) => void;
  setPower: (r: PowerReading) => void;
  setAlert: (a: SystemAlert | null) => void;
  setTimeOfDay: (t: TimeOfDay) => void;
  toggleRoof: () => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  connected: false,
  setupComplete: false,
  tier: null,
  limitWatts: null,

  devices: Object.fromEntries(
    SEED_DEVICES.map((t) => {
      const d = seedDevice(t);
      return [d.deviceId, d];
    }),
  ),
  power: null,
  alert: null,

  timeOfDay: 'day',
  roofVisible: true,

  setConnected: (v) => set({ connected: v }),
  setSetup: (tier, limitWatts) => set({ setupComplete: true, tier, limitWatts }),

  upsertDevice: (patch) =>
    set((s) => {
      const prev = s.devices[patch.deviceId];
      const next: DeviceState = {
        // fall back to a fresh seed if we somehow get an unknown id
        ...(prev ??
          seedDevice((patch.deviceType ?? 'light') as DeviceType)),
        ...patch,
      } as DeviceState;
      return { devices: { ...s.devices, [patch.deviceId]: next } };
    }),

  setPower: (r) => set({ power: r }),
  setAlert: (a) => set({ alert: a }),
  setTimeOfDay: (t) => set({ timeOfDay: t }),
  toggleRoof: () => set((s) => ({ roofVisible: !s.roofVisible })),
}));

/** Convenience selector: one device by id. */
export function useDevice(deviceId: string): DeviceState | undefined {
  return useTwinStore((s) => s.devices[deviceId]);
}
