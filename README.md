# RNTBCI Digital Twin - Home Energy Management System

A physics-accurate digital twin for demonstrating household electrical capacity under realistic load scenarios, with focus on EV charger integration.

## 🎯 Project Goal

Prove, with live and physically-correct numbers, what happens to a French home's electrical capacity when an EV charger is added under realistic household load.

## 🏗️ Architecture

Five-layer architecture per MASTER_SPEC.md:

```
Layer 5 — REST API & WebSocket (Future)
Layer 4 — Application Modules (Future)
Layer 3 — Master Agent (Alert-Only, ✅ Implemented)
Layer 2 — Digital Twin Core (✅ Implemented)
Layer 1 — Device Abstraction (✅ Implemented)
Database — PostgreSQL with Alembic migrations (✅ Implemented)
```

## ✅ Current Implementation Status

- **Phase 1:** Database schema with Alembic migrations
- **Phase 2:** Device abstraction layer with simulation adapters
- **Phase 3:** Digital twin core (live + history stores)
- **Phase 4:** Master Agent (alert-only overload detection)
- **Phase 5:** REST + WebSocket API (Pending)
- **Phase 6:** Application modules (Pending)
- **Phase 7:** 3D Frontend (Pending)

## 🔑 Key Design Decisions

### Decision A: Alert-Only (NO Auto-Throttle)
The Master Agent **never** auto-throttles devices. It only raises alerts when household load approaches or exceeds limits.

### Decision B: Row-Per-Tick History
Every simulation tick records power readings for all devices (needed for export density).

### Decision C: No Hardcoded Defaults
System starts in `setup_incomplete` state. User must select a villa tier before power budget monitoring activates.

### Decision D: EVSE Taper Behavior
Flat power (7000W) until 80% SOC, then linear taper to 0W at 100% SOC. NOT a DC-fast-charge curve.

## 🔌 The 9 Simulated Devices

| Device | Power | Behavior | Notes |
|--------|-------|----------|-------|
| EVSE | 7000W | Taper | Flat until 80% SOC, then linear taper |
| Light | 15W | Flat | OnOff Plug-in Unit |
| Dishwasher | 1500W | Flat | Generic Appliance |
| Washing Machine | 2200W | Flat | Generic Appliance |
| Water Heater | 2200W | Flat | Generic Appliance |
| Heat Pump | 4000W | Flat | Generic Appliance |
| CCTV | 10W | Flat | Always-on |
| Microwave | 1200W | Flat | On-full or off |
| Refrigerator | 150W/5W | Duty Cycle | Compressor pulses (600s on / 300s off) |

## 🚀 Quick Start

### Prerequisites
- Python 3.10+ (tested with Python 3.14)
- PostgreSQL 14+

### Setup

```bash
# Clone repository
git clone https://github.com/4ryanMishra/RNTBCI-Digital-Twin.git
cd RNTBCI-Digital-Twin

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure database
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run migrations
alembic upgrade head

# Verify schema
python verify_schema.py
```

### Run Tests

```bash
# Phase 2: Device abstraction
python test_phase2_quick.py
python validate_power_math.py

# Phase 3: Digital twin core
python test_phase3.py

# Phase 4: Master Agent
python test_phase4.py  # Requires database connection
```

### Run Demos

```bash
# Phase 2: Device simulation (no database needed)
python phase2_demo.py

# Phase 3: Digital twin with live + history stores
python phase3_demo.py
```

## 📊 Villa Tier Presets

| Tier | Phase | Voltage | Power | Current |
|------|-------|---------|-------|---------|
| Small | Single | 230V | 6 kVA | 30A |
| Medium | Single | 230V | 9 kVA | 45A |
| Large | Three | 400V | 18 kVA | 26A/phase |

## 🗄️ Database Schema

### Core Tables
- `system_config` - Runtime configuration (no defaults)
- `villa_tier_presets` - Pre-configured tiers
- `devices` - Device registry (9 devices as rows)
- `power_readings` - Row-per-tick history
- `alerts` - Alert-only system (no throttle)

### Custom Types
- `power_behavior_type` - flat, taper, duty_cycle, multi_mode
- `alert_type` - overload_warning, overload_trip
- `operational_state` - off, on, running, idle, fault, setup_incomplete

## 🧪 Testing & Validation

### Power Calculation Validation
```bash
python validate_power_math.py
```

Validates:
- Flat power devices (0W off, rated_power_watts running)
- EVSE taper formula at multiple SOC points
- Refrigerator duty cycle timing
- SOC progression calculation

### Schema Validation
```bash
python verify_schema.py
```

Verifies:
- All tables, indexes, and views exist
- Enum types correct (lowercase operational states)
- Foreign keys properly configured
- No throttle fields (Decision A enforcement)

## 📁 Project Structure

```
├── alembic/                    # Database migrations
│   ├── versions/
│   │   ├── 001_initial_schema.py
│   │   └── 002_seed_villa_tier_presets.py
│   ├── env.py
│   └── script.py.mako
├── database.py                 # SQLAlchemy configuration
├── device_interface.py         # Device abstraction interface
├── device_registry.py          # 9 device configurations
├── simulation_adapter.py       # Flat, Taper, DutyCycle adapters
├── live_state_store.py         # In-memory live state
├── history_store.py            # Database power_readings
├── digital_twin_core.py        # Core orchestrator
├── system_config_manager.py    # System configuration
├── master_agent.py             # Alert-only overload detection
├── phase2_demo.py              # Device simulation demo
├── phase3_demo.py              # Digital twin demo
├── test_phase2_quick.py        # Phase 2 tests
├── test_phase3.py              # Phase 3 tests
├── test_phase4.py              # Phase 4 tests
├── validate_power_math.py      # Power calculation validation
├── verify_schema.py            # Schema verification
├── requirements.txt            # Python dependencies
└── .env.example                # Database connection template
```

## 🔧 Technology Stack

- **Language:** Python 3.10+
- **Database:** PostgreSQL 14+ with psycopg3 driver
- **ORM/Migrations:** SQLAlchemy 2.0 + Alembic
- **Simulation:** Custom adapters (flat, taper, duty cycle)

## 📖 Documentation

For detailed information, see:
- `MASTER_SPEC.md` in `/Info` - Complete specification
- `SYNC.md` in `/Info` - Backend/Frontend contract
- `openapi.yaml` in `/Info` - API specification
- Migration files in `alembic/versions/` - Schema documentation

## 🚧 Roadmap

### ✅ Completed
- [x] Phase 1: Database schema
- [x] Phase 2: Device abstraction
- [x] Phase 3: Digital twin core
- [x] Phase 4: Master Agent

### 🔜 Next Steps
- [ ] Phase 5: REST + WebSocket API
- [ ] Phase 6: Application modules
- [ ] Phase 7: 3D Frontend (Three.js/React Three Fiber)
- [ ] Phase 8: MAPPO reinforcement learning (stretch goal)

## ⚖️ License

[To be determined]

## 👥 Contributors

- Development: AI-assisted implementation following MASTER_SPEC.md
- Project Lead: Aryan Mishra (@4ryanMishra)

## 📞 Contact

GitHub: https://github.com/4ryanMishra/RNTBCI-Digital-Twin

---

**Note:** This is a demonstration/research project. All power values and behaviors are based on realistic specifications but should not be used for production electrical system design without proper engineering review.
