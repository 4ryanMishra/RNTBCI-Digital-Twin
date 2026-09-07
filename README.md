# RNTBCI Digital Twin — Smart Home Energy Management System

A real-time digital twin for French residential energy management, demonstrating the electrical impact of EV charger integration on household power capacity.

## 🎯 The Problem

French homes have strict electrical capacity limits (typically 6-12 kVA). When homeowners add an electric vehicle charger drawing 7.4kW, they risk exceeding their contracted capacity, leading to:

- Circuit breaker trips during simultaneous appliance use
- Potential fire hazards from sustained overload
- Unexpected electricity bill penalties
- Need for expensive electrical panel upgrades

**Current gap**: Homeowners have no way to visualize or predict these issues before installation.

## 💡 Our Solution

A physics-accurate digital twin that simulates a complete French household with realistic appliance behavior. The system monitors power consumption in real-time and alerts homeowners **before** overload occurs, enabling informed decision-making about when to charge their EV.

### Key Principle: Alert-Only System

This system **never** automatically throttles or disconnects devices. Alerts are informational only — the homeowner decides what action to take. This design validates the research hypothesis: *demonstrating EV charger impact without interference.*

## 🏠 Use Cases

### 1. Pre-Installation Planning
**Scenario**: Family considering EV purchase  
**Value**: Simulate household load with EV charger before buying  
**Outcome**: Understand if electrical panel upgrade needed

### 2. Daily Energy Management
**Scenario**: EV owner with 9kVA capacity  
**Value**: Real-time alerts when approaching limit  
**Outcome**: Defer EV charging until dishwasher/water heater finish

### 3. Research & Policy
**Scenario**: Energy company analyzing residential EV impact  
**Value**: Physics-correct simulation with exportable data  
**Outcome**: Inform grid infrastructure planning

### 4. Consumer Education
**Scenario**: Homeowner doesn't understand kVA limits  
**Value**: 3D visualization shows real-time power consumption  
**Outcome**: Visual understanding of electrical capacity

## ✨ Features

### Real-Time Monitoring
- **Live power tracking** across 9 household devices
- **Per-device breakdown** showing consumption by appliance
- **Utilization percentage** against contracted capacity
- **WebSocket updates** every 2 seconds

### Intelligent Alerting
- **Warning alerts** at 80% capacity (7.4kW on 9kVA)
- **Critical alerts** at 95% capacity (8.7kW on 9kVA)
- **Historical alert log** for pattern analysis
- **No auto-throttle** — homeowner stays in control

### Physics-Accurate Simulation
- **Realistic device behaviors**: taper charging (EV), duty cycles (refrigerator), flat power (lights)
- **SOC-based EV taper**: Flat 7kW until 80% charged, then linear taper to 100%
- **Compressor cycling**: Refrigerator pulses 150W/5W on 600s/300s schedule
- **Matter protocol compliance**: Device metadata follows Matter 1.2 spec

### Data Export
- **CSV/XLSX export** of power history (total + per-device)
- **Timestamped readings** for every simulation tick
- **Matter envelopes** with full device metadata
- **Alert history** for analysis

### 3D Visualization
- **Interactive 3D French home** with realistic device placement
- **Real-time device glow** indicating operational state
- **Power gauge** showing household consumption
- **Camera controls** to explore the home

## 🔌 Simulated Devices

The system models 9 common French household devices:

| Device | Power | Behavior | Placement | Control |
|--------|-------|----------|-----------|---------|
| **EV Charger (EVSE)** | 1.4-7.4kW | Taper curve | Garage/Driveway | Power slider |
| **Lighting** | 15W | On/Off | Living room | Toggle |
| **Dishwasher** | 1.5kW | Cycle modes | Kitchen | Mode select |
| **Washing Machine** | 2.2kW | Cycle modes | Laundry | Mode select |
| **Water Heater** | 2.5kW | On/Off | Utility room | Toggle |
| **Heat Pump** | 3kW | On/Off | Exterior | Toggle |
| **Security Camera** | 10W | Always-on | Exterior | None |
| **Microwave** | 1.2kW | On/Off | Kitchen | Toggle |
| **Refrigerator** | 150W/5W | Duty cycle | Kitchen | None |

### Power Behaviors

**Flat Power**: Light, water heater, heat pump, microwave  
→ Instant on/off at rated power

**Taper Curve**: EV charger  
→ 7kW constant until 80% SOC, then linear reduction to 0W at 100%

**Duty Cycle**: Refrigerator  
→ Compressor cycles: 150W for 10 min, 5W for 5 min, repeat

