# Phase 2 Complete - Device Abstraction Layer & Simulation Adapters

**Status:** Ready for review  
**Date:** 2026-08-30  
**Scope:** MASTER_SPEC.md Part 8, Step 2 - Device abstraction + simulation adapters

---

## What Was Built

### 1. Device Abstraction Interface (`device_interface.py`)

✅ **Common interface per MASTER_SPEC.md Part 2, Layer 1:**
- `get_state()` - Returns DeviceState with operational_state and power draw
- `get_power_draw()` - Returns instantaneous power in watts
- `apply_command()` - Apply control commands (start, stop, etc.)
- `tick()` - Advance simulation time (for simulation adapters)

✅ **DeviceState structure:**
- Uses correct operational_state values: `off`, `on`, `running`, `idle`, `fault`, `setup_incomplete`
- Includes device-specific metadata (SOC, compressor state, etc.)

### 2. Simulation Adapters (`simulation_adapter.py`)

✅ **Three adapter types matching power_behavior_type:**

#### FlatPowerDevice
- Used by: Light, Dishwasher, Washing Machine, Water Heater, Heat Pump, CCTV, Microwave
- Logic: rated_power_watts while running, 0W while off
- Binary states only (no in-between)

#### TaperDevice (EVSE - Decision D)
- **Flat power until taper_start_soc_pct (80%)**
- **Linear taper from rated_power_watts to 0W at 100% SOC**
- Formula: `power = rated_power × (100 - current_soc) / (100 - taper_start_soc)`
- SOC progression based on energy: `SOC_increase = (energy_kwh / battery_capacity_kwh) × 100`
- NOT a DC-fast-charge curve across the whole session

#### DutyCycleDevice (Refrigerator)
- Cycles between on_power_watts (150W) and idle_power_watts (5W)
- Time-based only: no temperature logic, no door-open pause
- Real-world timings stored: cycle_on_s=600s, cycle_off_s=300s
- Simulation compression: 10x (60s on / 30s off for demo)
- Compression is simulation-speed parameter, not device behavior change

### 3. Device Registry (`device_registry.py`)

✅ **All 9 devices from MASTER_SPEC.md Part 3:**

| Device | Type | Behavior | Power | Notes |
|--------|------|----------|-------|-------|
| evse_01 | EVSE | taper | 7000W | Taper starts at 80% SOC |
| light_01 | Light | flat | 15W | OnOff Plug-in Unit |
| dishwasher_01 | Dishwasher | flat | 1500W | Generic Appliance |
| washing_machine_01 | Washing Machine | flat | 2200W | Generic Appliance |
| water_heater_01 | Water Heater | flat | 2200W | Generic Appliance |
| heat_pump_01 | Heat Pump | flat | 4000W | Generic Appliance |
| cctv_01 | CCTV | flat | 10W | Always-on |
| microwave_01 | Microwave | flat | 1200W | On-full or off |
| refrigerator_01 | Refrigerator | duty_cycle | 150W/5W | 600s on / 300s off (real) |

### 4. Standalone Demo Script (`phase2_demo.py`)

✅ **Simulation parameters per your specification:**
- Tick rate: 1 second per tick (Decision B)
- Duration: ~30 minutes (enough for EVSE 78%→100% + 2+ fridge cycles)
- Initial states: All off except CCTV (running)
- EVSE starts at 78% SOC to demonstrate taper immediately

✅ **State changes during demo:**
- t=0s: EVSE starts charging (78% SOC), Refrigerator starts duty cycling
- t=300s (5min): Light turns on
- t=600s (10min): Dishwasher turns on
- Prints status every 60 seconds
- Shows device states, power draw, and metadata

### 5. Validation Script (`validate_power_math.py`)

✅ **Hand-calculated verification:**
- Flat power: 0W off, rated_power_watts running
- EVSE taper: validates formula at multiple SOC points (78%, 80%, 85%, 90%, 95%, 99%, 100%)
- Duty cycle: validates 60s on / 30s off timing transitions
- SOC progression: validates energy→SOC calculation

