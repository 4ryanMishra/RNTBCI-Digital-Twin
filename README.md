# RNTBCI Digital Twin — Home Energy Management System

A physics-accurate digital twin demonstrating household electrical capacity under realistic load scenarios, with focus on EV charger integration impact on French homes.

## 🎯 Project Overview

This system proves, with live and physically-correct calculations, what happens to a French home's electrical capacity when an EV charger is added under realistic household load. The digital twin simulates 9 household devices and monitors power consumption in real-time, alerting homeowners when capacity limits are approached.

## 🏗️ Architecture

Six-layer architecture:

```
Layer 6 — Frontend (React + Three.js)
Layer 5 — REST API & WebSocket ✅
Layer 4 — Application Modules ✅
Layer 3 — Master Agent (Alert-Only) ✅
Layer 2 — Digital Twin Core ✅
Layer 1 — Device Abstraction ✅
Database — PostgreSQL with Alembic migrations ✅
```

## ✅ Implementation Status

**Backend (Complete)**:
- ✅ Database schema with migrations
- ✅ Device abstraction layer (3 power behaviors)
- ✅ Digital twin core (live + history stores)
- ✅ Master Agent (alert-only overload detection)
- ✅ REST API + WebSocket (17 endpoints)
- ✅ Application modules (4 modules: location, battery, alert history, diagnostics)
- ✅ Matter protocol envelopes (device metadata)
- ✅ CSV/XLSX export functionality

**Frontend (In Progress)**:
- 🔄 React + Three.js 3D visualization
- 🔄 Device control UI
- 🔄 Power monitoring dashboard

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
- Python 3.11+ (tested with Python 3.14)
- PostgreSQL 14+ (for production) OR use mock server (no database needed)

### Option 1: Mock Server (Recommended for Testing)

```bash
# Clone repository
git clone https://github.com/4ryanMishra/RNTBCI-Digital-Twin.git
cd RNTBCI-Digital-Twin

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate  # Linux/Mac: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run mock server (no database required)
python mock_server.py

# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Option 2: Production Server (With Database)

```bash
# Clone repository
git clone https://github.com/4ryanMishra/RNTBCI-Digital-Twin.git
cd RNTBCI-Digital-Twin

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate  # Linux/Mac: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure database
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run migrations
alembic upgrade head

# Start server
python api_server.py

# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Run Tests

```bash
# API + WebSocket tests (use mock server)
python test_phase5.py

# Application modules tests (use mock server)
python test_phase6.py

# All tests
python test_phase3.py  # Digital twin core
python test_phase4.py  # Master Agent (requires database)
python test_phase5.py  # REST + WebSocket
python test_phase6.py  # Application modules
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
├── routers/                    # API route handlers
│   ├── devices.py             # Device control endpoints
│   ├── system.py              # System configuration endpoints
│   └── export.py              # CSV/XLSX export endpoints
├── modules/                    # Application modules
│   ├── location_module.py     # System location/setup data
│   ├── battery_module.py      # Battery/SOC estimation
│   ├── alert_history_module.py # Alert history tracking
│   └── diagnostics_module.py  # System diagnostics
├── database.py                 # SQLAlchemy configuration
├── device_interface.py         # Device abstraction interface
├── device_registry.py          # 9 device configurations
├── simulation_adapter.py       # Flat, Taper, DutyCycle adapters
├── live_state_store.py         # In-memory live state
├── history_store.py            # Database power_readings
├── digital_twin_core.py        # Core orchestrator
├── system_config_manager.py    # System configuration
├── master_agent.py             # Alert-only overload detection
├── ws_broadcaster.py           # WebSocket event broadcaster
├── tick_runner.py              # Background simulation tick loop
├── api_server.py               # Production FastAPI server
├── mock_server.py              # Mock server (no database)
├── test_phase3.py              # Digital twin tests
├── test_phase4.py              # Master Agent tests
├── test_phase5.py              # API + WebSocket tests
├── test_phase6.py              # Application modules tests
├── requirements.txt            # Python dependencies
├── .env.example                # Database connection template
└── DEVICE_VISUALS_MAPPING.md   # Frontend visual specifications
```

## 🔧 Technology Stack

- **Language:** Python 3.10+
- **Database:** PostgreSQL 14+ with psycopg3 driver
- **ORM/Migrations:** SQLAlchemy 2.0 + Alembic
- **Simulation:** Custom adapters (flat, taper, duty cycle)

## 📖 API Documentation

- **Interactive API Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc
- **Device Visuals**: `DEVICE_VISUALS_MAPPING.md` (frontend specifications)

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check + system status |
| `/api/v1/system/setup` | POST | Initialize system (select power tier) |
| `/api/v1/devices` | GET | List all 9 devices |
| `/api/v1/devices/{id}/control` | POST | Control device (on/off, modes, power) |
| `/api/v1/system/power-budget` | GET | Current power consumption + per-device breakdown |
| `/api/v1/export/total-power` | GET | Export total power history (CSV) |
| `/api/v1/export/appliance-power` | GET | Export per-device power (CSV) |
| `/ws` | WebSocket | Live events (power_reading, state_change, alerts) |

## 🚧 Roadmap

### ✅ Completed
- [x] Database schema with migrations
- [x] Device abstraction (3 power behaviors)
- [x] Digital twin core (live + history)
- [x] Master Agent (alert-only)
- [x] REST + WebSocket API (17 endpoints)
- [x] Application modules (4 modules)
- [x] Matter protocol envelopes
- [x] CSV/XLSX export

### 🔜 In Progress
- [ ] Frontend (React + Three.js 3D visualization)
- [ ] Device control UI + power monitoring dashboard

### 🎯 Future
- [ ] Deployment (production VM + PostgreSQL)
- [ ] MAPPO reinforcement learning (stretch goal)

## ⚖️ License

[To be determined]

## 👥 Contributors

- Development: AI-assisted implementation following MASTER_SPEC.md
- Project Lead: Aryan Mishra (@4ryanMishra)

## 📞 Contact

GitHub: https://github.com/4ryanMishra/RNTBCI-Digital-Twin

---

**Note:** This is a demonstration/research project. All power values and behaviors are based on realistic specifications but should not be used for production electrical system design without proper engineering review.
