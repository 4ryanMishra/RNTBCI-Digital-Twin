# Testing Phase 2 Fixes - Quick Commands

## Fresh Environment Setup (Recommended)

```powershell
# Navigate to project
cd d:\Projects\RNTBCI(V)\Code

# Remove old environment (if exists)
Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue

# Create new environment with Python 3.14
python -m venv venv

# Activate
.\venv\Scripts\Activate.ps1

# Install dependencies (now with psycopg3)
pip install -r requirements.txt

# Verify psycopg3 installed
python -c "import psycopg; print(f'psycopg version: {psycopg.__version__}')"
```

Expected: `psycopg version: 3.1.18` (or similar 3.x)

---

## Test Fix 1: CCTV Initialization

```powershell
# Run quick smoke test (includes new CCTV assertions)
python test_phase2_quick.py
```

**Look for these new tests:**
```
Testing CCTV initialization...
  ✓ CCTV initial state: off
  ✓ CCTV after start command: running
  ✓ CCTV power draw: 10W

Testing CCTV initialization in Simulator...
  ✓ CCTV state in Simulator: running
  ✓ CCTV power draw: 10W
```

**If this fails:** CCTV is not being initialized to "running" in Simulator

---

## Test Fix 2: psycopg3 Migration

### Verify Phase 1 Migrations Still Work

```powershell
# Create test database
createdb rntbci_digital_twin_test

# Configure connection (create .env if not exists)
# Edit .env:
# DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/rntbci_digital_twin_test

# Apply migrations
alembic upgrade head

# Verify schema
python verify_schema.py

# Should see:
# ✓ All 3 enum types exist
# ✓ operational_state enum has correct values
# ALL CHECKS PASSED ✓

# Clean up test database
dropdb rntbci_digital_twin_test
```

**If migrations fail:** psycopg3 connection issue  
**If schema verify fails:** Migration didn't apply correctly

---

## Complete Test Suite

### Phase 2 Only (No Database)
```powershell
# Quick test (30 seconds)
python test_phase2_quick.py

# Full validation (1 minute)
python validate_power_math.py

# Demo simulation (5 minutes)
python phase2_demo.py
```

### Phase 1 + Phase 2 (With Database)
```powershell
# Create fresh test database
createdb rntbci_digital_twin_test

# Configure .env for test database
# DATABASE_URL=postgresql://postgres:pass@localhost:5432/rntbci_digital_twin_test

# Test Phase 1
alembic upgrade head
python verify_schema.py

# Test Phase 2
python test_phase2_quick.py
python validate_power_math.py

# Cleanup
dropdb rntbci_digital_twin_test
```

---

## Troubleshooting

### "No module named 'psycopg'"
```powershell
pip install psycopg[binary]
```

### "cannot import name 'psycopg2'"
Old cached files. Clean and reinstall:
```powershell
Remove-Item -Recurse -Force venv
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### CCTV test fails
Check `phase2_demo.py` line 37-38:
```python
def _initialize_device_states(self):
    # CCTV starts running
    self.devices["cctv_01"].apply_command({"action": "start"})
```

This should be present and called from `__init__()`.

### Database connection fails
Check your .env file:
```powershell
# View current DATABASE_URL
Get-Content .env | Select-String "DATABASE_URL"

# Test connection directly
python -c "from database import engine; conn = engine.connect(); print('Connected!'); conn.close()"
```

### Alembic can't connect
```powershell
# Check current Alembic version
alembic current

# If connection error, verify DATABASE_URL in .env
# Should be: postgresql://user:pass@host/dbname
# OR: postgresql+psycopg://user:pass@host/dbname
```

---

## Expected Results Summary

| Test | Duration | Expected Output |
|------|----------|-----------------|
| test_phase2_quick.py | 30s | All tests PASSED, CCTV tests included |
| validate_power_math.py | 1min | ALL VALIDATIONS PASSED ✓ |
| phase2_demo.py | 5min | 30-min simulation, CCTV always 10W |
| alembic upgrade head | 10s | Revision 002 applied |
| verify_schema.py | 5s | ALL CHECKS PASSED ✓ |

All tests should pass with ✓ marks and no errors.

---

## Quick One-Liner Tests

```powershell
# Test both fixes in sequence
python test_phase2_quick.py ; python -c "import psycopg; print(f'psycopg {psycopg.__version__}')"
```

Expected:
```
ALL QUICK TESTS PASSED ✓
psycopg 3.1.18
```

---

## What Success Looks Like

✅ **psycopg3 installed** - version 3.1.x  
✅ **CCTV tests pass** - specific assertions for "running" state  
✅ **Phase 1 migrations work** - alembic upgrade completes  
✅ **Schema verified** - all 3 enums including operational_state  
✅ **Phase 2 validation passes** - EVSE taper, duty cycle, flat power  

If all above pass → Both fixes working correctly, ready for Phase 3.
