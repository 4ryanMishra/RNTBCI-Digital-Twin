# psycopg2 → psycopg3 Migration

**Date:** 2026-08-30  
**Reason:** psycopg2-binary fails to build on Python 3.14 without MSVC Build Tools  
**Solution:** Migrate to psycopg3 (pure Python + optional binary speedups)

---

## Changes Made

### 1. requirements.txt
**Before:**
```
psycopg2-binary==2.9.9
```

**After:**
```
psycopg[binary]==3.1.18
```

**Why:** 
- psycopg3 is pure Python with optional binary extensions
- `psycopg[binary]` includes pre-compiled binaries (no compilation needed)
- Compatible with Python 3.14
- Faster and more feature-rich than psycopg2

### 2. database.py
**Added connection string auto-conversion:**
```python
# Convert postgresql:// to postgresql+psycopg:// if needed (for psycopg3)
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
```

**Why:**
- SQLAlchemy 2.0 uses `postgresql+psycopg://` for psycopg3 driver
- Auto-conversion allows existing `postgresql://` URLs to work
- Backward compatible with Phase 1 setup instructions

### 3. .env.example
**Updated comment:**
```
# Note: Use postgresql:// or postgresql+psycopg:// prefix (both work, auto-converted to psycopg3)
```

---

## Breaking Changes

**None.** This is a drop-in replacement.

- Existing `DATABASE_URL=postgresql://...` still works (auto-converted)
- All Phase 1 migrations remain compatible
- SQLAlchemy API unchanged

---

## Installation

### Fresh Install (Recommended)
```bash
# Remove old virtual environment if exists
Remove-Item -Recurse -Force venv

# Create new virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install with psycopg3
pip install -r requirements.txt
```

### Upgrade Existing Environment
```bash
# Activate environment
.\venv\Scripts\Activate.ps1

# Uninstall old driver
pip uninstall psycopg2-binary

# Install new driver
pip install psycopg[binary]==3.1.18

# Verify
python -c "import psycopg; print(psycopg.__version__)"
```

---

## Verification

### 1. Check Driver Version
```bash
python -c "import psycopg; print(f'psycopg version: {psycopg.__version__}')"
```

Expected output: `psycopg version: 3.1.18` (or similar 3.x.x)

### 2. Test Database Connection
```bash
python -c "from database import engine; print('Connection test:', engine.connect())"
```

Should connect without errors.

### 3. Verify Migrations
```bash
# Check Alembic can connect
alembic current

# Test migration (in a test database)
alembic upgrade head
alembic downgrade base
alembic upgrade head
```

All should work without driver-related errors.

---

## Differences from psycopg2

### Compatibility
✅ **Fully compatible with SQLAlchemy 2.0**  
✅ **All PostgreSQL features supported**  
✅ **Binary format for performance** (with `[binary]` extra)

### Improvements in psycopg3
- **Better async support** (not used yet, but available for future)
- **Improved connection pooling**
- **Native support for JSON/JSONB** (used in our schema)
- **Better prepared statement caching**
- **Cleaner API**

### API Changes (Not Affecting Us)
psycopg3 has different APIs when used directly (e.g., `psycopg.connect()`), but since we use SQLAlchemy, these differences are abstracted away. Our code doesn't import psycopg directly, only through SQLAlchemy.

---

## Troubleshooting

### "No module named 'psycopg'"
```bash
pip install psycopg[binary]
```

### "ImportError: cannot import name 'psycopg2'"
Old code trying to import psycopg2 directly. We don't do this - SQLAlchemy handles it.

### Connection string issues
If you see driver errors, verify your DATABASE_URL:
```bash
# Should work (auto-converted):
postgresql://user:pass@localhost/dbname

# Also works:
postgresql+psycopg://user:pass@localhost/dbname
```

### Binary extension not loading
```bash
# Check if binary is installed
pip show psycopg-binary

# If not:
pip install psycopg-binary
```

---

## Phase 1 Migration Verification

After switching to psycopg3, verify Phase 1 migrations:

```bash
# Fresh database
createdb rntbci_digital_twin_test

# Update .env to point to test database
# DATABASE_URL=postgresql://user:pass@localhost/rntbci_digital_twin_test

# Run migrations
alembic upgrade head

# Verify schema
python verify_schema.py

# Clean up
dropdb rntbci_digital_twin_test
```

Expected: All migrations apply cleanly, schema validation passes.

---

## Documentation Updates

Updated files:
- `requirements.txt` - psycopg[binary] instead of psycopg2-binary
- `database.py` - Auto-conversion for connection strings
- `.env.example` - Added note about supported URL formats
- `PSYCOPG3_MIGRATION.md` - This file

No changes needed:
- Migration files (driver-agnostic)
- Schema definitions (driver-agnostic)
- All Phase 2 code (no database dependencies yet)

---

## References

- [psycopg3 documentation](https://www.psycopg.org/psycopg3/)
- [SQLAlchemy 2.0 psycopg3 support](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#module-sqlalchemy.dialects.postgresql.psycopg)
- [Migration guide from psycopg2 to psycopg3](https://www.psycopg.org/psycopg3/docs/basic/from_pg2.html)

---

**Status:** ✅ Migration complete and tested

Both Phase 1 (database) and Phase 2 (device abstraction) work with psycopg3.
