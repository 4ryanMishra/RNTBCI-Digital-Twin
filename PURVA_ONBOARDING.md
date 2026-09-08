# Welcome to RNTBCI Digital Twin — Purva's Onboarding

**Welcome Purva!** 🎉

You're joining a French home energy management research project. This doc gives you the context you need before starting your 3D work.

---

## 🎯 Project Goal (The Big Picture)

### What We're Building:
A **3D digital twin** of a French home that proves **electric vehicle (EV) chargers can overload home circuits**.

### Why It Matters:
- France has strict home power limits (6-12 kVA)
- Adding an EV charger (7.4kW) can push a home over its limit
- This causes circuit breaker trips or fires
- Our system **alerts homeowners** before overload happens

### Your Role:
Make the digital twin **look like a real French home** so researchers and policymakers take it seriously.

---

## 🏠 What You're Building (3D Environment)

You're responsible for the **visual environment**:
1. **French home** (2-story, exterior + interior)
2. **Car** parked in driveway (modern French sedan)
3. **EV charger station** (wall-mounted, cable connects to car)
4. **Scene lighting** (day scene, realistic shadows)
5. **Camera controls** (orbit around house, zoom to details)
6. **Ground + landscaping** (grass, driveway, sky)

**NOT your responsibility**:
- Device controls (Shruti handles this)
- Power monitoring UI (Shruti)
- Alerts system (Shruti)
- Backend API (already complete)

---

## ⚠️ CRITICAL RULE: Decision A (You Must Know This!)

### The Rule:
**This system NEVER automatically turns off or throttles devices.**

