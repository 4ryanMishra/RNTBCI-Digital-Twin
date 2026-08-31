# RNTBCI Digital Twin — Device Visuals Mapping
**Audience:** Frontend (Three.js / React Three Fiber)
**Last updated:** 2026-08-30
**Read alongside:** MASTER_SPEC.md Part 7, SYNC.md, openapi.yaml

This document defines exactly what every device looks like and how it reacts
to every WebSocket event and control action. Agree on this before building —
changes after scene assets are created are expensive.

---

## ⚠️  Decision A — Read This First

**This system is alert-only. No device is ever automatically shut off,
throttled, or dimmed by the system in response to overload.**

This has a direct consequence for every overload-state visual you design:

- ✅ Overload = a **warning indicator ON THE CIRCUIT PANEL** (HUD overlay, amber/red
  arc on the power gauge, flashing breaker icon). The devices themselves keep
  glowing normally — they are still running.
- ❌ Do NOT animate any device powering down, fading out, or going dark in response
  to an `alert` event. That would visually imply the system disconnected it, which
  it did not and cannot do.
- ❌ Do NOT show a "system throttled" or "auto-adjusted" label anywhere.

The only thing that turns a device off is a **human clicking the control** in the
UI, which fires a `POST .../control { "action": "stop" }` and comes back as a
`state_change` event. That is the only moment a device should animate off.

---

## Global conventions

| Visual element | Meaning |
|---|---|
| **Emissive glow — active colour** | Device is `on` or `running` — consuming power |
| **Emissive glow off / dark material** | Device is `off` or `idle` |
| **Amber glow pulse** | System `warning` alert (80–95% load) — on circuit panel only |
| **Red glow pulse** | System `critical` alert (≥95% load) — on circuit panel only |
| **Fault indicator (small red dot)** | Device in `fault` operational state |
| **Setup-incomplete overlay** | Full-screen prompt before villa tier is selected |

Glow colours per device type (emissive, not diffuse):

| Device | Active colour | Notes |
|---|---|---|
| EVSE | `#00BFFF` (electric blue) | Shifts to `#FFD700` (gold) while tapering |
| Light | `#FFF5C0` (warm white) | Dims proportionally to Matter level value |
| Dishwasher | `#4FC3F7` (cyan-blue) | |
| Washing machine | `#4FC3F7` | Same family as dishwasher |
| Water heater | `#FF7043` (warm orange) | Heat-associated |
| Heat pump | `#42A5F5` (cool blue) | Shifts to `#FF7043` when mode = Heat |
| CCTV | `#B0BEC5` (grey-white) | Always lit — never dark |
| Microwave | `#CE93D8` (soft purple) | |
| Refrigerator | `#80CBC4` (teal) | Compressor-off phase dims slightly (not off) |

---

## Per-device specification

---

### 1. EVSE (EV Charger)
**Device ID:** `evse_01`
**Matter type:** EVSE / Energy Management
**Power behaviour:** flat 7000 W until SOC 80%, then linear taper to 0 W at 100%

#### States
| `operational_state` | Visual |
|---|---|
| `off` | Cable hangs loose, socket unlit, no glow |
| `running` | Cable plugged-in animation (play once on transition), `#00BFFF` glow on socket and cable, SOC arc fills |
| `fault` | Red fault dot on unit body |

#### WebSocket events → animations

**`state_change`**
- `off → running`: play cable-connect animation (~0.5 s), then sustain glow + SOC arc
- `running → off`: play cable-disconnect animation (~0.5 s), glow off, SOC arc freezes

**`soc_taper_update`** *(fires once at boundary crossing — not every tick)*
- `enteredTaper: true` — glow colour shifts from `#00BFFF` to `#FFD700` over 1 s.
  A small "tapering" badge appears on the HUD card for this device.
  The cable does NOT change — this is the battery's own BMS behaviour, not a
  household-load action. Do not imply the system caused it.
- `enteredTaper: false` (new session started) — colour shifts back to `#00BFFF`

**`power_reading`** *(every 2 s)*
- SOC arc on the device updates to `data.perDevice[evse_01].watts` relative to rated 7000 W
- The global power gauge in the HUD also updates

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Start charging | "Plug in" button or click on cable | `{ "action": "start" }` |
| Stop charging | "Unplug" button | `{ "action": "stop" }` |
| Set charge power | Slider (1400–7400 W, 100 W steps) | `{ "action": "start", "parameters": { "targetPowerWatts": 3500 } }` |

