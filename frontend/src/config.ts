/**
 * Backend connection config.
 *
 * The mock server (mock_server.py) runs on port 8000 by default:
 *   REST  ->  http://localhost:8000/api/v1
 *   WS    ->  ws://localhost:8000/ws
 *
 * Override at build/run time with VITE_API_BASE_URL / VITE_WS_URL.
 */

const DEFAULT_HOST = 'localhost:8000';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? `http://${DEFAULT_HOST}/api/v1`;

export const WS_URL: string =
  import.meta.env.VITE_WS_URL ?? `ws://${DEFAULT_HOST}/ws`;

/** Villa tiers offered in the setup modal (mirrors mock_server _VILLA_TIERS). */
export const VILLA_TIERS = [
  {
    id: 'small',
    label: 'Small Residential Villa',
    detail: '6 kVA · 30 A · single-phase',
    contractedPowerKva: 6.0,
  },
  {
    id: 'medium',
    label: 'Medium Family Home',
    detail: '9.2 kVA · 40 A · single-phase',
    contractedPowerKva: 9.2,
  },
  {
    id: 'large',
    label: 'Large Villa / High-End Home',
    detail: '18.4 kVA · 3-phase',
    contractedPowerKva: 18.4,
  },
] as const;

export type VillaTierId = (typeof VILLA_TIERS)[number]['id'];