---

## Critical Physics Validations

### EVSE Taper (Decision D)

**Correct implementation:**
```
SOC Range     | Power Draw | Formula
78% - 79.9%   | 7000W      | Flat (before taper)
80%           | 7000W      | Taper boundary
85%           | 5250W      | 7000 × (100-85)/(100-80) = 7000 × 0.75
90%           | 3500W      | 7000 × (100-90)/(100-80) = 7000 × 0.50
95%           | 1750W      | 7000 × (100-95)/(100-80) = 7000 × 0.25
100%          | 0W         | Charging complete
```

**NOT doing (common mistake):**
- ❌ DC-fast-charge taper curve across whole session
- ❌ Exponential taper
- ❌ Arbitrary "safety margin" reductions

### Refrigerator Duty Cycle

**Correct implementation:**
```
Phase       | Duration (Real) | Duration (Compressed) | Power
Compressor ON  | 600s (10min)  | 60s                   | 150W
Compressor OFF | 300s (5min)   | 30s                   | 5W
Full Cycle     | 900s (15min)  | 90s                   | -
```

**Source of truth:** Real-world timings (600s/300s) stored in rated_power_config  
**Simulation speed:** 10x compression for demo visibility

### Flat Power Devices

**All use binary logic:**
- off → 0W
- on/running → full rated_power_watts
- No partial power states
- No dimming/brightness (Light)
- No mode-based variations (all devices use single power level)

---

## Operational State Values (Fixed from Phase 1)

✅ **All implementations use correct lowercase values:**
- `off` - Device powered off
- `on` - Powered but not operating
- `running` - Actively operating
- `idle` - Standby
- `fault` - Error state
- `setup_incomplete` - Not configured

❌ **NOT using (old incorrect values):**
- Stopped, Running, Paused, Error (PascalCase)

---

## File Structure

```
Code/
├── device_interface.py          ← Abstract interface (Layer 1)
├── simulation_adapter.py        ← 3 adapter implementations
│   ├── FlatPowerDevice         (7 devices)
│   ├── TaperDevice             (EVSE)
│   └── DutyCycleDevice         (Refrigerator)
├── device_registry.py           ← All 9 device configs
├── phase2_demo.py              ← Standalone simulation script
├── validate_power_math.py      ← Hand-calculated validation
└── PHASE_2_SUMMARY.md          ← This file
```

---

## Running Phase 2

### 1. Validation (Run First)
```bash
python validate_power_math.py
```

Expected output:
```
PHASE 2 POWER CALCULATION VALIDATION
=====================================

VALIDATING FLAT POWER DEVICES
✓ Off state: 0W (correct)
✓ Running state: 15W (correct)
✓ Stop command: returns to 0W (correct)

VALIDATING EVSE TAPER (Decision D)
✓ SOC 78.0%: 7000W (before taper)
✓ SOC 80.0%: 7000W (taper start)
✓ SOC 85.0%: 5250W (mid-taper)
✓ SOC 90.0%: 3500W (mid-taper)
✓ SOC 95.0%: 1750W (late taper)
✓ SOC 100.0%: 0W (full)

VALIDATING REFRIGERATOR DUTY CYCLE
✓ Compressor transitions at correct intervals
✓ Power levels correct (150W on / 5W off)

ALL VALIDATIONS PASSED ✓
```

### 2. Demo Simulation
```bash
python phase2_demo.py
```

**What to observe:**

1. **EVSE Power Progression:**
   - Starts at 7000W (78% SOC)
   - Remains at 7000W until 80% SOC
   - Linearly decreases from 80% to 100% SOC
   - Shows `[TAPERING]` marker when in taper zone

2. **Refrigerator Duty Cycle:**
   - Alternates: 150W for 60s, then 5W for 30s
   - Compressor state shown: "ON" or "OFF"
   - Completes multiple full cycles during demo