The slider range 1400–7400 W maps to a French Type 2 socket: 6 A min (1380 W) to ~32 A max (7360 W). Round to nearest 100 W for display.

---

### 2. Light
**Device ID:** `light_01`
**Matter type:** OnOff Plug-in Unit (the load, not the switch)
**Power behaviour:** flat 15 W while on, 0 W off

#### States
| `operational_state` | Visual |
|---|---|
| `off` | Bulb dark, no glow, lamp shade neutral grey |
| `on` | Bulb emits `#FFF5C0`, intensity scales with `LevelControl.CurrentLevel` (0–254) |

#### WebSocket events → animations
**`state_change`**
- `off → on`: bulb glow fade-in over 0.3 s
- `on → off`: bulb glow fade-out over 0.2 s
- Level change (same state, different level): glow intensity lerps over 0.15 s

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Toggle on/off | Click bulb or toggle switch in HUD | `{ "action": "on" }` / `{ "action": "off" }` |
| Brightness | Slider (0–254) | `{ "action": "set_level", "parameters": { "level": 128 } }` |

Level 0 turns the light off. Level 254 = full brightness.

---

### 3. Dishwasher
**Device ID:** `dishwasher_01`
**Matter type:** Generic Appliance
**Power behaviour:** flat 1500 W while `running`, 0 W otherwise

#### States
| `operational_state` | Visual |
|---|---|
| `off` | Door closed, dark, no glow |
| `running` | Door-window emits `#4FC3F7`, subtle steam particle loop on top |
| `idle` (paused) | Glow dims to 30% intensity, steam stops |

#### WebSocket events → animations
**`state_change`**
- `off → running`: glow fade-in 0.4 s, start steam loop
- `running → idle`: glow dims, steam fades
- `idle → running`: glow restores, steam resumes
- `running/idle → off`: glow off, steam off

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Start | "Start" button, mode picker | `{ "action": "start", "parameters": { "mode": "Eco" } }` |
| Pause | "Pause" button | `{ "action": "pause" }` |
| Stop | "Cancel" button | `{ "action": "stop" }` |

Valid modes: `Normal` · `Eco` · `Intensive` · `Quick`
Show mode as a label on the HUD card — no separate animation per mode.

---

### 4. Washing Machine
**Device ID:** `washing_machine_01`
**Matter type:** Generic Appliance
**Power behaviour:** flat 2200 W while `running`, 0 W otherwise

#### States
| `operational_state` | Visual |
|---|---|
| `off` | Door closed, no glow, drum still |
| `running` | Door-window emits `#4FC3F7`, drum slow-rotation loop |
| `idle` (paused) | Drum stops, glow dims to 30% |

#### WebSocket events → animations
**`state_change`**
- `off → running`: glow fade-in 0.4 s, start drum rotation loop
- `running → idle`: drum stops, glow dims
- `idle → running`: drum restarts, glow restores
- any → `off`: glow off, drum stops

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Start | "Start" button, mode picker | `{ "action": "start", "parameters": { "mode": "Eco" } }` |
| Pause | "Pause" button | `{ "action": "pause" }` |
| Stop | "Cancel" button | `{ "action": "stop" }` |

Valid modes: `Normal` · `Eco` · `Quick` · `Delicate`

---

### 5. Water Heater
**Device ID:** `water_heater_01`
**Matter type:** Generic Appliance
**Power behaviour:** flat 2200 W while `running`, 0 W otherwise

#### States
| `operational_state` | Visual |
|---|---|
| `off` | Tank body neutral, no glow, indicator light off |
| `running` | Tank body emits `#FF7043` (warm orange), heating-coil glow visible through glass panel |

#### WebSocket events → animations
**`state_change`**
- `off → running`: orange glow fade-in 0.5 s
- `running → off`: glow fade-out 0.5 s

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Start | "Heat" button | `{ "action": "start" }` |
| Start with mode + temp | Mode picker + temp slider | `{ "action": "start", "parameters": { "mode": "Eco", "targetTemperatureCelsius": 50 } }` |
| Stop | "Off" button | `{ "action": "stop" }` |

Valid modes: `Normal` · `Eco` · `Boost`
Target temperature range: 40–75°C. Show as numeric input or slider.

---

### 6. Heat Pump
**Device ID:** `heat_pump_01`
**Matter type:** Generic Appliance
**Power behaviour:** flat 4000 W while `running`, 0 W otherwise

