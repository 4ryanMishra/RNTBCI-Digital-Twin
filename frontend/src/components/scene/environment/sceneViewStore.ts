/**
 * View-only state for the 3D environment (Purva's layer). Kept separate from
 * wsStore so toggling the roof / daylight never touches device state.
 */
import { create } from "zustand";

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/** Presets tuned to the device layout in SceneCanvas. */
export const CAMERA_PRESETS: Record<string, CameraPose> = {
  home: { position: [0, 9, 18], target: [0, 1, -0.5] },
  overview: { position: [16, 13, 18], target: [0, 0.5, 0] },
  kitchen: { position: [-10, 6.5, 9], target: [-4, 0.6, -1.5] },
  utility: { position: [11, 6.5, 10], target: [4, 0.6, -1.5] },
  driveway: { position: [2, 5, 17], target: [-0.3, 1, 6] },
};

interface SceneViewState {
  daylight: boolean;
  roofVisible: boolean;
  cameraTarget: CameraPose | null;
  toggleDaylight: () => void;
  toggleRoof: () => void;
  goTo: (preset: keyof typeof CAMERA_PRESETS) => void;
  clearCameraTarget: () => void;
}

export const useSceneViewStore = create<SceneViewState>((set) => ({
  daylight: false,
  roofVisible: true,
  cameraTarget: null,
  toggleDaylight: () => set((s) => ({ daylight: !s.daylight })),
  toggleRoof: () => set((s) => ({ roofVisible: !s.roofVisible })),
  goTo: (preset) => set({ cameraTarget: CAMERA_PRESETS[preset] }),
  clearCameraTarget: () => set({ cameraTarget: null }),
}));
