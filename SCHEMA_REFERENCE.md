# Database Schema Quick Reference

Visual reference for the RNTBCI Digital Twin database schema (MASTER_SPEC.md Part 4).

## Entity Relationship Diagram (Text)

```
┌─────────────────────┐
│  system_config      │
├─────────────────────┤
│ PK  key             │
│     value (JSONB)   │
│     updated_at      │
└─────────────────────┘

┌─────────────────────────────┐
│  villa_tier_presets         │
├─────────────────────────────┤
│ PK  tier                    │
│     phase_config            │
│     voltage_v               │
│     contracted_power_kva    │
│     current_rating_a        │
└─────────────────────────────┘

┌─────────────────────────────┐
│  devices                    │
├─────────────────────────────┤
│ PK  device_id               │
│     device_type             │
│     matter_cluster_schema   │  (JSONB)
│     power_behavior_type     │  (enum)
│     rated_power_config      │  (JSONB)
│     created_at              │
└─────────────────────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────────┐
│  power_modes                │
├─────────────────────────────┤
│ PK  mode_id                 │
│ FK  device_id               │──┐
│     mode_name               │  │
│     power_watts             │  │
│     is_default              │  │
└─────────────────────────────┘  │
           │                      │
           │ 0:N                  │ 1:N
           │                      │
           │                      ▼
           │         ┌─────────────────────────────┐
           │         │  power_readings             │
           │         ├─────────────────────────────┤
           │         │ PK  reading_id              │
           │         │ FK  device_id               │
           └─────────┤ FK  active_mode_id          │
                     │     timestamp               │
                     │     power_watts             │
                     │     operational_state       │
                     └─────────────────────────────┘
                                   │
                               Index: (device_id, timestamp)

┌─────────────────────────────┐
│  alerts                     │
├─────────────────────────────┤
│ PK  alert_id                │
│     timestamp               │
│     alert_type              │  (enum)
│     message                 │
│     total_load_watts        │
│     limit_watts             │
└─────────────────────────────┘
           │
       Index: (timestamp)

┌─────────────────────────────┐
│  system_setup_status (VIEW) │
├─────────────────────────────┤
│     has_power_limit         │  (computed)
│     has_current_rating      │  (computed)
└─────────────────────────────┘
```

## Table Details

### system_config
**Purpose:** Key-value store for runtime configuration  
**Decision C:** Intentionally empty initially - no defaults

| Column     | Type           | Nullable | Default  | Notes |
|------------|----------------|----------|----------|-------|
| key        | TEXT           | NOT NULL | -        | PK: 'contracted_power_kva' or 'current_rating_a' |
| value      | JSONB          | NOT NULL | -        | Numeric value stored as JSON |
| updated_at | TIMESTAMPTZ    | NOT NULL | now()    | Last modification time |

**Expected Keys:**
- `contracted_power_kva` - Selected villa tier's kVA rating
- `current_rating_a` - Selected villa tier's amperage rating

### villa_tier_presets
**Purpose:** Pre-configured villa tiers (read once at setup)  
**Seed Data:** 3 rows (small, medium, large)

| Column                | Type    | Nullable | Notes |
|-----------------------|---------|----------|-------|
| tier                  | TEXT    | NOT NULL | PK: 'small', 'medium', or 'large' |
| phase_config          | TEXT    | NOT NULL | 'single_phase' or 'three_phase' |
| voltage_v             | NUMERIC | NOT NULL | 230 or 400 |
| contracted_power_kva  | NUMERIC | NOT NULL | 6, 9, or 18 |
| current_rating_a      | NUMERIC | NOT NULL | 30, 45, or 26 |

### devices
**Purpose:** Device registry - all 9 devices stored as rows  
**Pattern:** No device types hardcoded in application logic

| Column                 | Type                 | Nullable | Notes |
|------------------------|----------------------|----------|-------|
| device_id              | TEXT                 | NOT NULL | PK: e.g. 'evse_01', 'light_01' |
| device_type            | TEXT                 | NOT NULL | e.g. 'evse', 'light', 'refrigerator' |
| matter_cluster_schema  | JSONB                | NOT NULL | Matter device type definition |
| power_behavior_type    | power_behavior_type  | NOT NULL | flat, taper, duty_cycle, or multi_mode |
| rated_power_config     | JSONB                | NOT NULL | Power parameters for behavior type |
| created_at             | TIMESTAMPTZ          | NOT NULL | Device registration time |

**power_behavior_type values:**
- `flat` - Constant power when running (light, dishwasher, washing machine, water heater, heat pump, CCTV, microwave)
- `taper` - Flat then SOC-based taper (EVSE only)
- `duty_cycle` - On/off pulses (refrigerator only)
- `multi_mode` - Multiple discrete power levels (none currently use this)

**rated_power_config examples:**
```json
// Flat behavior
{"rated_power_watts": 1500}

// Taper behavior (EVSE)
{
  "rated_power_watts": 7000,
  "taper_start_soc_pct": 80,
  "taper_curve": "linear"  // or other curve type
}

// Duty cycle behavior (Refrigerator)
{
  "on_power_watts": 150,
  "idle_power_watts": 5,
  "cycle_on_s": 600,
  "cycle_off_s": 300
}
```

### power_modes
**Purpose:** Multi-mode device power levels (future use)  
**Current Status:** Exists but unused by the 9 devices

