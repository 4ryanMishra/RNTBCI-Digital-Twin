// Canonical device glow colors — verbatim from spec (Decision A applies)
export const DEVICE_COLORS = {
  evse: {
    active: "#00BFFF",
    tapering: "#FFD700",
    off: "#1a2a3a",
  },
  light: {
    active: "#FFF5C0",
    off: "#1a1a1a",
  },
  dishwasher: {
    active: "#4FC3F7",
    idle: "#4FC3F7",
    off: "#1a2535",
  },
  washing_machine: {
    active: "#4FC3F7",
    off: "#1a2535",
  },
  water_heater: {
    active: "#FF7043",
    off: "#2a1a14",
  },
  heat_pump: {
    heat: "#FF7043",
    cool: "#42A5F5",
    auto: "#42A5F5",
    off: "#1a1a2a",
  },
  cctv: {
    active: "#B0BEC5",
    dim: "#78909C",
    recDot: "#F44336",
  },
  microwave: {
    active: "#CE93D8",
    off: "#1a1226",
  },
  refrigerator: {
    full: "#80CBC4",
    idle: "#3d6b68", // ~30% — visibly distinct
    off: "#1a2525",
  },
} as const;

// Zone thresholds for circuit panel HUD
export const ZONE_COLOR = (pct: number): string => {
  if (pct < 80) return "#4CAF50";
  if (pct < 95) return "#FFC107";
  return "#F44336";
};

export const ZONE_CLASS = (pct: number): string => {
  if (pct < 80) return "glow-green";
  if (pct < 95) return "glow-amber";
  return "glow-red";
};
