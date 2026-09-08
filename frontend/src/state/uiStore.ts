/**
 * UI-only state kept out of twinStore so device hover doesn't re-render the
 * whole scene graph.
 */
import { create } from 'zustand';

interface UiState {
  selectedDeviceId: string | null;
  hoveredDeviceId: string | null;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedDeviceId: null,
  hoveredDeviceId: null,
  select: (id) => set({ selectedDeviceId: id }),
  hover: (id) => set({ hoveredDeviceId: id }),
}));