| Column      | Type    | Nullable | Notes |
|-------------|---------|----------|-------|
| mode_id     | TEXT    | NOT NULL | PK: e.g. 'mode_induction_high' |
| device_id   | TEXT    | NOT NULL | FK → devices.device_id (CASCADE) |
| mode_name   | TEXT    | NOT NULL | e.g. 'High', 'Medium', 'Low' |
| power_watts | NUMERIC | NOT NULL | Power draw in this mode |
| is_default  | BOOLEAN | NOT NULL | Default false |

**Unique constraint:** (device_id, mode_name)

### power_readings
**Purpose:** Row-per-tick power history (Decision B)  
**Volume:** ~9 rows/sec (1 tick/sec × 9 devices)

| Column             | Type         | Nullable | Notes |
|--------------------|--------------|----------|-------|
| reading_id         | BIGSERIAL    | NOT NULL | PK: Auto-increment |
| device_id          | TEXT         | NOT NULL | FK → devices.device_id (CASCADE) |
| timestamp          | TIMESTAMPTZ  | NOT NULL | Reading time (default: now()) |
| power_watts        | NUMERIC      | NOT NULL | Instantaneous power draw |
| operational_state  | operational_state | NOT NULL | off, on, running, idle, fault, or setup_incomplete |
| active_mode_id     | TEXT         | NULL     | FK → power_modes.mode_id (if applicable) |

**Index:** `idx_power_readings_device_time` on (device_id, timestamp)

### alerts
**Purpose:** Alert-only overload tracking (Decision A)  
**Key:** NO throttle fields - alerts never trigger auto-throttle

| Column            | Type         | Nullable | Notes |
|-------------------|--------------|----------|-------|
| alert_id          | BIGSERIAL    | NOT NULL | PK: Auto-increment |
| timestamp         | TIMESTAMPTZ  | NOT NULL | Alert raised time (default: now()) |
| alert_type        | alert_type   | NOT NULL | 'overload_warning' or 'overload_trip' |
| message           | TEXT         | NOT NULL | Human-readable message |
| total_load_watts  | NUMERIC      | NOT NULL | Household total at alert time |
| limit_watts       | NUMERIC      | NOT NULL | Configured limit that was exceeded |

**alert_type values:**
- `overload_warning` - Approaching limit
- `overload_trip` - Would trip breaker

**Index:** `idx_alerts_time` on (timestamp)

### system_setup_status (VIEW)
**Purpose:** Check if setup is complete  
**Returns:** Boolean flags for required config keys

| Column             | Type    | Computed From |
|--------------------|---------|---------------|
| has_power_limit    | BOOLEAN | EXISTS(system_config WHERE key = 'contracted_power_kva') |
| has_current_rating | BOOLEAN | EXISTS(system_config WHERE key = 'current_rating_a') |

**Usage:**
```sql
SELECT * FROM system_setup_status;
-- Both must be true before power-budget endpoints work
```

## Enum Types

### power_behavior_type
```sql
CREATE TYPE power_behavior_type AS ENUM (
    'flat',         -- Constant power while running
    'taper',        -- Flat then SOC-based taper (EVSE)
    'duty_cycle',   -- On/off pulses (refrigerator)
    'multi_mode'    -- Multiple discrete power levels (future)
);
```

### alert_type
```sql
CREATE TYPE alert_type AS ENUM (
    'overload_warning',  -- Approaching limit
    'overload_trip'      -- Would trip breaker
);
```

### operational_state
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

## Indexes

| Index Name                      | Table          | Columns              | Purpose |
|---------------------------------|----------------|----------------------|---------|
| idx_power_readings_device_time  | power_readings | (device_id, timestamp) | Device history queries |
| idx_alerts_time                 | alerts         | (timestamp)          | Alert timeline queries |

## Foreign Keys

| From Table      | From Column      | To Table     | To Column  | On Delete |
|-----------------|------------------|--------------|------------|-----------|
| power_modes     | device_id        | devices      | device_id  | CASCADE   |
| power_readings  | device_id        | devices      | device_id  | CASCADE   |
| power_readings  | active_mode_id   | power_modes  | mode_id    | -         |

## Common Queries

### Check Setup Status
```sql
SELECT * FROM system_setup_status;
```

### Get Current Config
```sql
SELECT key, value FROM system_config;
```

### Latest Power Reading Per Device
```sql
SELECT DISTINCT ON (device_id)
    device_id,
    power_watts,
    operational_state,
    timestamp
FROM power_readings
ORDER BY device_id, timestamp DESC;
```

### Total Household Load
```sql
WITH latest_readings AS (
    SELECT DISTINCT ON (device_id)
        device_id,
        power_watts
    FROM power_readings
    ORDER BY device_id, timestamp DESC
)
SELECT SUM(power_watts) AS total_load_watts
FROM latest_readings;
```

### Recent Alerts
```sql
SELECT 
    alert_type,
    message,
    total_load_watts,
    limit_watts,
    timestamp
FROM alerts
ORDER BY timestamp DESC
LIMIT 10;
```

### Device List with Behavior
```sql
SELECT 
    device_id,
    device_type,
    power_behavior_type,
    rated_power_config
FROM devices
ORDER BY device_id;
```

## Migration Baseline

- **001_initial_schema.py** - Creates all tables, indexes, views, and enum types
- **002_seed_villa_tier_presets.py** - Seeds the 3 villa tiers

Current version after full migration: **002**

Check with: `alembic current`
