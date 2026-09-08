# RNTBCI Digital Twin — Frontend (3D Environment)

React + TypeScript + Vite + **React Three Fiber**. This is Purva's deliverable:
the 3D French-home environment (house, interior, car, EV charger, lighting,
camera). Shruti's device-control cards / power gauge / circuit panel are **not**
here yet — a small throwaway `DevPanel` + `AlertBanner` stand in so the scene can
be demoed and Decision A verified.

## Run it

```bash
# 1. backend mock (from the repo root, one folder up)
cd ..
python3 -m uvicorn mock_server:app --port 8000        # http://localhost:8000/docs
#   ^ use uvicorn directly; `python mock_server.py` enables --reload which can
#     orphan a stale worker if you restart it repeatedly.

# 2. frontend
cd frontend
npm install          # first time only
npm run dev          # http://localhost:5173
```

Pick a villa tier in the setup modal (medium = 9.2 kVA). The scene renders after
`setup_complete`, per DEVICE_VISUALS_MAPPING.md.

Backend URLs are overridable: `VITE_API_BASE_URL`, `VITE_WS_URL`.

## What's in the scene

| Area | Files |
|---|---|
| Canvas, lighting, sky, shadows, fog, day/night | `src/three/Scene.tsx` |
| French house exterior (2-storey, gable roof, shutters, garage) | `src/three/models/House.tsx` |
| Room layout, partitions, labels, device-zone markers | `src/three/models/Interior.tsx` |
| Compact hatchback + charging indicator (SOC bar, glow) | `src/three/models/Car.tsx` |
| Type-2 wall-box + animated Catmull-Rom cable | `src/three/models/EVCharger.tsx` |
| Grass, driveway, path, street, kerb | `src/three/models/Ground.tsx` |
| Low-poly trees, hedge, shrubs | `src/three/models/Landscaping.tsx` |
| Placeholder appliance models + Decision-A glow | `src/three/models/DeviceLayer.tsx`, `src/three/components/DeviceGlow.tsx` |
| Click-to-select + control card | `src/state/uiStore.ts`, `src/components/DeviceCard.tsx`, `src/components/DeviceList.tsx` |
| Camera presets + tween | `src/components/CameraPresets.tsx`, `src/three/CameraRig.tsx` |
| Procedural stucco / terracotta / gravel / stone textures | `src/three/textures.ts` |
| Canonical coordinates / glow colours (shared with Shruti) | `src/three/layout.ts` |

Everything is built from Three.js primitives + procedural CanvasTextures — no
GLB or image downloads, instant load, ~10k triangles total.

## Using the appliances

- Click an appliance in the 3D view, or a row in the **Appliances** panel
  (top-right), to open its control card (bottom-left). The list also flies the
  camera to the device and lifts the roof for indoor ones.
- The card calls the same `POST /devices/{id}/control` endpoint Shruti's UI
  will — the WebSocket then updates the store and the 3D glow.

## Integration contract (for Shruti)

- Device state lives in `src/state/twinStore.ts` (zustand). Your control cards
  call the API and let the WebSocket update the store; the 3D models subscribe.
  No 3D component calls the API.
- Device world positions + glow colours: **import from `src/three/layout.ts`**
  (`DEVICE_PLACEMENTS`, `DEVICE_PLACEMENT_BY_ID`, `GLOW_COLORS`). Don't hard-code.
- `src/three/components/DeviceGlow.tsx` is **Decision-A compliant by
  construction**: it has no `alert` input. Glow follows `operationalState` only.
  Keep it that way.

## Decision A self-check

1. Start EV (7.4 kW) + heat pump + water heater (DevPanel → "Trigger overload").
2. Alert banner goes critical / pulses red.
3. Every device model stays fully lit. Nothing dims or turns off.
4. Only clicking a device's Stop turns its glow off.