#### States
| `operational_state` | Visual |
|---|---|
| `off` | Unit body neutral, fan still, no glow |
| `running` (Heat mode) | Body emits `#FF7043`, fan slow rotation, warm-air shimmer effect |
| `running` (Cool mode) | Body emits `#42A5F5`, fan rotation, cold-air shimmer |
| `running` (Auto mode) | Body emits `#42A5F5` by default |

#### WebSocket events → animations
**`state_change`**
- `off → running`: glow fade-in 0.5 s, fan starts
- `running → off`: glow off, fan coasts to stop 1 s
- Mode change while running: glow colour lerps between heat/cool colours over 1 s

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Start with mode | Mode picker (Heat/Cool/Auto) | `{ "action": "start", "parameters": { "mode": "Cool" } }` |
| Start with temp | Mode + temp slider | `{ "action": "start", "parameters": { "mode": "Heat", "targetTemperatureCelsius": 21 } }` |
| Stop | "Off" button | `{ "action": "stop" }` |

Valid modes: `Heat` · `Cool` · `Auto`
Target temperature range: 16–30°C.

---

### 7. CCTV Camera
**Device ID:** `cctv_01`
**Matter type:** Camera
**Power behaviour:** flat 10 W **always** — never 0 W, never turns off

#### States
CCTV has no off state. It is always `running`. The only things that change
are the streaming and recording flags.

| Flags | Visual |
|---|---|
| `streaming: true` | Camera LED `#B0BEC5` solid, "LIVE" badge visible |
| `streaming: false` | Camera LED dim, "LIVE" badge hidden |
| `recording: true` | Small red recording-dot blinks (0.5 s on / 0.5 s off) |
| `recording: false` | Recording-dot off |

#### WebSocket events → animations
**`state_change`**
- streaming flag change: LED transitions solid ↔ dim over 0.2 s, badge fades
- recording flag change: blink starts or stops immediately

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Toggle streaming | Streaming toggle switch | `{ "action": "set_streaming", "parameters": { "streaming": false } }` |
| Toggle recording | Recording toggle switch | `{ "action": "set_recording", "parameters": { "recording": false } }` |

**Important:** there is no power-off button for CCTV in the UI. Hiding one is fine;
do not show a non-functional off button that suggests the camera can be de-powered.

---

### 8. Microwave Oven
**Device ID:** `microwave_01`
**Matter type:** Generic Appliance (schema ours)
**Power behaviour:** flat 1200 W while `running`, 0 W otherwise

#### States
| `operational_state` | Visual |
|---|---|
| `off` | Door closed, cavity dark, no glow |
| `running` | Interior cavity emits `#CE93D8` (soft purple), door-window glows, turntable rotation loop, countdown timer visible in HUD card |

#### WebSocket events → animations
**`state_change`**
- `off → running`: cavity glow fade-in 0.3 s, turntable starts, timer starts counting down from `MicrowaveOvenControl.CookTimerRemainingS`
- `running → off`: glow off, turntable stops, timer resets to 0

Timer note: the mock server does **not** tick `cook_time_seconds_remaining` down
automatically. The real server will. For now, display the value from the state
snapshot and update it on each `state_change` event.

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Start cook | Time picker + power slider + mode selector, then "Start" | `{ "action": "start", "parameters": { "mode": "Cook", "cookTimeSeconds": 120, "powerLevelPercent": 80 } }` |
| Stop | "Stop / Open door" button | `{ "action": "stop" }` |

Valid modes: `Cook` · `Defrost` · `Reheat`
Cook time: 1–3600 s. Power level: 10–100% (show as 10% increments).

---

### 9. Refrigerator
**Device ID:** `refrigerator_01`
**Matter type:** Generic Appliance (schema ours)
**Power behaviour:** duty-cycle — 150 W when compressor on, ~5 W when off

#### States
The refrigerator is always `running`. It has no `off` state. Power oscillates
between 150 W and 5 W on a 600 s on / 300 s off cycle.

| `compressor_on` | Visual |
|---|---|
| `true` | Body emits `#80CBC4` at full intensity, subtle hum vibration micro-animation |
| `false` | Body emits `#80CBC4` at ~30% intensity (dim, not off), no hum |

The brightness difference between compressor-on and compressor-off **must be
clearly visible** — this is the key physics proof the fridge section of the
demo is making (duty-cycle load contribution to household capacity).

#### WebSocket events → animations
**`duty_cycle_toggle`** *(the primary event for this device)*
- `compressorOn: true` → glow ramps up to full intensity over 0.3 s, hum micro-animation starts
- `compressorOn: false` → glow dims to 30% over 0.5 s, hum stops

