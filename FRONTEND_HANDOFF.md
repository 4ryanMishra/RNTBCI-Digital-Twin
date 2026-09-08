# RNTBCI Digital Twin — Frontend Handoff Package

**For**: Shruti (Main Frontend Dev) + Purva (3D Environment/House)  
**Date**: September 2026  
**Backend Status**: ✅ Complete (Phases 1-6)  
**Integration Status**: ✅ API tested and working

---

## Work Split

### Shruti: Core Functionality (Main Dev)
- Device controls (sliders, buttons, mode selectors)
- Power monitoring UI (circuit panel, gauge)
- WebSocket integration (live updates)
- Alerts system (Decision A enforcement)
- Export buttons (CSV/XLSX)
- Device animations (glow, particles)

### Purva: 3D Environment (Supporting Dev)
- House 3D model (French home exterior + interior)
- Car model (parked in driveway)
- EV charger station (wall-mounted or standalone)
- Scene lighting (ambient, shadows, day/night)
- Camera controls (orbit around house)
- Ground plane, landscaping, sky

**Goal**: Shruti focuses on making devices work correctly (especially Decision A). Purva makes it look like a real home.

---

## What You Get From Backend

### 1. Mock Server (No Database Required)
**File**: `mock_server.py` (already in `d:\Projects\RNTBCI(V)\Code\`)

**How to run**:
```powershell
cd "d:\Projects\RNTBCI(V)\Code"
.\venv\Scripts\activate
python mock_server.py
```

**What it gives you**:
- REST API on `http://localhost:8000/api/v1`
- WebSocket on `ws://localhost:8000/ws`
- Interactive docs: `http://localhost:8000/docs` (Swagger UI)
- **No database setup needed** — everything runs in-memory
- Stateful simulation (devices remember state between calls)

### 2. API Documentation
**File**: `d:\Projects\RNTBCI(V)\Info\openapi.yaml`

All endpoints with request/response examples. Key endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /health` | GET | Check if backend is running |
| `POST /system/setup` | POST | Initialize system (call once on app load) |
| `GET /devices` | GET | List all 9 devices |
| `POST /devices/{id}/control` | POST | Control a device (on/off, modes, power) |
| `GET /system/power-budget` | GET | Total power draw + per-device breakdown |
| `GET /modules/location` | GET | System setup info (tier, limit) |
| `GET /export/total-power` | GET | CSV export (total power history) |
| `GET /export/appliance-power` | GET | CSV export (per-device history) |
| `WS /ws` | WebSocket | Live events (power readings, alerts) |

### 3. Device Visuals Mapping
**File**: `d:\Projects\RNTBCI(V)\Code\DEVICE_VISUALS_MAPPING.md`

**Per-device specifications**:
- Glow colors (hex codes)
- Animation timing (fade-in/out durations)
- Particle effects (dishwasher steam, etc.)
- Control types (slider, button, mode selector)

**Example**:
- EVSE: `#00A8E8` blue glow, power slider 1400W–7400W
- Fridge: `#00CED1` teal glow, duty-cycle on/off pulsing
- Light: `#FFD700` warm yellow glow, simple on/off

### 4. Decision A Warning (CRITICAL)
**From DEVICE_VISUALS_MAPPING.md**:

> ⚠️ **Decision A: Alert-Only System**  
> This system **never** auto-throttles or disconnects devices.  
> Overload alerts are **informational only**.  
> All devices stay lit/glowing during alerts — no auto-dimming.

**What this means for UI**:
- When power exceeds limit → circuit panel pulses red
- Show alert toast: "⚠️ Overload: reduce consumption"
- **DO NOT** dim, fade, or turn off device models automatically
- User must manually turn off devices

---

## Technical Stack (Already Set Up)

Your teammate already initialized:
- **React 18** + TypeScript
- **Vite** (dev server)
- **Three.js** (3D rendering)
- **WebSocket client** (reconnect logic included)
- **Axios** (REST API calls)

**To run frontend**:
```powershell
cd "d:\Projects\RNTBCI(V)\Code\frontend"
npm install  # first time only
npm run dev  # → http://localhost:5173
```

---

## Frontend File Structure (Current)

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # REST API calls (Axios)
│   ├── hooks/
│   │   └── useWebSocket.ts    # WS hook (ping/pong, reconnect)
│   ├── config.ts              # API_BASE_URL, WS_URL
│   ├── components/            # Your React components here
│   ├── three/                 # Three.js models, scene setup
│   └── App.tsx                # Main component
├── package.json
└── vite.config.ts
```

**What exists**:
- ✅ API client skeleton
- ✅ WebSocket hook with auto-reconnect
- ✅ Config for backend URLs
- ✅ Basic Three.js setup (already rendering devices)

**What's missing** (your work):
- ❌ House 3D model (Purva)
- ❌ Car + EV charger models (Purva)
- ❌ Circuit panel UI (Shruti)
- ❌ Device control cards (Shruti)
- ❌ Alert system UI (Shruti)
- ❌ Export buttons (Shruti)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Three.js)                                │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   3D Scene   │    │  Control UI  │    │ Circuit Panel│ │
│  │  (Three.js)  │    │  (React)     │    │  (React)     │ │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘ │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                             │                               │
│                             ▼                               │
│                   ┌──────────────────┐                      │
│                   │  API Client      │                      │
│                   │  + WebSocket     │                      │
│                   └────────┬─────────┘                      │
└────────────────────────────┼──────────────────────────────┘
                             │ HTTP + WS
                             ▼
                   ┌──────────────────┐
                   │  Backend (Mock)  │
                   │  Port 8000       │
                   │                  │
                   │  • REST API      │
                   │  • WebSocket     │
                   │  • State storage │
                   └──────────────────┘
```

**Flow**:
1. User clicks device in 3D scene → fires React event
2. React calls `POST /devices/{id}/control` via API client
3. Backend updates state, returns new device state
4. Backend broadcasts `state_change` event via WebSocket
5. WebSocket hook receives event → updates React state
6. Three.js scene re-renders with new glow/animation

---

## All 9 Devices (What to Render)

| Device ID | Type | Always On? | Control Type | Visual |
|---|---|---|---|---|
| `evse_01` | EV Charger | No | Power slider (1400–7400W) | Wall/standalone unit, cable, blue glow |
| `light_01` | Light | No | On/Off button | Ceiling light, warm yellow glow |
| `dishwasher_01` | Dishwasher | No | Start/Stop + mode selector | Kitchen appliance, cyan glow, steam particles |
| `washing_machine_01` | Washing Machine | No | Start/Stop + mode selector | Laundry room, cyan glow, spin animation |
| `water_heater_01` | Water Heater | No | On/Off button | Basement/utility, orange-red glow |
| `heat_pump_01` | Heat Pump | No | On/Off button | Outdoor unit, cyan-blue glow |
| `cctv_01` | Security Camera | **YES** | None (always running) | Outdoor camera, grey-white glow |
| `microwave_01` | Microwave | No | Start/Stop + power selector | Kitchen, yellow-white glow when active |
| `refrigerator_01` | Refrigerator | **YES** | None (always running, duty-cycles) | Kitchen, teal glow, pulses during compressor cycle |

**Note**: CCTV and fridge are always on. User can't turn them off.

---

## WebSocket Events (Live Updates)

Your `useWebSocket.ts` should listen for these events:

### 1. `power_reading` (Every 2 seconds)
```json
{
  "event": "power_reading",
  "totalWatts": 3250.5,
  "limitWatts": 9200.0,
  "utilisationPct": 35.3,
  "perDevice": [
    {"deviceId": "evse_01", "watts": 3000.0},
    {"deviceId": "light_01", "watts": 15.0},
    ...
  ]
}
```
**Use for**: Updating circuit panel gauge in real-time.

### 2. `state_change` (After device control)
```json
{
  "event": "state_change",
  "deviceId": "light_01",
  "operationalState": "on",
  "powerWatts": 15.0
}
```
**Use for**: Triggering device glow animations.

### 3. `duty_cycle_toggle` (Fridge, washing machine)
```json
{
  "event": "duty_cycle_toggle",
  "deviceId": "refrigerator_01",
  "phaseActive": true,
  "powerWatts": 150.0
}
```
**Use for**: Pulsing fridge glow on/off (compressor cycling).

### 4. `soc_taper_update` (EVSE charging progress)
```json
{
  "event": "soc_taper_update",
  "deviceId": "evse_01",
  "socPct": 85.0,
  "chargingPowerWatts": 2800.0,
  "taperActive": true
}
```
**Use for**: Showing charging progress bar, reducing glow intensity as SOC → 100%.

### 5. `alert` (Overload warnings)
```json
{
  "event": "alert",
  "level": "critical",
  "message": "Power draw at 97% of limit",
  "totalWatts": 8924.0,
  "limitWatts": 9200.0
}
```
**Levels**: `warning` (80%+), `critical` (95%+)

**Use for**: 
- Show toast notification
- Pulse circuit panel red
- **DO NOT auto-turn-off devices** (Decision A)

---

## Example API Calls

### Setup (Call once on app load)
```typescript
// POST /system/setup
const setupResponse = await axios.post('http://localhost:8000/api/v1/system/setup', {
  tier: 'medium'  // 'low' (6kVA), 'medium' (9kVA), 'high' (12kVA)
});
// Returns: { success: true, limitWatts: 9200.0 }
```

### Get All Devices
```typescript
// GET /devices
const devicesResponse = await axios.get('http://localhost:8000/api/v1/devices');
// Returns: { devices: [ { deviceId: "evse_01", deviceType: "evse", operationalState: "off", powerWatts: 0.0 }, ... ] }
```

### Turn On Light
```typescript
// POST /devices/light_01/control
const controlResponse = await axios.post('http://localhost:8000/api/v1/devices/light_01/control', {
  action: 'on'
});
// Returns: full Matter envelope with device state
```

### Control EVSE (Adjust Power)
```typescript
// POST /devices/evse_01/control
const evseResponse = await axios.post('http://localhost:8000/api/v1/devices/evse_01/control', {
  action: 'set_power',
  params: { chargingPowerWatts: 5000 }  // 1400–7400W
});
```

### Start Dishwasher with Mode
```typescript
// POST /devices/dishwasher_01/control
const dishwasherResponse = await axios.post('http://localhost:8000/api/v1/devices/dishwasher_01/control', {
  action: 'set_mode',
  params: { mode: 'eco' }  // 'normal', 'eco', 'intensive'
});
```

### Get Power Budget
```typescript
// GET /system/power-budget
const budgetResponse = await axios.get('http://localhost:8000/api/v1/system/power-budget');
// Returns: { totalDrawWatts: 3250.5, limitWatts: 9200.0, utilisationPct: 35.3, status: "ok", perDevice: [...] }
```

### Export CSV
```typescript
// GET /export/total-power (returns CSV file)
window.location.href = 'http://localhost:8000/api/v1/export/total-power';

// GET /export/appliance-power (returns CSV file)
window.location.href = 'http://localhost:8000/api/v1/export/appliance-power';
```

---

## Decision A: Alert-Only Enforcement

**What you MUST implement** (Shruti):

### When alert event arrives:
1. ✅ **DO**: Show toast notification with alert message
2. ✅ **DO**: Pulse circuit panel border red (CSS animation)
3. ✅ **DO**: Play alert sound (optional)
4. ✅ **DO**: Keep all device models fully lit/glowing
5. ✅ **DO**: Allow user to manually turn off devices

### What you MUST NOT do:
1. ❌ **DON'T**: Automatically dim any device glow
2. ❌ **DON'T**: Automatically turn off any device
3. ❌ **DON'T**: Disable device controls during alert
4. ❌ **DON'T**: Show "System disconnected device X" message

**Why**: This system proves EV charger impact on home grid. Auto-throttling would invalidate the research. Alerts are advisory only.

---

## Testing Checklist (Shruti)

### Phase 1: Basic Connectivity
- [ ] Health check returns 200
- [ ] POST /system/setup succeeds
- [ ] GET /devices returns 9 devices
- [ ] WebSocket connects and stays connected

### Phase 2: Device Controls
- [ ] Turn light on → glows yellow
- [ ] Turn light off → glow fades out
- [ ] Adjust EVSE power slider → backend confirms new power
- [ ] Start dishwasher → cyan glow + steam particles
- [ ] Change dishwasher mode → mode selector updates

### Phase 3: Live Updates
- [ ] Power readings arrive every 2s via WebSocket
- [ ] Circuit panel gauge updates in real-time
- [ ] Turning on device → state_change event arrives immediately
- [ ] Fridge pulses on/off (duty_cycle_toggle events)

### Phase 4: Decision A (CRITICAL)
- [ ] Turn on EVSE at 7400W
- [ ] Turn on heat pump (3000W)
- [ ] Turn on water heater (2500W)
- [ ] Total: ~13kW → exceeds 9.2kW limit
- [ ] Alert toast appears ✅
- [ ] Circuit panel pulses red ✅
- [ ] **All devices stay fully lit** ✅
- [ ] Can still manually turn off devices ✅

### Phase 5: Export
- [ ] Click "Export Total Power" → CSV downloads
- [ ] Click "Export Per-Device Power" → CSV downloads
- [ ] CSV files contain timestamp + power columns

---

## 3D Environment Checklist (Purva)

### Phase 1: House Model
- [ ] French home exterior (2-story, pitched roof)
- [ ] Interior visible through cutaway or glass walls
- [ ] Kitchen, living room, bedroom, bathroom, garage
- [ ] Appliances placed in correct rooms

### Phase 2: Outdoor Elements
- [ ] Driveway (paved)
- [ ] Car model (parked in driveway, realistic)
- [ ] EV charger station (wall-mounted on house or standalone post)
- [ ] Cable connecting car to charger (visible when EVSE is "on")

### Phase 3: Scene Setup
- [ ] Ground plane (grass, pavement)
- [ ] Ambient lighting (day scene)
- [ ] Shadows enabled (all objects cast shadows)
- [ ] Camera orbit controls (mouse drag to rotate)
- [ ] Zoom in/out (mouse wheel)

### Phase 4: Polish
- [ ] Sky gradient or skybox
- [ ] Trees/landscaping (optional, low-poly)
- [ ] Smooth camera animations
- [ ] No flickering or Z-fighting

---

## Work Coordination

### Shruti's Priority Order:
1. **Week 1**: Device controls + WebSocket integration
2. **Week 2**: Circuit panel UI + power gauge
3. **Week 3**: Alert system (Decision A enforcement)
4. **Week 4**: Export buttons + polish

### Purva's Priority Order:
1. **Week 1**: House exterior + interior layout
2. **Week 2**: Car + EV charger models
3. **Week 3**: Lighting + camera controls
4. **Week 4**: Scene polish (landscaping, sky)

### Integration Points:
- **After Purva Week 1**: Shruti can place device models inside house rooms
- **After Purva Week 2**: Shruti can connect EVSE glow to charger model
- **After Shruti Week 3**: Purva can test alerts while interacting with scene

---

## Communication Protocol

### Daily Standup (5 min):
- What you finished yesterday
- What you're working on today
- Any blockers (backend API issues, missing models, etc.)

### Sync Points:
- **After Shruti implements device control**: Test with Purva's house model
- **After Purva adds car**: Test EVSE glow on charger
- **Before Decision A test**: Both review DEVICE_VISUALS_MAPPING.md together

### Questions → Backend Dev (You):
- API not returning expected data
- WebSocket events missing or malformed
- Need new endpoint or field
- Performance issues (lag, memory leaks)

---

## Files You Already Have

In `d:\Projects\RNTBCI(V)\Code\`:
- ✅ `mock_server.py` — Backend mock server
- ✅ `DEVICE_VISUALS_MAPPING.md` — Visual specs for all 9 devices
- ✅ `INTEGRATION_TEST_PLAN.md` — Full test checklist
- ✅ `openapi.yaml` — API documentation (in Info/ folder)

In `d:\Projects\RNTBCI(V)\Code\frontend\`:
- ✅ `src/api/client.ts` — REST API calls
- ✅ `src/hooks/useWebSocket.ts` — WebSocket hook
- ✅ `src/config.ts` — Backend URLs
- ✅ `package.json` — Dependencies (React, Three.js, Axios)

---

## Quick Start Commands

### Backend (Mock Server)
```powershell
cd "d:\Projects\RNTBCI(V)\Code"
.\venv\Scripts\activate
python mock_server.py
# → http://localhost:8000
# → Swagger docs: http://localhost:8000/docs
```

### Frontend (Vite Dev Server)
```powershell
cd "d:\Projects\RNTBCI(V)\Code\frontend"
npm install        # first time only
npm run dev        # → http://localhost:5173
```

### Test API
Open browser: `http://localhost:8000/docs` (interactive Swagger UI)

---

## Success Criteria

### Minimum Viable Product (MVP):
- ✅ All 9 devices render in 3D scene (inside house)
- ✅ Can control each device (on/off, modes, sliders)
- ✅ Circuit panel shows real-time power consumption
- ✅ Overload alerts appear (Decision A: devices stay on)
- ✅ Export buttons download CSV files
- ✅ House + car + EV charger visible in scene

### Stretch Goals:
- 🎯 Day/night cycle (time-based lighting)
- 🎯 Mobile responsive (touch controls)
- 🎯 Device usage history chart (recharts library)
- 🎯 Sound effects (device hum, alert beep)
- 🎯 Animated car charging indicator (progress bar on car)

---

## Deployment (After Testing)

### Backend:
- Deploy `api_server.py` (real DB version) to VM (AWS EC2, DigitalOcean)
- Use PostgreSQL database (not mock)
- Set up HTTPS (Let's Encrypt)

### Frontend:
- Deploy to Vercel (free, instant)
- Update `src/config.ts` with production backend URL
- `npm run build` → deploy `dist/` folder

---

## Contact for Issues

**Backend Dev (You)**: [Your contact]  
**For Shruti**: API issues, WebSocket problems, missing endpoints  
**For Purva**: Model loading issues, performance optimization, scene setup

---

## Final Notes

**For Shruti**:
- Focus on getting device controls working first (Phase 2)
- Decision A is the most critical test — don't skip it
- If backend returns unexpected data, check `mock_server.py` or ask

**For Purva**:
- Use low-poly models (< 10k triangles per object) for performance
- Test on Shruti's machine to ensure FPS > 45
- GLTF/GLB format preferred for Three.js

**Both**:
- Commit often to Git
- Test integration at each milestone
- Document any bugs you find in backend API

Good luck! 🚀