**Multi-Mode**: Dishwasher, washing machine  
→ Normal (1.5kW), Eco (1.2kW), Intensive (1.8kW)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  • 3D Visualization (Three.js)                              │
│  • Device Controls (sliders, buttons, mode selectors)       │
│  • Power Dashboard (real-time gauge, alerts)                │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST + WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend API (FastAPI)                      │
│  • 17 REST endpoints (device control, export, config)       │
│  • WebSocket (live power readings, state changes, alerts)   │
│  • Application modules (location, battery, diagnostics)     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Digital Twin Core (Simulation Engine)           │
│  • Live state store (in-memory)                             │
│  • History store (PostgreSQL time-series)                   │
│  • Master Agent (alert detection)                           │
│  • Tick runner (background simulation loop)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Device Abstraction Layer (9 Devices)               │
│  • Flat power adapters (lights, appliances)                 │
│  • Taper adapter (EV charger)                               │
│  • Duty cycle adapter (refrigerator)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (PostgreSQL + Alembic)                 │
│  • System configuration (villa tier, limits)                │
│  • Device registry (9 device specs)                         │
│  • Power readings (row-per-tick history)                    │
│  • Alert history (overload warnings)                        │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+ 
- (Optional) PostgreSQL 14+ for production deployment

### Installation

```bash
# Clone repository
git clone https://github.com/4ryanMishra/RNTBCI-Digital-Twin.git
cd RNTBCI-Digital-Twin

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Run Mock Server (No Database Required)

```bash
# Start backend
python mock_server.py

# Server starts at http://localhost:8000
# API docs at http://localhost:8000/docs
# WebSocket at ws://localhost:8000/ws
```

### Run Production Server (With Database)

```bash
# Set up database connection
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run database migrations
alembic upgrade head

# Start backend
python api_server.py
```

### Test the System

```bash
# Backend tests
python test_phase3.py  # Digital twin core
python test_phase4.py  # Alert system
python test_phase5.py  # REST + WebSocket API
python test_phase6.py  # Application modules

# All tests should pass
```

### Start Frontend (Coming Soon)

```bash
cd frontend
npm install
npm run dev

# Frontend at http://localhost:5173
```

## 📊 Villa Tier Configuration

French homes typically have one of three electrical configurations:

| Tier | Phase | Voltage | Max Power | Max Current | Typical Home Size |
|------|-------|---------|-----------|-------------|-------------------|
| **Small** | Single | 230V | 6 kVA | 30A | Apartment, small house |
| **Medium** | Single | 230V | 9 kVA | 45A | Standard family home |
| **Large** | Three-phase | 400V | 18 kVA | 26A/phase | Large villa |

**Setup**: User selects tier on first launch. System enforces limits and fires alerts at 80%/95% thresholds.

## 🌐 API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health check + status |
| `/api/v1/system/setup` | POST | Initialize system (select tier) |
| `/api/v1/devices` | GET | List all 9 devices with current state |
| `/api/v1/devices/{id}` | GET | Get single device with Matter envelope |
| `/api/v1/devices/{id}/control` | POST | Control device (on/off, mode, power) |
| `/api/v1/system/power-budget` | GET | Current power draw + per-device breakdown |
| `/api/v1/modules/location` | GET | System configuration (tier, limits) |
| `/api/v1/modules/battery` | GET | EV battery SOC estimation |
| `/api/v1/modules/alert-history` | GET | Historical alerts |
| `/api/v1/modules/diagnostics` | GET | System diagnostics |
| `/api/v1/export/total-power` | GET | Download total power CSV |
| `/api/v1/export/appliance-power` | GET | Download per-device power CSV |

### WebSocket Events

**Client → Server**:
```json
{
  "type": "ping"
}
```

**Server → Client**:
```json
{
  "event": "power_reading",
  "totalWatts": 8245.5,
  "limitWatts": 9200.0,
  "utilisationPct": 89.6,
  "perDevice": [...]
}

{
  "event": "alert",
  "level": "critical",
  "message": "Power draw at 97% of limit"
}

