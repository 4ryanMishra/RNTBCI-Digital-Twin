# Phase 3 Testing Commands

## Quick Test (No Database Required)

```powershell
cd d:\Projects\RNTBCI(V)\Code
.\venv\Scripts\Activate.ps1
python test_phase3.py
```

**Expected:** All tests pass in ~5 seconds

---

## Full Demo

### Demo 1: Live Store Only (Always Works)
```powershell
python phase3_demo.py
```

When you see "Press Enter to run Demo 2...", you can:
- Press Ctrl+C to stop (if no database)
- Press Enter to continue to Demo 2 (if database configured)

### Demo 2: With Database (Optional)
Requires Phase 1 setup:
```powershell
# If not done yet
alembic upgrade head

# Run demo
python phase3_demo.py
# Press Enter when prompted
```

---

## Expected Output

### test_phase3.py
```
Testing Live State Store
  ✓ Empty store initialized
  ✓ State stored and retrieved
  ✓ Total power calculation: 7015.0W
  ✓ Get all states
  ✓ Store cleared

Testing Digital Twin Core (No History Store)
  ✓ Registered 2 devices
  ✓ Light command applied
  ✓ EVSE command applied
  ✓ Initial total power: 7015.0W
  ✓ EVSE SOC after 5 ticks: 78.0194%
  ✓ History count: 0 (no history store)

Testing Operational State Values
  ✓ test_off: off (valid)
  ✓ test_running: running (valid)

ALL PHASE 3 TESTS PASSED ✓

Ready for Phase 4 (Master Agent)
```

### phase3_demo.py - Demo 1
```
DEMO 1: LIVE STATE ONLY (No Database)
Demonstrates: Live state works independently of history store

Registering devices...
Registered 9 devices

Running simulation (10 ticks)...
  Tick 1: Total power = 7010.0W
  Tick 4: Total power = 7010.0W
  ...

Final live states:
  cctv_01              | running    |    10.0W
  evse_01              | running    |  7000.0W
  ...

✓ Live state working without database
✓ History readings recorded: 0 (expected: 0, no DB)
```

### phase3_demo.py - Demo 2
```
DEMO 2: LIVE STATE + HISTORY STORE (With Database)
Demonstrates: Row-per-tick history writes (Decision B)

Registering 3 devices (CCTV, EVSE, Light)...
Registered 3 devices

Initial history count: X rows

Running simulation (5 ticks, 3 devices = 15 expected rows)...
  Tick 1: Y total rows in power_readings
  Tick 2: Y+3 total rows in power_readings
  Tick 3: Y+6 total rows in power_readings
  Tick 4: Y+9 total rows in power_readings
  Tick 5: Y+12 total rows in power_readings

History rows added: 15 (expected: 15)
Decision B verified: Row-per-tick, every device
```

---

## Troubleshooting

### "No module named 'live_state_store'"
Phase 3 files not found. Check you're in correct directory:
```powershell
ls live_state_store.py
```

### Demo 2 fails with database error
Database not configured or migrations not applied:
```powershell
# Check connection
python -c "from database import engine; engine.connect()"

# Apply migrations
alembic upgrade head

# Verify
python verify_schema.py
```

### "Cannot import name 'SessionLocal'"
psycopg3 migration issue. Reinstall dependencies:
```powershell
pip install -r requirements.txt
```

### Demo 2 shows "History write failed"
This is logged but doesn't crash - intentional behavior.
Check database connection and permissions.

---

## Verification Points

### 1. Live Store Independence
- [ ] Test passes without database
- [ ] Demo 1 runs completely
- [ ] Simulation continues if history fails

### 2. Row-Per-Tick Recording
- [ ] Demo 2 shows correct row counts
- [ ] Each tick adds (device_count) rows
- [ ] History count increases predictably

### 3. Operational States
- [ ] All states are lowercase
- [ ] Valid enum values: off, on, running, idle, fault, setup_incomplete
- [ ] No PascalCase states (Stopped, Running, etc.)

### 4. Thread Safety
- [ ] No race conditions in live store
- [ ] Concurrent access handled correctly
- [ ] Locks prevent data corruption

---

## Performance Check

Run a longer simulation to verify performance:

```python
# In Python REPL
from phase3_demo import *
live_store = LiveStateStore()
twin = DigitalTwinCore(live_store=live_store, history_store=None)

# Register all 9 devices
for cfg in get_all_devices():
    device = create_simulated_device(cfg["device_id"], cfg["device_type"], 
                                     cfg["power_behavior_type"], cfg["rated_power_config"])
    twin.register_device(device)

# Run 1000 ticks
import time
start = time.time()
for _ in range(1000):
    twin.tick(1.0)
elapsed = time.time() - start

print(f"1000 ticks in {elapsed:.2f}s = {1000/elapsed:.1f} ticks/sec")
# Expected: >100 ticks/sec (live store only, no DB writes)
```

---

## All Phases Combined Test

```powershell
# Test all three phases
python test_phase2_quick.py
python validate_power_math.py
python test_phase3.py

# If all pass:
# ✓ Phase 1: Database schema
# ✓ Phase 2: Device abstraction
# ✓ Phase 3: Digital twin core
# Ready for Phase 4
```

---

## Success Criteria

✅ `test_phase3.py` - All tests pass  
✅ Demo 1 - Runs without database  
✅ Demo 2 - Shows row-per-tick (with database)  
✅ Live store - Works independently  
✅ History failures - Don't crash simulation  
✅ Performance - >10 ticks/sec (9 devices)

All met → Ready for Phase 4 (Master Agent)
