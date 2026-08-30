# Phase 2: Device Abstraction Layer - Quick Start

## Run Validation (Do This First)

Validates power calculations against hand-calculated expected values:

```bash
python validate_power_math.py
```

**Expected result:** All tests pass ✓

## Run Demo Simulation

Simulates all 9 devices over ~30 minutes with state changes:

```bash
python phase2_demo.py
```

**What you'll see:**
- Device states printed every 60 seconds
- EVSE charging from 78% → 100% SOC with taper
- Refrigerator duty cycling (150W on / 5W off)
- Light turns on at t=5min
- Dishwasher starts at t=10min
- Total household power load

## Key Things to Verify

### 1. EVSE Taper (Decision D - Critical)

**Expected behavior:**
```
SOC 78-79.9%: 7000W (flat, before taper)
SOC 80%:      7000W (taper boundary)
SOC 85%:      5250W (linear taper)
SOC 90%:      3500W
SOC 95%:      1750W
SOC 100%:     0W (complete)
```

Look for `[TAPERING]` marker when SOC ≥ 80%.

**NOT expected:**
- DC-fast-charge curve (would taper from start)
- Exponential taper
- Abrupt power drops

### 2. Refrigerator Duty Cycle (Critical)

**Expected behavior:**
```
Compressor ON:  150W for 60s
Compressor OFF: 5W for 30s
(Repeats indefinitely)
```

Look for "Compressor: ON/OFF" in output.

**Real-world timings:** 600s/300s (stored in config, compressed 10x for demo)

### 3. Flat Power Devices

**Expected behavior:**
```
Device         | Off | Running
---------------|-----|--------
Light          | 0W  | 15W
Dishwasher     | 0W  | 1500W
Washing Machine| 0W  | 2200W
Water Heater   | 0W  | 2200W
Heat Pump      | 0W  | 4000W
CCTV           | N/A | 10W (always running)
Microwave      | 0W  | 1200W
```

No in-between states. Binary on/off only.

### 4. Total Household Load

Should equal sum of all active devices at any moment:
- t=0-300s: CCTV (10W) + EVSE (~7000W) + Fridge (150W or 5W) ≈ 7160W or 7015W
- t=300-600s: + Light (15W) ≈ 7175W or 7030W
- t=600s+: + Dishwasher (1500W) ≈ 8675W or 8530W

## Files

| File | Purpose |
|------|---------|
| `device_interface.py` | Abstract interface (Layer 1) |
| `simulation_adapter.py` | 3 adapter types (flat, taper, duty_cycle) |
| `device_registry.py` | All 9 device configurations |
| `phase2_demo.py` | Standalone simulation script |
| `validate_power_math.py` | Hand-calculated validation |

## Operational States

All devices use lowercase states:
- `off` - Powered off (0W)
- `on` - Powered but not operating
- `running` - Actively operating
- `idle` - Standby
- `fault` - Error state
- `setup_incomplete` - Not configured

## Common Issues

### Validation Fails
- Check Python version (3.10+)
- Verify no modifications to adapter formulas
- Re-read PHASE_2_SUMMARY.md for expected values

### Demo Shows Wrong Power
- Check initial SOC (should be 78% for EVSE)
- Verify compression factor (10x for refrigerator)
- Confirm device registry values match MASTER_SPEC.md Part 3

### Taper Doesn't Look Right
- **Flat until 80% SOC, then linear taper** (Decision D)
- If taper starts earlier, check taper_start_soc_pct
- If taper is curved, formula is wrong

## Next Phase

After Phase 2 approval:
- **Phase 3:** Digital twin core (live + history stores)
- **Phase 4:** Master agent (alert-only overload detection)
- **Phase 5:** REST + WebSocket API
- **Phase 6:** Application modules
- **Phase 7:** 3D frontend

## Questions During Review?

Per steering prompt: Stop and ask if anything is unclear or doesn't match MASTER_SPEC.md.
