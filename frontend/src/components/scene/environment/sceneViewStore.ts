/**
 * View-only state for the 3D environment (Purva's layer). Kept separate from
 * wsStore so toggling the roof / daylight / night never touches device state.
 */
import { create } from "zustand";

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Full preset list matching the house layout in HouseEnvironment.tsx.
 * House spans X: -8 → +6, Z: -4 → +3. Car at [-0.3, -, 9].
 * Kitchen devices: x ≈ -4 to -5.5, z ≈ -1.5
 * Utility devices: x ≈ +3 to +5,   z ≈ -1.5
 * EVSE / exterior: z ≈ 3.5 (front opening), car z ≈ 9
 */
export const CAMERA_PRESETS: Record<string, CameraPose> = {
  // Default wide view from front-right — sees the whole scene
  front:     { position: [0, 8, 20],     target: [0, 1, 0] },
  // Bird's-eye overview
  overview:  { position: [18, 18, 18],   target: [0, 0, 0] },
  // Full dollhouse — roof should be hidden for this one
  dollhouse: { position: [0, 22, 0.1],   target: [0, 0, 0] },
  // Kitchen corner — dishwasher / microwave / fridge
  kitchen:   { position: [-10, 5, 7],    target: [-4, 0.6, -1.5] },
  // Utility room — washing machine / water heater
  utility:   { position: [11, 5, 7],     target: [4, 0.6, -1.5] },
  // Garage / EV — EVSE charger + car in driveway
  garage:    { position: [2, 4.5, 16],   target: [0, 1, 5] },
  // Rear exterior — heat pump + CCTV
  rear:      { position: [2, 6, -12],    target: [1, 1, -2] },
};

export type LightingMode = "dark" | "daylight" | "night";

interface SceneViewState {
  lightingMode: LightingMode;
  roofVisible: boolean;
  cameraTarget: CameraPose | null;

  // Derived convenience booleans kept for backward compat with HouseEnvironment
  daylight: boolean;
  night: boolean;

  setLighting: (mode: LightingMode) => void;
  // Legacy toggles still work — each flips between the relevant modes
  toggleDaylight: () => void;
  toggleNight: () => void;
  toggleRoof: () => void;
  goTo: (preset: keyof typeof CAMERA_PRESETS) => void;
  clearCameraTarget: () => void;
}

export const useSceneViewStore = create<SceneViewState>((set) => ({
  lightingMode: "dark",
  roofVisible: true,
  cameraTarget: null,
  daylight: false,
  night: false,

  setLighting: (mode) =>
    set({ lightingMode: mode, daylight: mode === "daylight", night: mode === "night" }),

  toggleDaylight: () =>
    set((s) => {
      const next: LightingMode = s.lightingMode === "daylight" ? "dark" : "daylight";
      return { lightingMode: next, daylight: next === "daylight", night: false };
    }),

  toggleNight: () =>
    set((s) => {
      const next: LightingMode = s.lightingMode === "night" ? "dark" : "night";
      return { lightingMode: next, night: next === "night", daylight: false };
    }),

  toggleRoof: () => set((s) => ({ roofVisible: !s.roofVisible })),

  goTo: (preset) => set({ cameraTarget: CAMERA_PRESETS[preset] }),
  clearCameraTarget: () => set({ cameraTarget: null }),
}));
