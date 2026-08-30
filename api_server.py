"""
Phase 5: REST + WebSocket API Server
FastAPI application — the Layer 5 boundary from MASTER_SPEC.md Part 2.

REST  → history, export, control commands (openapi.yaml)
WS    → live events, single multiplexed socket  (MASTER_SPEC.md Part 6)

Startup sequence:
  1. Build stores (live in-memory, history DB)
  2. Create SystemConfigManager + MasterAgent
  3. Create DigitalTwinCore; register all 9 simulated devices
  4. Inject singletons into routers via deps.set_globals()
  5. Start TickRunner background task

Decision A: no device is ever auto-throttled — enforced throughout.
Decision C: setup gate (409) on every power-aware endpoint.
Decision E: camelCase JSON payloads.
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal
from device_registry import get_all_devices
from digital_twin_core import DigitalTwinCore
from history_store import HistoryStore
from live_state_store import LiveStateStore
from master_agent import MasterAgent
from simulation_adapter import create_simulated_device
from system_config_manager import SystemConfigManager
from tick_runner import TickRunner
from ws_broadcaster import broadcaster

from modules.power_module import PowerModule
from modules.ev_battery_module import EvBatteryModule
from modules.location_module import LocationModule
from modules.device_health_module import DeviceHealthModule

import routers.deps as deps
from routers.system import router as system_router
from routers.devices import router as devices_router
from routers.modules_router import router as modules_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# App-level singletons (set during lifespan, read by routers via deps)
# ---------------------------------------------------------------------------
_tick_runner: TickRunner | None = None


# ---------------------------------------------------------------------------
# Lifespan (replaces deprecated @app.on_event)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup → yield → shutdown."""
    global _tick_runner

    logger.info("=== RNTBCI Digital Twin starting up ===")

    # 1. Stores
    live_store = LiveStateStore()
    history_store = HistoryStore(SessionLocal)

    # 2. Config + agent
    config_manager = SystemConfigManager(SessionLocal)
    master_agent = MasterAgent(config_manager, SessionLocal)

    # 3. Twin — register all 9 devices from registry
    twin = DigitalTwinCore(live_store, history_store)
    for spec in get_all_devices():
        device = create_simulated_device(
            device_id=spec["device_id"],
            device_type=spec["device_type"],
            power_behavior_type=spec["power_behavior_type"],
            rated_power_config=spec["rated_power_config"],
        )
        twin.register_device(device)

    logger.info("Registered %d devices", twin.get_device_count())

    # 4. Instantiate Layer 4 application modules
    power_module = PowerModule(twin, master_agent, SessionLocal)
    ev_module = EvBatteryModule(twin)
    location_module = LocationModule(config_manager, SessionLocal)
    health_module = DeviceHealthModule(twin)

    # 5. Inject into routers
    deps.set_globals(twin, config_manager, master_agent,
                     power_module, ev_module, location_module, health_module)

    # 6. Start tick runner
    _tick_runner = TickRunner(twin, config_manager, master_agent, broadcaster)
    _tick_runner.start()

    logger.info("=== Startup complete — listening ===")
    yield

    # Shutdown
    logger.info("=== Shutting down ===")
    if _tick_runner:
        _tick_runner.stop()
    for ws in list(broadcaster._clients):
        await ws.close()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="RNTBCI Home Digital Twin API",
    description=(
        "REST + WebSocket API for the RNTBCI household digital twin. "
        "9 appliances, physics-accurate power simulation, alert-only overload "
        "detection (Decision A). See openapi.yaml for full schema."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers under /api/v1
app.include_router(system_router, prefix="/api/v1")
app.include_router(devices_router, prefix="/api/v1")
app.include_router(modules_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# WebSocket endpoint — /ws
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """
    Single multiplexed WebSocket socket per MASTER_SPEC.md Part 6.

    On connect:
      → setup_incomplete  if villa tier not yet selected
      → setup_complete    if already configured

    Ongoing autonomous events (fired by TickRunner):
      → power_reading     every 2 s
      → duty_cycle_toggle on fridge compressor flip
      → soc_taper_update  on EVSE taper boundary crossing

    User-command events (fired by control endpoint):
      → state_change      immediate
      → alert             immediate (from MasterAgent)
    """
    config_manager: SystemConfigManager = deps.get_config_manager()
    await broadcaster.connect(ws)

    try:
        # Handshake: tell client whether setup is needed
        if config_manager.is_setup_complete():
            await broadcaster.emit_setup_complete(
                tier="(already configured)",
                contracted_power_kva=config_manager.get_contracted_power_kva() or 0.0,
                current_rating_a=config_manager.get_current_rating_a() or 0.0,
            )
        else:
            await broadcaster.emit_setup_incomplete(ws)

        # Keep connection alive; handle client pings
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "ping":
                        await ws.send_text(
                            json.dumps(
                                {
                                    "type": "pong",
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                }
                            )
                        )
                except (json.JSONDecodeError, KeyError):
                    pass  # Ignore malformed messages
            except asyncio.TimeoutError:
                # Send keepalive so the browser doesn't close the socket
                await ws.send_text(
                    json.dumps(
                        {
                            "type": "keepalive",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                )

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("WS error: %s", exc)
    finally:
        broadcaster.disconnect(ws)


# ---------------------------------------------------------------------------
# Health check — /health
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"])
def health() -> Dict[str, Any]:
    """Quick liveness probe."""
    config_manager: SystemConfigManager = deps.get_config_manager()
    return {
        "status": "ok",
        "setupComplete": config_manager.is_setup_complete(),
        "devicesRegistered": len(get_all_devices()),
        "wsClients": len(broadcaster._clients),
    }


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