Do NOT use `state_change` to drive the compressor animation — `duty_cycle_toggle`
is the correct event. `state_change` only fires on user-initiated mode/temp changes.

**`state_change`** (mode or temperature change)
- No animation change — mode label and temp reading update in HUD card only

#### Control actions → UI elements
| Action | UI element | What to send |
|---|---|---|
| Set mode | Mode picker | `{ "action": "set_mode", "parameters": { "mode": "Eco" } }` |
| Set target temperature | Temp slider (1–8°C) | `{ "action": "set_temperature", "parameters": { "targetTemperatureCelsius": 2 } }` |

Valid modes: `Normal` · `Eco` · `Rapid Cool`
There is no power-off button. The fridge is always on — do not show one.

---

## System-level visuals (circuit panel / HUD)

These live on the main circuit-breaker panel in the 3D scene, not on individual
device models.

### Power gauge
- Arc gauge showing total draw vs contracted limit
- Colour zones: `#4CAF50` (green, 0–79%), `#FFC107` (amber, 80–94%), `#F44336` (red, 95–100%)
- Updates on every `power_reading` WS event (every 2 s)
- Driven by `data.totalDrawWatts / data.limitWatts`

### Alert indicator *(Decision A — read carefully)*
Fires on `alert` WS event.

- **`severity: "warning"`** (80–95% load):
  - Amber pulse on circuit panel (2 Hz, 3 cycles then sustain)
  - Toast notification in HUD: "⚠ Load at [X]% — consider reducing manually"
  - **All device models stay fully lit.** No device dims or turns off.

- **`severity: "critical"`** (≥95% load):
  - Red pulse on circuit panel (4 Hz, sustained until load drops)
  - Toast notification: "🔴 Critical load [X kW] — manual action required"
  - **All device models stay fully lit.** No device dims or turns off.

Both severities are **observation states**, not control actions. The visual
language must not suggest the system has intervened. If in doubt: the
circuit panel reacts, the devices do not.

### Per-device HUD cards
Small info cards that appear on hover or tap of a 3D device model.
Each card shows:
- Device name + `operational_state` badge
- Current power in W (from latest `power_reading` per-device entry)
- Device-specific fields: SOC% for EVSE, compressor status for fridge, mode for appliances
- Control buttons (as described per device above)

---

## Device-add flow
When `POST /api/v1/devices/add` succeeds, the WS broadcasts a `device_added` event:
```json
{
  "event": "device_added",
  "timestamp": "...",
  "data": {
    "deviceId": "light_02",
    "deviceType": "light",
    "displayName": "Kitchen Light",
    "operationalState": "off",
    "powerWatts": 0.0
  }
}
```
On receiving this event:
- Spawn a new device model in the 3D scene at a default position for that device type
- Apply the standard off-state material immediately
- Open the device HUD card so the user can see the new device
- The scene position is determined by the frontend — the backend has no concept of 3D coordinates

---

## Setup flow
On WebSocket connect, if the system is not configured, `setup_incomplete` fires.

- Show a full-screen modal: "Select your villa configuration"
- Three buttons: Small (6 kVA / 30 A / Single-phase), Medium (9.2 kVA / 40 A / Single-phase), Large (18.4 kVA / ~26 A × 3 / Three-phase)
- On click: `POST /api/v1/system/setup { "tier": "medium" }`
- On success: WS fires `setup_complete`, modal dismisses, scene renders

Do not render the 3D scene or any device models until `setup_complete` has been received. Before that, nothing has a power limit to compare against and the power gauge would be meaningless.

---

## WebSocket event reference (quick summary)

| Event | Trigger | Frontend action |
|---|---|---|
| `setup_incomplete` | On connect, unconfigured | Show setup modal |
| `setup_complete` | After tier POST | Dismiss modal, render scene |
| `power_reading` | Every 2 s | Update power gauge + per-device HUD cards |
| `state_change` | User command applied | Update device glow state + HUD badge |
| `duty_cycle_toggle` | Fridge compressor flip | Animate fridge glow intensity |
| `soc_taper_update` | EVSE crosses 80% SOC | Shift EVSE glow colour, show taper badge |
| `alert` | Load at 80% or 95% | Flash circuit panel, show toast — devices stay lit |
| `device_added` | New device registered | Spawn device model in scene |
| `keepalive` | Every 30 s (no activity) | No action (ignore or log) |
| `pong` | Response to client ping | No action |
