/**
 * Single source of truth for scene geometry. Every model reads from here so
 * the house, driveway, car, charger and device markers line up exactly.
 *
 * Units: metres. Axes: +X right, +Y up, +Z toward the street (house faces +Z).
 * Origin: centre of the ground-floor slab.
 */
import type { DeviceType } from '../types';

export const HOUSE = {
  width: 15, // X
  depth: 10, // Z
  floorHeight: 3,
  floors: 2,
  wallThickness: 0.2,
  roofRidgeHeight: 2.6, // rise above the wall top (low Mediterranean pitch)
  frontZ: 5, // +Z face (street side)
  backZ: -5,
  leftX: -7.5,
  rightX: 7.5,
} as const;

/** Roof geometry shared with House.tsx so the solar array sits flush on the slope. */
export const ROOF = {
  eaveOverhangZ: 0.55,
  eaveOverhangX: 0.45,
} as const;

/** Pitch of the front/back roof slopes, from ridge to eave. */
export const ROOF_SLOPE_ANGLE = Math.atan2(
  HOUSE.roofRidgeHeight,
  HOUSE.depth / 2 + ROOF.eaveOverhangZ,
);

export const GARAGE = {
  // Right-hand third of the ground floor is the garage.
  minX: 3.5,
  maxX: 7.5,
  doorWidth: 3,
  doorHeight: 2.3,
} as const;

export const DRIVEWAY = {
  centerX: 5.5,
  width: 5,
  fromZ: HOUSE.frontZ, // garage door
  toZ: 22, // street kerb
} as const;

export const STREET_Z = 24;

/** Where the car sits, nose pointing toward the street (+Z). */
export const CAR = {
  position: [5.4, 0, 12] as [number, number, number],
  rotationY: 0,
  length: 4.3,
  width: 1.8,
  height: 1.5,
  /** Charging flap: left side, toward the front. World-space. */
  chargePort: [4.55, 0.75, 13.4] as [number, number, number],
} as const;

/** Wall-box charger, mounted on the house wall just left of the garage door. */
export const EV_CHARGER = {
  position: [2.9, 1.25, HOUSE.frontZ + 0.12] as [number, number, number],
  cableAnchor: [2.9, 1.0, HOUSE.frontZ + 0.15] as [number, number, number],
} as const;

export interface DevicePlacement {
  id: string;
  type: DeviceType;
  label: string;
  /** World position of the device model / glow. */
  position: [number, number, number];
  /** Room it belongs to (for the HUD + Shruti's control cards). */
  room: string;
  alwaysOn: boolean;
}

/**
 * Canonical device placements. Exported for Shruti — her control UI and glow
 * wiring should import DEVICE_PLACEMENTS rather than hard-coding coordinates.
 * Keep this in sync with DEVICE_VISUALS_MAPPING.md if anything moves.
 */
export const DEVICE_PLACEMENTS: DevicePlacement[] = [
  { id: 'evse_01', type: 'evse', label: 'EV Charger', position: [2.9, 1.25, 5.15], room: 'Garage (exterior wall)', alwaysOn: false },
  { id: 'light_01', type: 'light', label: 'Living-room Light', position: [-3.6, 2.7, 2.4], room: 'Living room', alwaysOn: false },
  { id: 'dishwasher_01', type: 'dishwasher', label: 'Dishwasher', position: [-6.6, 0.55, -3.7], room: 'Kitchen', alwaysOn: false },
  { id: 'washing_machine_01', type: 'washing_machine', label: 'Washing Machine', position: [1.4, 0.55, -3.8], room: 'Utility room', alwaysOn: false },
  { id: 'water_heater_01', type: 'water_heater', label: 'Water Heater', position: [2.9, 0.95, -3.9], room: 'Utility room', alwaysOn: false },
  { id: 'heat_pump_01', type: 'heat_pump', label: 'Heat Pump', position: [-3.2, 0.45, -6.4], room: 'Outside (rear)', alwaysOn: false },
  { id: 'cctv_01', type: 'cctv', label: 'Security Camera', position: [-7.1, 5.3, 4.7], room: 'Outside (front corner)', alwaysOn: true },
  { id: 'microwave_01', type: 'microwave', label: 'Microwave', position: [-2.4, 1.35, -4.5], room: 'Kitchen', alwaysOn: false },
  { id: 'refrigerator_01', type: 'refrigerator', label: 'Refrigerator', position: [-6.8, 1.0, -1.1], room: 'Kitchen', alwaysOn: true },
  { id: 'solar_panel_01', type: 'solar_panel', label: 'Solar Array', position: [-4, 7.2, 3.0], room: 'Roof (front slope)', alwaysOn: true },
];

export const DEVICE_PLACEMENT_BY_ID: Record<string, DevicePlacement> = Object.fromEntries(
  DEVICE_PLACEMENTS.map((p) => [p.id, p]),
);

/** Back-compat plain map, if a consumer just wants coordinates. */
export const DEVICE_POSITIONS: Record<string, [number, number, number]> = Object.fromEntries(
  DEVICE_PLACEMENTS.map((p) => [p.id, p.position]),
);

/** Glow colour per device type (emissive), from DEVICE_VISUALS_MAPPING.md. */
export const GLOW_COLORS: Record<DeviceType, string> = {
  evse: '#00BFFF',
  light: '#FFF5C0',
  dishwasher: '#4FC3F7',
  washing_machine: '#4FC3F7',
  water_heater: '#FF7043',
  heat_pump: '#42A5F5',
  cctv: '#B0BEC5',
  microwave: '#CE93D8',
  refrigerator: '#80CBC4',
  solar_panel: '#2F6FE0',
};

export const EVSE_TAPER_COLOR = '#FFD700';
