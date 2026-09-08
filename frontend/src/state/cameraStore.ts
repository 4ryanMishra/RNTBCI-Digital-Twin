/**
 * Camera preset store. CameraPresets buttons write a target pose here;
 * <CameraRig> (inside the Canvas) tweens the camera + OrbitControls target
 * toward it and clears it once settled.
 */
import { create } from 'zustand';

export interface CameraPose {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export const CAMERA_PRESETS: Record<string, CameraPose> = {
  front: { position: [2, 13, 38], lookAt: [0, 4, 2] },
  overview: { position: [30, 26, 34], lookAt: [0, 3, 0] },
  garage: { position: [14, 6, 20], lookAt: [5.4, 1.5, 9] },
  kitchen: { position: [-13, 8, 8], lookAt: [-4, 1, -2.5] },
  dollhouse: { position: [4, 26, 22], lookAt: [-1, 1, -0.5] },
  rear: { position: [-8, 10, -22], lookAt: [-2, 3, -3] },
};

interface CameraState {
  target: CameraPose | null;
  goTo: (preset: keyof typeof CAMERA_PRESETS) => void;
  goToDevice: (pos: [number, number, number]) => void;
  setTarget: (pose: CameraPose | null) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  target: null,
  goTo: (preset) => set({ target: CAMERA_PRESETS[preset] }),
  goToDevice: ([x, y, z]) =>
    set({
      target: {
        position: [x + 5, y + 4.5, z + 8.5],
        lookAt: [x, Math.max(0.6, y), z],
      },
    }),
  setTarget: (pose) => set({ target: pose }),
}));