{
  "event": "state_change",
  "deviceId": "evse_01",
  "operationalState": "on",
  "powerWatts": 7000.0
}
```

**Event Frequency**:
- `power_reading`: Every 2 seconds
- `state_change`: Immediately after device control
- `alert`: When threshold crossed (80%, 95%)
- `duty_cycle_toggle`: Refrigerator compressor cycles
- `soc_taper_update`: EV charging progress

### Interactive API Docs

Once the server is running, explore the full API at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🧪 Validation & Testing

### Power Calculation Accuracy

The system uses physics-correct formulas:

**Flat Power**:
```
P = 0W (off) or P_rated (on)
```

**EV Taper**:
```
P = 7000W                          (SOC < 80%)
P = 7000 × (100 - SOC) / 20        (SOC ≥ 80%)
```

**Refrigerator Duty Cycle**:
```
P = 150W (compressor on, 600s)
P = 5W   (compressor off, 300s)
```

### Test Coverage

- ✅ Device abstraction layer (3 power behaviors)
- ✅ Digital twin state management (live + history)
- ✅ Alert system (80%, 95% thresholds)
- ✅ REST API (17 endpoints)
- ✅ WebSocket events (5 event types)
- ✅ Application modules (4 modules)
- ✅ CSV export (total + per-device)

All tests run without database via mock server.

## 📁 Project Structure

```
RNTBCI-Digital-Twin/
├── api_server.py               # Production FastAPI server
├── mock_server.py              # Mock server (no database)
├── database.py                 # Database configuration
├── device_interface.py         # Device abstraction interface
├── device_registry.py          # 9 device specifications
├── simulation_adapter.py       # Power behavior adapters
├── live_state_store.py         # In-memory state management
├── history_store.py            # Database persistence
├── digital_twin_core.py        # Simulation engine
├── system_config_manager.py    # Configuration management
├── master_agent.py             # Alert detection system
├── ws_broadcaster.py           # WebSocket event broadcaster
├── tick_runner.py              # Background simulation loop
│
├── routers/                    # API route handlers
│   ├── devices.py              # Device endpoints
│   ├── system.py               # System endpoints
│   └── export.py               # Export endpoints
│
├── modules/                    # Application layer
│   ├── location_module.py      # System configuration
│   ├── battery_module.py       # Battery SOC estimation
│   ├── alert_history_module.py # Alert tracking
│   └── diagnostics_module.py   # System diagnostics
│
├── alembic/                    # Database migrations
│   └── versions/               # Migration files
│
├── frontend/                   # React + Three.js (in progress)
│   ├── src/
│   │   ├── three/              # 3D visualization
│   │   ├── components/         # React components
│   │   └── api/                # API client
│   └── package.json
│
├── test_phase3.py              # Digital twin tests
├── test_phase4.py              # Alert system tests
├── test_phase5.py              # API + WebSocket tests
├── test_phase6.py              # Application modules tests
│
├── requirements.txt            # Python dependencies
├── .env.example                # Database config template
├── alembic.ini                 # Alembic configuration
├── README.md                   # This file
└── DEVICE_VISUALS_MAPPING.md   # Frontend visual specs
```

## 🔧 Technology Stack

**Backend**:
- Python 3.11+ (FastAPI for REST API)
- PostgreSQL 14+ (time-series power data)
- SQLAlchemy 2.0 (ORM)
- Alembic (database migrations)
- WebSockets (real-time events)

**Frontend**:
- React 18 (UI framework)
- Three.js (3D visualization)
- TypeScript (type safety)
- Vite (build tool)

**Protocols**:
- Matter 1.2 (IoT device metadata)
- WebSocket (real-time communication)
- REST (device control, configuration)

## 🎓 Research Applications

### Academic Use
- Demonstrate EV charger impact on residential grids
- Validate load management algorithms
- Study consumer behavior under capacity constraints

### Industry Use
- Pre-installation planning for EV charger vendors
- Grid infrastructure planning for utility companies
- Consumer education for appliance manufacturers

### Policy Use
- Inform residential electrical code updates
- Analyze need for capacity upgrades in EV adoption zones
- Model demand response program effectiveness

## 🚧 Current Status & Roadmap

### ✅ Complete
- Backend API (REST + WebSocket)
- Digital twin simulation engine
- Alert system (80%, 95% thresholds)
- 9 device simulations (3 power behaviors)
- Matter protocol envelopes
- CSV/XLSX export
- Comprehensive test suite

### 🔄 In Progress
- 3D frontend visualization
- Device control UI
- Power monitoring dashboard

### 🎯 Future Enhancements
- Mobile app (iOS/Android)
- Historical trend analysis
- Multi-home management
- Solar panel integration
- Battery storage simulation
- Machine learning load prediction

## 📄 License

This project is a research demonstration. License: [To be determined]

## 👥 Contributors

- **Project Lead**: Aryan Mishra ([@4ryanMishra](https://github.com/4ryanMishra))
- **Development**: AI-assisted implementation

## 📞 Contact

- **GitHub**: https://github.com/4ryanMishra/RNTBCI-Digital-Twin
- **Issues**: https://github.com/4ryanMishra/RNTBCI-Digital-Twin/issues

---

## ⚠️ Disclaimer

This is a research and demonstration project. While power calculations are physics-accurate and based on realistic specifications, this system should **not** replace professional electrical engineering consultation for actual home installations. Always consult a licensed electrician before modifying your electrical system or installing an EV charger.

---

**Built with ⚡ to demonstrate the future of residential energy management**
