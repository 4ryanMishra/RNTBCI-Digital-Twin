# RNTBCI Digital Twin - Backend

Phase 1 implementation: Database schema with Alembic migrations.

## Prerequisites

- Python 3.10+ (tested with Python 3.14)
- PostgreSQL 14+

**Note:** We use psycopg3 (`psycopg[binary]`) instead of psycopg2 for Python 3.14 compatibility. See `PSYCOPG3_MIGRATION.md` for details.

## Setup

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure database connection:**
   ```bash
   cp .env.example .env
   # Edit .env and set your DATABASE_URL
   ```

4. **Create the database:**
   ```sql
   -- In PostgreSQL
   CREATE DATABASE rntbci_digital_twin;
   ```

5. **Run migrations:**
   ```bash
   # Apply all migrations
   alembic upgrade head
   
   # Check current version
   alembic current
   
   # Show migration history
   alembic history
   ```

## Database Schema

This implementation follows MASTER_SPEC.md Part 4 exactly:

### Tables Created

1. **system_config** - System configuration (no defaults per Decision C)
2. **villa_tier_presets** - Pre-configured villa tiers (Small/Medium/Large)
3. **devices** - Device registry (all 9 devices as rows)
4. **power_modes** - Power modes for multi-mode devices (none currently use this)
5. **power_readings** - Row-per-tick readings (Decision B) with operational_state enum
6. **alerts** - Alert-only system (Decision A - no throttle)

### Views Created

- **system_setup_status** - Checks if required config keys are set

### Migrations

- `001_initial_schema.py` - Creates all tables, indexes, and views
- `002_seed_villa_tier_presets.py` - Seeds villa tier presets

## Villa Tier Presets (from SYNC.md)

| Tier   | Phase        | Voltage | kVA  | Current |
|--------|--------------|---------|------|---------|
| small  | single_phase | 230V    | 6    | 30A     |
| medium | single_phase | 230V    | 9    | 45A     |
| large  | three_phase  | 400V    | 18   | 26A     |

## Locked Decisions Enforced in Schema

- **Decision A**: No auto-throttle - alerts table has no throttle field
- **Decision B**: Row-per-tick - power_readings captures every tick
- **Decision C**: No defaults - system_config starts empty
- **Decision D**: EVSE taper - handled in rated_power_config JSONB
- **Decision E**: snake_case in DB, camelCase in API (API layer not implemented yet)

## Rollback

```bash
# Rollback one migration
alembic downgrade -1

# Rollback to baseline
alembic downgrade base
```

## Current Status

**Phase 1:** ✅ Complete - Database schema with Alembic migrations  
**Phase 2:** ✅ Complete - Device abstraction layer with simulation adapters  
**Phase 3:** ✅ Complete - Digital twin core (live + history stores)

**Next:** Phase 4 - Master Agent (alert-only overload detection)

## Notes

- **No ORM models created yet** - this is pure schema/migrations (Phase 1 scope)
- **system_config intentionally empty** - setup gate enforced until user selects tier
- **villa_tier_presets read once** at setup time, never read live afterward
