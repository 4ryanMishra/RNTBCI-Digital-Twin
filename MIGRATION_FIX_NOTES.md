# Migration Fix: Operational State Enum

**Date:** 2026-08-30  
**Issue:** Initial implementation used incorrect operational state values  
**Status:** Fixed in migration 001

---

## What Was Wrong

The initial documentation and openapi.yaml showed:
```
OperationalState: [Stopped, Running, Paused, Error]
```

These were:
1. PascalCase instead of lowercase
2. Missing required states: `off`, `on`, `idle`, `fault`, `setup_incomplete`
3. Had incorrect states: `Stopped`, `Paused`, `Error`

## Correct Values (from MASTER_SPEC.md)

The operational_state enum now correctly uses:
```sql
CREATE TYPE operational_state AS ENUM (
    'off',              -- Device powered off
    'on',               -- Device powered on but not actively operating
    'running',          -- Device actively operating
    'idle',             -- Device on standby/idle
    'fault',            -- Device in error/fault state
    'setup_incomplete'  -- Device not yet configured
);
```

All values are **lowercase** as per MASTER_SPEC.md.

## What Was Changed

### 1. Migration File (001_initial_schema.py)
- Added `operational_state` enum type creation
- Changed `power_readings.operational_state` from TEXT to enum type
- Added enum drop to downgrade function

### 2. Documentation Updates
- `SCHEMA_REFERENCE.md` - Updated operational_state column type and values
- `MIGRATIONS.md` - Added operational_state to enum types list
- `PHASE_1_SUMMARY.md` - Added operational_state to enum count (now 3 types)
- `README.md` - Noted operational_state enum in tables list

### 3. Verification Script (verify_schema.py)
- Updated to check for 3 enum types instead of 2
- Added validation of operational_state enum values
- Confirms lowercase values and presence of setup_incomplete

## Impact

This is a **breaking change** if migrations were already run with the old schema. If you already ran migrations:

### Option 1: Fresh Start (Recommended for Phase 1)
```bash
# Drop and recreate database
dropdb rntbci_digital_twin
createdb rntbci_digital_twin

# Re-run migrations
alembic upgrade head
```

### Option 2: Manual Migration Fix (If data exists)
```sql
-- Create the enum type
CREATE TYPE operational_state AS ENUM (
    'off', 'on', 'running', 'idle', 'fault', 'setup_incomplete'
);

-- Convert existing data (if any - unlikely in Phase 1)
-- This requires mapping old values to new ones:
UPDATE power_readings SET operational_state_new = 
    CASE operational_state
        WHEN 'Stopped' THEN 'off'
        WHEN 'Running' THEN 'running'
        WHEN 'Paused' THEN 'idle'
        WHEN 'Error' THEN 'fault'
        ELSE 'off'
    END;

-- Drop old column and rename
ALTER TABLE power_readings DROP COLUMN operational_state;
ALTER TABLE power_readings RENAME COLUMN operational_state_new TO operational_state;
```

## Why setup_incomplete Matters

From MASTER_SPEC.md Decision C:
> System starts `setup_incomplete`. User selects a villa tier...

The `setup_incomplete` state is used when:
- A device has been registered but not yet configured
- System-level setup is incomplete (no villa tier selected)
- Device is waiting for initial configuration parameters

This is distinct from:
- `off` - Device is configured but powered off
- `fault` - Device encountered an error

## Verification

After running migrations, verify the fix:

```bash
python verify_schema.py
```

Expected output includes:
```
8. Custom enum types:
  ✓ All 3 enum types exist
  ✓ operational_state enum has correct values (lowercase, includes setup_incomplete)
```

## Relation to Other Components

### WebSocket Events (MASTER_SPEC.md Part 6)
The `setup_incomplete` state is used in WebSocket events:
- `setup_incomplete` event sent when device/system not configured
- `setup_complete` event sent when configuration finishes

### API Responses (MASTER_SPEC.md Part 5)
Any endpoint returning device state should use these operational_state values in the Matter-style envelope.

### Future Phases
Phase 2 (Device abstraction) and Phase 3 (Digital twin core) will use these enum values for state tracking.

---

**Resolution:** All documentation and schema now match MASTER_SPEC.md exactly. Lowercase operational states with setup_incomplete included.