3. **Total Household Load:**
   - Starts: CCTV (10W) + EVSE (7000W) + Fridge (cycling) ≈ 7010-7160W
   - After t=300s: +Light (15W)
   - After t=600s: +Dishwasher (1500W)
   - Peak: ~8700W+ when all devices running

4. **State Changes:**
   - All transitions logged with timestamps
   - Device states printed every 60s
   - Metadata shown (SOC, compressor state, etc.)

---

## Key Design Decisions

### 1. Layer 1 Boundary (Per MASTER_SPEC.md Part 2)
- Interface allows swapping simulated ↔ real devices
- Zero changes to layers above when switching adapters
- Common DeviceState structure across all device types

### 2. No Database Dependencies (Phase 2 Scope)
- Device registry hardcoded for standalone testing
- Phase 3 will read from devices table
- Validates power math before integration

### 3. Simulation Compression (Refrigerator)
- Real-world timings (600s/300s) are source of truth
- Compression factor (10x) is simulation parameter
- Prevents 15-minute waits in demo while maintaining correct physics

### 4. Taper Physics (Decision D)
- Linear taper preserves energy accounting
- Formula based on SOC percentage remaining
- Matches real BMS behavior at end of charge

---

## Questions Answered (from clarification)

| Question | Answer | Implementation |
|----------|--------|----------------|
| EVSE taper_start_soc_pct? | 80% | Hardcoded in device_registry.py |
| EVSE taper curve? | Linear 7000W→0W | Formula in TaperDevice.get_power_draw() |
| EVSE starting SOC? | 78% for demo | Set via command in phase2_demo.py |
| Fridge cycle timings? | 600s on / 300s off | Real values in rated_power_config |
| Fridge demo timings? | 60s on / 30s off | 10x compression in simulation |
| Initial states? | All off except CCTV running | Set in Simulator._initialize_device_states() |
| Flat device off power? | 0W | FlatPowerDevice.get_power_draw() |
| Simulation duration? | ~30 minutes | phase2_demo.py loop condition |
| Tick rate? | 1 second | Simulator.tick_interval |

---

## What Was NOT Built (Out of Phase 2 Scope)

❌ **Digital twin core** - Phase 3  
❌ **Database integration** - Phase 3  
❌ **Live/history stores** - Phase 3  
❌ **Master agent** - Phase 4  
❌ **REST API** - Phase 5  
❌ **WebSocket** - Phase 5  
❌ **Application modules** - Phase 6  
❌ **3D frontend** - Phase 7

Per steering prompt: "Stop here for review."

---

## Verification Checklist

Before proceeding to Phase 3:

- [ ] Run `python validate_power_math.py` - all tests pass
- [ ] Run `python phase2_demo.py` - observe output
- [ ] Verify EVSE taper: flat until 80%, then linear decrease
- [ ] Verify refrigerator: 60s at 150W, 30s at 5W, repeating
- [ ] Verify flat devices: 0W off, rated_power_watts running
- [ ] Verify total load: sum of all active devices
- [ ] Confirm operational_state values: lowercase, includes setup_incomplete
- [ ] Review code: no hardcoded defaults, no silent assumptions

---

## Ready for Review

**Phase 2 Status: ✅ COMPLETE**

All 9 devices implemented with correct power behaviors:
- EVSE: Flat-then-taper per Decision D ✓
- Refrigerator: Time-based duty cycle ✓
- Others: Binary flat power ✓

Power calculations validated against hand-calculated values.

**Next step after approval:** Phase 3 - Digital twin core (live + history stores)

---

## Notes

- All power formulas documented and validated
- No silent assumptions or reasonable defaults used
- Steering prompt rule followed: "Stop and ask" for any ambiguity
- Standalone script allows eyeball verification before integration
- Ready to swap simulation adapters for real device adapters in future
