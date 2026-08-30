# Database Migrations Documentation

This document describes the Alembic migration structure for the RNTBCI Digital Twin project.

## Migration Philosophy

Following MASTER_SPEC.md Part 4 exactly:
- **No defaults in system_config** (Decision C) - empty table enforces setup gate
- **Alert-only system** (Decision A) - no throttle fields anywhere
- **Row-per-tick readings** (Decision B) - power_readings captures every simulator tick
- **Villa tiers seeded separately** - presets are read once at setup, never live

## Migration Files

### 001_initial_schema.py (Baseline)

Creates the complete database schema:

**Tables:**
1. `system_config` - Key-value config store (empty initially)
2. `villa_tier_presets` - Pre-configured villa tiers
3. `devices` - Device registry (9 devices as rows, not hardcoded)
4. `power_modes` - For future multi-mode devices (unused by current 9)
5. `power_readings` - Tick-by-tick power history
6. `alerts` - Alert-only overload tracking

**Enum Types:**
- `power_behavior_type` - flat | taper | duty_cycle | multi_mode
- `alert_type` - overload_warning | overload_trip
- `operational_state` - off | on | running | idle | fault | setup_incomplete

**Indexes:**
- `idx_power_readings_device_time` - Query optimization for device history
- `idx_alerts_time` - Query optimization for alert timeline

**Views:**
- `system_setup_status` - Checks if required config keys exist

**Foreign Keys:**
- `power_modes.device_id` → `devices.device_id` (CASCADE)
- `power_readings.device_id` → `devices.device_id` (CASCADE)
- `power_readings.active_mode_id` → `power_modes.mode_id`

### 002_seed_villa_tier_presets.py

Seeds the three villa tiers from SYNC.md §5:

| Tier   | Phase        | Voltage | kVA | Current |
|--------|--------------|---------|-----|---------|
| small  | single_phase | 230V    | 6   | 30A     |
| medium | single_phase | 230V    | 9   | 45A     |
| large  | three_phase  | 400V    | 18  | 26A     |

**Important:** These are read ONCE when the user selects a tier. The selected values are written to `system_config`, which becomes the single source of truth for runtime calculations.

## Key Schema Design Decisions

### 1. No Hardcoded Defaults (Decision C)

```sql
-- system_config starts EMPTY
SELECT * FROM system_config;
-- Returns 0 rows initially

-- Setup gate check
SELECT * FROM system_setup_status;
-- Returns: has_power_limit=false, has_current_rating=false
```

Until both `contracted_power_kva` and `current_rating_a` are set, any power-budget endpoint should return `409 Setup Incomplete`.

### 2. Alert-Only System (Decision A)

The `alerts` table intentionally has NO throttle-related columns:
- No `throttle_action`
- No `auto_throttle_enabled`
- No `device_throttled_id`

Household overload triggers alerts only, never automatic device throttle.

### 3. Device Registry Pattern

All 9 devices are stored as rows in the `devices` table, not as separate tables:

```sql
-- Device power behavior stored in rated_power_config JSONB
-- Examples:
-- Flat: {"rated_power_watts": 1500}
-- Taper: {"rated_power_watts": 7000, "taper_start_soc_pct": 80}
-- Duty cycle: {"on_power_watts": 150, "idle_power_watts": 5, 
--              "cycle_on_s": 600, "cycle_off_s": 300}
```

This allows swapping simulated ↔ real devices via adapter registry, with zero schema changes.

### 4. Row-Per-Tick Readings (Decision B)

The `power_readings` table captures every simulator tick for every device:

```sql
-- If simulator runs at 1 tick/sec with 9 devices:
-- ~9 rows/sec
-- ~324,000 rows/hour
-- ~7.8M rows/day

-- This density is required for CSV/XLSX export fidelity
```

Index on `(device_id, timestamp)` ensures efficient range queries for exports.

### 5. Matter Cluster Schema

The `matter_cluster_schema` JSONB column stores Matter device type definitions:

