# Purva — 3D Environment Progress

**Status:** Weeks 1–4 of `TASKLISTT.md` implemented in one pass.
**Code:** `frontend/` (Vite + React + TypeScript + React Three Fiber).
**Run:** see `frontend/README.md`. Backend = `mock_server.py` on :8000.

Built with Three.js primitives + procedural CanvasTextures (TASKLISTT Option C) —
no external GLB, instant load, ~10k triangles, comfortably 60 FPS.

### Update 2 — accessible appliances + realism pass
- **Click any appliance** (in the 3D scene or the right-hand Appliances list) →
  a control card opens with live state and the controls for that device type
  (on/off, start/pause/stop, mode, brightness / power / temperature sliders).
  Selecting from the list flies the camera to it (lifts the roof for indoor
  devices). Files: `src/state/uiStore.ts`, `src/components/DeviceCard.tsx`,
  `src/components/DeviceList.tsx`, selection handlers in `DeviceLayer.tsx`.
- **Provençal look**: procedural stucco / terracotta-pantile / gravel / limestone
  textures (`src/three/textures.ts`), louvered shutters, génoise tile courses
  under the eaves, wrought-iron juliet balcony, geranium window boxes, a wall
  lantern, stone boundary wall with pillars + gate, Mediterranean cypress + olive
  trees, lavender borders, clipped bays in terracotta pots, gravel forecourt,
  flagstone path, warm golden-hour lighting.

---

## Task-by-task

### Week 1 — House
| Task | Status | Where |
|---|---|---|
| 1.1 House exterior (2-storey, pitched roof, 8+ windows, front door, garage, ~15×10 m) | ✅ | `src/three/models/House.tsx` |
| 1.2 Interior layout (kitchen, living, bedroom, bathroom, garage + utility) — dollhouse roof toggle | ✅ | `src/three/models/Interior.tsx` |
| 1.3 Device placement zones + coordinates shared | ✅ | `src/three/layout.ts` → `DEVICE_PLACEMENTS` (exported); magenta wireframe markers in dollhouse view |

### Week 2 — Car + EV charger
| Task | Status | Where |
|---|---|---|
| 2.1 Car in driveway (compact hatchback, correct scale, nose to street) | ✅ | `src/three/models/Car.tsx` |
| 2.2 EV charger station (Type-2 wall-box, screen, holster, coil) | ✅ | `src/three/models/EVCharger.tsx` |
| 2.3 Cable connect/retract animation (Catmull-Rom curve, ~1 s, react-spring) | ✅ | `EVCharger.tsx` — driven by `connected` prop |
| 2.4 Charging indicator on car (SOC bar + blue/gold glow, gold while tapering) | ✅ | `Car.tsx` |

### Week 3 — Lighting + camera
| Task | Status | Where |
|---|---|---|
| 3.1 Lighting (ambient + sun + hemisphere, shadows on all objects) | ✅ | `src/three/Scene.tsx` |
| 3.2 Orbit controls (rotate / zoom / pan, min-distance, no under-ground) | ✅ | `Scene.tsx` `<OrbitControls>` |
| 3.3 Camera presets (Front / Overview / Garage-EV / Kitchen / Rear / Dollhouse) + smooth tween | ✅ | `src/components/CameraPresets.tsx`, `src/three/CameraRig.tsx` |
| 3.4 Ground plane + driveway + path + street | ✅ | `src/three/models/Ground.tsx` |

### Week 4 — Polish
| Task | Status | Where |
|---|---|---|
| 4.1 Sky (drei `<Sky>` day / procedural `<Stars>` night) | ✅ | `Scene.tsx` |
| 4.2 Trees / landscaping (low-poly) | ✅ | `src/three/models/Landscaping.tsx` |
| 4.3 Performance (primitives only, `dpr=[1,2]`, geometry reused, tube rebuilt only while animating) | ✅ | throughout |
| 4.4 Mobile (R3F touch works; `touch-action:none`) | ⚠️ partial | not device-tested |

### Stretch
- Day/night toggle ✅ (`CameraPresets`)
- Dollhouse (removable roof) ✅
- Interior furniture ❌ (not attempted)

---

## Decision A compliance ✅
`src/three/components/DeviceGlow.tsx` has **no alert input** — glow is a pure
function of `operationalState`. The alert banner is the only thing that reacts to
overload. Self-test steps in `frontend/README.md`.

---

## Device placements (canonical — source of truth is `src/three/layout.ts`)

| Device | id | Room | Position [x, y, z] |
|---|---|---|---|
| EV charger | `evse_01` | Garage exterior wall | `[2.9, 1.25, 5.15]` |
| Living-room light | `light_01` | Living room ceiling | `[-3.6, 2.7, 2.4]` |
| Dishwasher | `dishwasher_01` | Kitchen | `[-6.6, 0.55, -3.7]` |
| Washing machine | `washing_machine_01` | Utility | `[1.4, 0.55, -3.8]` |
| Water heater | `water_heater_01` | Utility | `[2.9, 0.95, -3.9]` |
| Heat pump | `heat_pump_01` | Outside (rear) | `[-3.2, 0.45, -6.4]` |
| CCTV | `cctv_01` | Outside (front corner) | `[-7.1, 5.3, 4.7]` |
| Microwave | `microwave_01` | Kitchen | `[-2.4, 1.35, -4.5]` |
| Refrigerator | `refrigerator_01` | Kitchen | `[-6.8, 1.0, -1.1]` |

World axes: +X right, +Y up, +Z toward the street. Origin = centre of ground slab.

---

## Known gaps / follow-ups
- Appliance meshes in `DeviceLayer.tsx` are deliberately simple placeholders —
  swap for real models when available (positions/glow stay as-is).
- `DeviceCard` is a working control card (real API calls) that Shruti can
  restyle or replace with the official HUD cards — the selection plumbing
  (`uiStore`, click handlers, camera focus) stays.
- No GLB house/car model (used primitives). Fine for the demo; revisit if a
  higher-fidelity look is needed.
- Mobile not tested on a real device.
- `DevPanel` + `AlertBanner` are scaffolding for Shruti's real control UI —
  delete once hers lands.
- Not wired into a shared git repo yet (this machine has no clone of the team
  repo — the docs reference a Windows path). Drop `frontend/` into the repo at
  `Code/frontend` or merge with the existing scaffold.
