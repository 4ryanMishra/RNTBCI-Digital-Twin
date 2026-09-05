import { create } from "zustand";
import type {
  DeviceState,
  WsAlert,
  WsDutyCycleToggle,
  WsEvent,
  WsPowerReading,
  WsSocTaperUpdate,
  WsStateChange,
} from "../types";

// ── State shape ───────────────────────────────────────────────────────────────

interface WsStore {
  // Connection status
  connected: boolean;
  setupComplete: boolean;
  setupMessage: string | null;
  tier: string | null;
  contractedPowerKva: number | null;
  currentRatingA: number | null;

  // Live readings
  latestPowerReading: WsPowerReading["data"] | null;

  // Per-device states (keyed by deviceId)
  deviceStates: Record<string, DeviceState>;

  // Last events
  lastAlert: WsAlert["data"] | null;
  lastDutyCycleToggle: (WsDutyCycleToggle & { receivedAt: number }) | null;
  lastSocTaperUpdate: (WsSocTaperUpdate & { receivedAt: number }) | null;

  // Actions
  setConnected: (v: boolean) => void;
  handleEvent: (event: WsEvent) => void;
  setDeviceStates: (devices: DeviceState[]) => void;
  updateDeviceState: (id: string, patch: Partial<DeviceState>) => void;
  dismissAlert: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useWsStore = create<WsStore>((set) => ({
  connected: false,
  setupComplete: false,
  setupMessage: null,
  tier: null,
  contractedPowerKva: null,
  currentRatingA: null,
  latestPowerReading: null,
  deviceStates: {},
  lastAlert: null,
  lastDutyCycleToggle: null,
  lastSocTaperUpdate: null,

  setConnected: (v) => set({ connected: v }),

  handleEvent: (event) => {
    switch (event.type) {
      case "setup_incomplete":
        set({ setupComplete: false, setupMessage: event.data.message });
        break;

      case "setup_complete":
        set({
          setupComplete: true,
          tier: event.data.tier,
          contractedPowerKva: event.data.contractedPowerKva,
          currentRatingA: event.data.currentRatingA,
          setupMessage: null,
        });
        break;

      case "power_reading":
        set((s) => {
          // Merge per-device watts into deviceStates
          const deviceStates = { ...s.deviceStates };
          for (const d of event.data.perDevice) {
            if (deviceStates[d.deviceId]) {
              deviceStates[d.deviceId] = {
                ...deviceStates[d.deviceId],
                powerWatts: d.watts,
              };
            }
          }
          return { latestPowerReading: event.data, deviceStates };
        });
        break;

      case "state_change": {
        const ev = event as WsStateChange;
        set((s) => ({
          deviceStates: {
            ...s.deviceStates,
            [ev.deviceId]: {
              ...(s.deviceStates[ev.deviceId] ?? {
                deviceId: ev.deviceId,
                deviceType: "",
              }),
              deviceId: ev.deviceId,
              operationalState: ev.data.operationalState,
              powerWatts: ev.data.powerWatts,
              metadata: ev.data.metadata,
            },
          },
        }));
        break;
      }

      case "duty_cycle_toggle": {
        const ev = event as WsDutyCycleToggle;
        set((s) => ({
          lastDutyCycleToggle: { ...ev, receivedAt: Date.now() },
          deviceStates: {
            ...s.deviceStates,
            [ev.deviceId]: {
              ...(s.deviceStates[ev.deviceId] ?? {
                deviceId: ev.deviceId,
                deviceType: "refrigerator",
                operationalState: "on",
                metadata: {},
              }),
              powerWatts: ev.data.powerWatts,
              metadata: {
                ...(s.deviceStates[ev.deviceId]?.metadata ?? {}),
                compressor_on: ev.data.compressorOn,
              },
            },
          },
        }));
        break;
      }

      case "soc_taper_update": {
        const ev = event as WsSocTaperUpdate;
        set((s) => ({
          lastSocTaperUpdate: { ...ev, receivedAt: Date.now() },
          deviceStates: {
            ...s.deviceStates,
            [ev.deviceId]: {
              ...(s.deviceStates[ev.deviceId] ?? {
                deviceId: ev.deviceId,
                deviceType: "evse",
                operationalState: "running",
                metadata: {},
              }),
              powerWatts: ev.data.powerWatts,
              metadata: {
                ...(s.deviceStates[ev.deviceId]?.metadata ?? {}),
                soc_percent: ev.data.socPercent,
                is_tapering: ev.data.enteredTaper,
              },
            },
          },
        }));
        break;
      }

      case "alert":
        set({ lastAlert: event.data });
        break;
    }
  },

  setDeviceStates: (devices) =>
    set({
      deviceStates: Object.fromEntries(devices.map((d) => [d.deviceId, d])),
    }),

  updateDeviceState: (id, patch) =>
    set((s) => ({
      deviceStates: {
        ...s.deviceStates,
        [id]: { ...(s.deviceStates[id] ?? {}), ...patch } as DeviceState,
      },
    })),

  dismissAlert: () => set({ lastAlert: null }),
}));