```json
{
  "deviceType": "EVSE",
  "matterDeviceTypeId": "0x050C",
  "clusters": {
    "OnOff": {
      "attributes": ["OnOff"]
    },
    "ElectricalPowerMeasurement": {
      "attributes": ["ActivePower", "ReactivePower"]
    }
  }
}
```

This provides the structure for REST API Matter-style envelopes (Part 5).

## Applying Migrations

### Initial Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Create database
createdb rntbci_digital_twin

# Configure connection
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run all migrations
alembic upgrade head
```

### Migration Commands

```bash
# Show current version
alembic current

# Show migration history
alembic history --verbose

# Upgrade to specific version
alembic upgrade 002

# Upgrade one step
alembic upgrade +1

# Downgrade one step
alembic downgrade -1

# Downgrade to baseline
alembic downgrade base

# Show SQL without executing
alembic upgrade head --sql
```

## Verification

After running migrations, verify the schema:

```bash
python verify_schema.py
```

This checks:
- All tables exist
- All columns present
- Indexes created
- Views functional
- Enum types registered
- system_config is empty (Decision C)
- villa_tier_presets has 3 rows
- No throttle fields in alerts (Decision A)

## Rollback Procedure

If a migration fails or needs to be reversed:

```bash
# Check current state
alembic current

# Rollback to previous version
alembic downgrade -1

# Or rollback to specific version
alembic downgrade 001

# Verify state
python verify_schema.py
```

## Future Migrations

When adding new migrations:

1. Never modify existing migration files
2. Create new migration with sequential revision number
3. Use descriptive names: `003_add_device_health_table.py`
4. Always provide both upgrade() and downgrade()
5. Test downgrade path before committing
6. Document any data transformations
7. Update this file with new migration details

## Common Operations

### Adding a New Device Type

**Do NOT create a new table.** Instead, insert a row into `devices`:

```sql
INSERT INTO devices (
    device_id, 
    device_type, 
    matter_cluster_schema, 
    power_behavior_type, 
    rated_power_config
) VALUES (
    'device_id_here',
    'device_type_here',
    '{"deviceType": "...", "clusters": {...}}',
    'flat',  -- or 'taper', 'duty_cycle', 'multi_mode'
    '{"rated_power_watts": 1000}'
);
```

No migration needed unless the device behavior requires new enum values.

### Changing Villa Tier Values

Create a new migration:

```python
def upgrade():
    op.execute("""
        UPDATE villa_tier_presets 
        SET contracted_power_kva = 12, current_rating_a = 50
        WHERE tier = 'medium'
    """)

def downgrade():
    op.execute("""
        UPDATE villa_tier_presets 
        SET contracted_power_kva = 9, current_rating_a = 45
        WHERE tier = 'medium'
    """)
```

## Troubleshooting

### "Table already exists" error

```bash
# Check if migrations were partially applied
alembic current

# If database has tables but Alembic doesn't know about them:
# Option 1: Drop all tables and re-run
# Option 2: Stamp current state without running migrations
alembic stamp head
```

### "Cannot connect to database"

Check your `.env` file:
```bash
# View current DATABASE_URL (without exposing password)
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('DATABASE_URL', 'NOT SET'))"
```

### "Enum type already exists"

If re-running migration after partial failure:

```sql
-- Check existing types
SELECT typname FROM pg_type 
WHERE typname IN ('power_behavior_type', 'alert_type', 'operational_state');

-- Drop manually if needed
DROP TYPE IF EXISTS operational_state CASCADE;
DROP TYPE IF EXISTS power_behavior_type CASCADE;
DROP TYPE IF EXISTS alert_type CASCADE;

-- Then re-run migration
```

## References

- MASTER_SPEC.md Part 4 - Full schema specification
- SYNC.md §5 - Villa tier values
- openapi.yaml - API contract (implemented in Phase 5)
- Alembic docs: https://alembic.sqlalchemy.org/
