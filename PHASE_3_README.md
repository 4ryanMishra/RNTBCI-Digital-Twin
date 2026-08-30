# Phase 3: Digital Twin Core - Quick Start

## Run Tests (No Database Required)

```bash
python test_phase3.py
```

**Expected:** All tests pass ✓

---

## Run Demo

### Demo 1: Live Store Only (Always Works)
```bash
python phase3_demo.py
```

Press Ctrl+C after Demo 1 if you don't have database configured.

### Demo 2: With Database (Optional)
```bash
# Ensure Phase 1 migrations applied
alembic upgrade head

# Run full demo
python phase3_demo.py
# Press Enter when prompted for Demo 2
```

---

## What to Verify

### 1. Independent Failure Resistance

**Demo 1 shows:**
- Simulation runs without database
- Live state updates normally
- Total power calculation works
- Commands apply successfully

**Key point:** WebSocket would work even if database is down.

### 2. Row-Per-Tick Recording (Decision B)

**Demo 2 shows:**
- Every tick writes to power_readings
- 3 devices × 5 ticks = 15 new rows
- History count increases correctly

**Key point:** CSV/XLSX export density requirement satisfied.

### 3. Separate Stores

**Test output shows:**
- Live store: in-memory, thread-safe
- History store: database, failure-logged
- One failing doesn't crash the other

**Key point:** Architecture prevents cascading failures.

---

## Files

| File | Purpose |
|------|---------|
| `live_state_store.py` | In-memory live state (WebSocket source) |
| `history_store.py` | Database power_readings (REST source) |
| `digital_twin_core.py` | Layer 2 orchestrator |
| `phase3_demo.py` | Standalone demonstrations |
| `test_phase3.py` | Validation tests |

---

## Common Issues

### Test fails with "No module named..."
```bash
# Make sure Phase 2 files exist
ls device_interface.py simulation_adapter.py device_registry.py
```

### Demo 2 fails with database error
```bash
# Check database connection
python -c "from database import engine; engine.connect()"

# Apply migrations if needed
alembic upgrade head
```

### History writes fail in demo
This is expected behavior if database isn't configured.  
Live state continues working (that's the point of independent stores).

---

## Architecture Overview

```
Digital Twin Core (Layer 2)
│
├─ Live State Store (in-memory)
│  • Never fails (no I/O)
│  • WebSocket source
│  • Total power calculation
│
└─ History Store (database)
   • power_readings table
   • Row-per-tick (Decision B)
   • Failures logged, don't crash
   • REST/export source
```

---

## Next Phase

After Phase 3 approval:
- **Phase 4:** Master Agent (alert-only overload detection)
- Reads from live store
- Checks against system_config
- Fires alerts (Decision A - never throttles)

---

## Quick Command Reference

```bash
# Test Phase 3 only
python test_phase3.py

# Demo without database
python phase3_demo.py  # Ctrl+C after Demo 1

# Demo with database
alembic upgrade head
python phase3_demo.py  # Press Enter for Demo 2

# Check history row count
python -c "from history_store import HistoryStore; from database import SessionLocal; h = HistoryStore(SessionLocal); print(f'{h.get_reading_count()} rows')"
```

---

## Success Criteria

✅ `test_phase3.py` - All tests pass  
✅ Demo 1 - Runs without database  
✅ Demo 2 - Row-per-tick writes (if database available)  
✅ Live store - Works independently  
✅ History failures - Don't crash simulation

All criteria met → Ready for Phase 4