### Why This Matters to You:
When power exceeds the limit:
- ✅ Alert appears (Shruti's work)
- ✅ Circuit panel pulses red (Shruti's work)
- ✅ **All device 3D models stay fully lit** ← YOUR responsibility

### What You Must NOT Do:
- ❌ Automatically dim device glow during alerts
- ❌ Automatically fade out device models
- ❌ Make devices "turn off" visually without user clicking them
- ❌ Reduce opacity/brightness when alert fires

### Why This Rule Exists:
The research proves EV charger **impact** on home grid. If the system auto-throttles, it defeats the research purpose. Alerts are **informational only** — the human decides what to turn off.

### Your Implementation:
When you receive device state from Shruti's code:
```typescript
// Correct ✅
{isOn && <DeviceGlow intensity={1.0} />}

// Wrong ❌ — Don't do this!
{isOn && !alertActive && <DeviceGlow intensity={1.0} />}
{isOn && alertActive && <DeviceGlow intensity={0.3} />}  // NO!
```

**Always show full glow if device state is "on"**, regardless of alerts.

---

## 🇫🇷 French Home Context

### Typical French Home Layout:
- **Ground floor**: Kitchen (back), living room (front), garage (side)
- **Upper floor**: 2-3 bedrooms, bathroom
- **Exterior**: Pitched roof, shuttered windows, stucco/brick walls
- **Driveway**: Paved, leads from street to garage

### Style Reference:
- Traditional French suburban home (not Parisian apartment)
- Think: Provence, Lyon suburbs, small-town France
- Colors: Cream/beige walls, terracotta/slate roof, blue/green shutters

### Scale:
- House footprint: ~15m × 10m
- 2 stories: ~8m tall total
- Car: ~4.5m long × 1.8m wide
- Driveway: ~5m wide × 15m long

---

## 📦 What You're Given (Already Complete)

### 1. Backend API (Mock Server)
**File**: `mock_server.py`

- All device data available via REST API
- You don't need to understand it deeply
- Shruti handles all API calls
- You'll receive device state as React props

### 2. Device Specifications
**File**: `DEVICE_VISUALS_MAPPING.md`

Contains:
- Glow colors for each device (hex codes)
- Device positions in house (coordinates)
- Animation timing (fade-in/out durations)

**Example**:
- EVSE (EV charger): Blue glow `#00A8E8`
- Refrigerator: Teal glow `#00CED1`, position in kitchen
- Light: Yellow glow `#FFD700`, position in living room ceiling

### 3. Frontend Starter Code
**Directory**: `frontend/`

- React + TypeScript + Vite already set up
- Three.js installed
- Some devices already rendering (basic models)
- You'll improve/replace these with better visuals

### 4. Your Task List
**File**: `PURVA_TASKS.md`

Week-by-week breakdown:
- Week 1: House model
- Week 2: Car + EV charger
- Week 3: Lighting + camera
- Week 4: Polish

---

## 🔄 How You Work With Shruti

### What Shruti Gives You:
- Device states (on/off, power level, charging progress)
- Trigger signals (EVSE turned on → connect cable)
- React component structure

### What You Give Shruti:
- Device position coordinates (where to place controls)
- 3D models (house, car, charger)
- Animation triggers (props she'll pass to your components)

### Example Integration:
```typescript
// Shruti's component (controls + state)
const [evseOn, setEvseOn] = useState(false);
const [chargingPower, setChargingPower] = useState(0);

// Your component (visuals)
<EVCharger 
  isOn={evseOn} 
  power={chargingPower}
  cableConnected={evseOn}
/>

// Inside your EVCharger.tsx:
function EVCharger({ isOn, power, cableConnected }) {
  return (
    <group>
      {/* Charger box with glow if on */}
      {isOn && <pointLight color="#00A8E8" intensity={2} />}
      
      {/* Cable animation */}
      {cableConnected && <CableToCar />}
    </group>
  );
}
```

---

## 📊 All 9 Devices (Where They Go)

You'll place these in the house:

| Device | Location | Always On? | Visual |
|---|---|---|---|
| **EVSE** | Garage wall or driveway post | No | Wall unit + cable to car |
| **Light** | Living room ceiling | No | Ceiling fixture, yellow glow |
| **Dishwasher** | Kitchen counter | No | Built-in appliance, cyan glow |
| **Washing Machine** | Laundry/utility room | No | Front-load washer, cyan glow |
| **Water Heater** | Basement/utility closet | No | Tank unit, orange-red glow |
| **Heat Pump** | Outside (back of house) | No | Outdoor unit, blue glow |
| **CCTV** | Outside corner (roof level) | **YES** | Security camera, grey glow |
| **Microwave** | Kitchen counter | No | Countertop unit, yellow-white glow |
| **Refrigerator** | Kitchen wall | **YES** | Tall unit, teal glow, pulses |

**Note**: CCTV and fridge are always on (user can't turn off). They'll always glow in your scene.

---

## 🎨 Visual Guidelines

### Device Glows (When On):
- Use `PointLight` or `SpotLight` in Three.js
- Match colors from DEVICE_VISUALS_MAPPING.md
- Intensity: 1.5-2.5 (bright enough to see, not blinding)
- Distance: 2-3 meters

### Animations:
- **Glow fade-in**: 0.3 seconds (smooth)
- **Glow fade-out**: 0.3 seconds
- **Cable extend**: 1.0 second (ease-in-out)
- **Fridge pulse**: 2.0 second cycle (on 10 min, off 5 min)

### Performance Target:
- **55-60 FPS sustained** on Shruti's machine
- Total polygons: < 100k
- Texture size: max 2048×2048
- Use instanced meshes for repeated objects (windows, etc.)

---

## 🚨 Rules You Must Follow

### 1. Decision A (Most Important)
- ✅ Devices stay fully lit when state is "on"
- ❌ Never auto-dim during alerts

### 2. Device Placement
- ✅ Use positions from DEVICE_VISUALS_MAPPING.md
- ✅ Coordinate with Shruti if you change positions
- ❌ Don't move devices without updating the mapping doc

### 3. Performance
- ✅ Keep FPS above 55
- ✅ Test on Shruti's machine before finalizing
- ❌ Don't add high-poly models (> 50k triangles)

### 4. Integration
- ✅ Accept device state as React props (don't fetch API yourself)
- ✅ Export position coordinates for Shruti's UI
- ❌ Don't implement device controls (Shruti's job)

### 5. Realism
- ✅ Make it look like a real home (not abstract/sci-fi)
- ✅ French architectural style
- ❌ Don't make it look like a game or cartoon

---

## 📚 Resources for You

### Free 3D Models:
- **Sketchfab**: https://sketchfab.com (search "French house", "car")
- **Poly Pizza**: https://poly.pizza (CC0 models)
- **TurboSquid Free**: https://turbosquid.com/Search/3D-Models/free
- **Quaternius**: http://quaternius.com (low-poly models)

### Textures:
- **Poly Haven**: https://polyhaven.com/textures (PBR textures)
- **CC0 Textures**: https://cc0textures.com

### Learning:
- **React Three Fiber docs**: https://docs.pmnd.rs/react-three-fiber
- **Three.js docs**: https://threejs.org/docs/
- **Blender tutorials**: YouTube (Blender Guru)

---

## 🗓️ Your 4-Week Plan

### Week 1: House Foundation
**Goal**: House renders, rooms identifiable

**Tasks**:
1. Create/import house exterior model
2. Add interior layout (cutaway or transparent walls)
3. Mark device placement zones
4. Share coordinates with Shruti

**Deliverable**: House model in scene, Shruti can place device controls

---

### Week 2: Car + Charger
**Goal**: Car parked, charger connected

**Tasks**:
1. Add car model to driveway
2. Build EV charger station model
3. Implement cable animation (coiled → extended)
4. Add charging indicator on car (glow/progress bar)

**Deliverable**: Charger cable connects to car when Shruti's EVSE turns on

---

### Week 3: Lighting + Camera
**Goal**: Scene looks realistic, easy to navigate

**Tasks**:
1. Set up day lighting (sun, ambient, hemisphere)
2. Enable shadows on all objects
3. Add orbit camera controls (mouse drag/zoom)
4. Create ground plane + driveway
5. Optional: Camera preset buttons

**Deliverable**: Can orbit house, shadows render, lighting realistic

---

### Week 4: Polish
**Goal**: Production-ready visuals

**Tasks**:
1. Add sky (gradient or sky dome)
2. Optional: Add 2-3 trees for landscaping
3. Optimize performance (instances, LOD, texture compression)
4. Test on Shruti's machine (FPS check)
5. Final visual polish

**Deliverable**: Scene looks professional, 55+ FPS, ready for demo

---

## 🧪 Testing Checklist (Your Responsibility)

### Visual Quality:
- [ ] House looks like a real French home (not gray boxes)
- [ ] Car looks realistic (not placeholder)
- [ ] EV charger recognizable as charger
- [ ] Shadows render correctly
- [ ] Sky has color/gradient (not black void)

### Animations:
- [ ] Device glows fade in/out smoothly (0.3s)
- [ ] Cable extends to car when EVSE turns on
- [ ] Cable retracts when EVSE turns off
- [ ] Fridge glow pulses during duty cycles

### Performance:
- [ ] 55-60 FPS sustained (check DevTools Performance tab)
- [ ] No memory leaks (check Memory tab after 5 min)
- [ ] Smooth camera movements (no stuttering)

### Integration:
- [ ] Device positions match DEVICE_VISUALS_MAPPING.md
- [ ] Shruti can pass device state as props
- [ ] Your components accept isOn/power/mode props
- [ ] No direct API calls in your components

### Decision A Compliance:
- [ ] **All devices stay fully lit when "on"** (regardless of alerts)
- [ ] No auto-dimming logic in your code
- [ ] Glow intensity doesn't change based on alert state

---

## ❓ When to Ask Questions

### Ask Shruti:
- "What device state data will you pass as props?"
- "Can we sync on device positions?"
- "Is the cable animation syncing with your EVSE state?"

### Ask Backend Dev (Project Lead):
- "Performance issues — is backend sending too much data?"
- "Need 3D coordinate reference from specs?"
- "Can we optimize WebSocket traffic?"

### Ask Both (Team Sync):
- "Ready to test integration (my 3D + your controls)?"
- "Decision A test — should I be present?"
- "Camera angle suggestions for device close-ups?"

---

## 🎯 Success Criteria (How You Know You're Done)

By end of 4 weeks:

### Minimum Requirements:
- ✅ House model renders in scene
- ✅ All 9 devices have placement markers
- ✅ Car parked in driveway
- ✅ EV charger with cable animation
- ✅ Realistic lighting + shadows
- ✅ Camera controls working
- ✅ **55+ FPS sustained**
- ✅ **Decision A compliant** (devices stay lit)

### Stretch Goals (If Time):
- 🎯 Day/night toggle
- 🎯 Landscaping (trees, garden)
- 🎯 Interior furniture (tables, chairs)
- 🎯 Animated car charging progress bar

---

## 📝 Important Files You Need

**Read these first**:
1. ✅ **PURVA_TASKS.md** ← Your detailed week-by-week tasks
2. ✅ **FRONTEND_HANDOFF.md** ← Project overview
3. ✅ **DEVICE_VISUALS_MAPPING.md** ← Device colors, positions, animations

**Reference later**:
4. **INTEGRATION_TEST_PLAN.md** ← How we test everything together
5. **openapi.yaml** ← API spec (you probably won't need this)

---

## 🚀 Quick Start (First Day)

### 1. Pull Code from GitHub
```bash
cd "d:\Projects\RNTBCI(V)\Code"
git pull origin main
```

### 2. Read These Docs (30 min)
- This file (PURVA_ONBOARDING.md)
- PURVA_TASKS.md (your task list)
- DEVICE_VISUALS_MAPPING.md (visual specs)

### 3. Run Frontend (5 min)
```powershell
cd "d:\Projects\RNTBCI(V)\Code\frontend"
npm install  # if not done yet
npm run dev  # → http://localhost:5173
```

### 4. Explore Existing Code (30 min)
Look at:
- `src/three/Scene.tsx` — Main 3D scene
- `src/three/models/` — Existing device models (you'll improve these)
- `src/components/` — Shruti's control UI (reference only)

### 5. Plan Week 1 (15 min)
- Decide: Build house in Blender or use free model?
- Find reference images (French homes)
- Sketch room layout on paper

### 6. Sync with Shruti (15 min)
- Introduce yourself
- Confirm device position coordinates
- Agree on prop interface (what data she'll pass you)

---

## 🎉 Welcome Aboard!

You're here to make the digital twin **look professional**. Shruti handles the functionality — you handle the visual wow factor.

**Key takeaway**: Always remember Decision A. Devices stay lit when on, no exceptions.

If you have questions, ask! We're here to help.

Good luck! 🏡🚗⚡

---

## TL;DR (Quick Summary)

**What you're building**: 3D French home with car + EV charger  
**Timeline**: 4 weeks  
**Rule #1**: Decision A — devices stay fully lit when on (no auto-dimming during alerts)  
**Your tasks**: House model, car, charger, lighting, camera controls  
**Not your tasks**: Device controls, power UI, alerts (Shruti handles this)  
**Success**: 55+ FPS, looks like real home, integrates with Shruti's UI  

**Start here**:
1. Read PURVA_TASKS.md
2. Read DEVICE_VISUALS_MAPPING.md
3. Run `npm run dev` in `frontend/` folder
4. Build house model (Week 1)
