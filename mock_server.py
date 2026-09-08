"""
RNTBCI Digital Twin — Mock Server
==================================
Purpose: frontend development target. No database, no simulation engine.
         Runs standalone with `python mock_server.py` or
         `uvicorn mock_server:app --reload --port 8000`

What it provides:
  • Every REST endpoint the real server exposes (same URL, same JSON shape)
  • A WebSocket at ws://localhost:8000/ws that fires all 6 Part-6 events
    on a realistic schedule so the frontend can wire animations immediately
  • Stateful in-memory device store so control commands actually change state
    and the next GET reflects the change
  • Full example payloads for every control type (documented inline)
  • CSV + XLSX export endpoints with synthetic power-history data
  • POST /api/v1/devices/add  — device-onboarding endpoint

Decision A is enforced here too: no endpoint auto-throttles anything.
Alert events are fired by the mock's background task when simulated load
exceeds thresholds, but no device state is changed as a result.

Base URLs (dev):
  REST  →  http://localhost:8000/api/v1
  WS    →  ws://localhost:8000/ws
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import math
import random
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ts_ago(seconds: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(seconds=seconds)).isoformat()


# ---------------------------------------------------------------------------
# In-memory device state store
# All 9 devices — values match MASTER_SPEC.md Part 3 rated powers exactly.
# ---------------------------------------------------------------------------

_DEVICES: Dict[str, Dict[str, Any]] = {
    "evse_01": {
        "device_id": "evse_01",
        "device_type": "evse",
        "operational_state": "off",
        "rated_power_watts": 7000.0,
        "current_power_watts": 0.0,
        "state_of_charge_percent": 62.0,
        "is_tapering": False,
        "taper_start_soc_percent": 80.0,
        "is_charging": False,
    },
    "light_01": {
        "device_id": "light_01",
        "device_type": "light",
        "operational_state": "off",
        "on": False,
        "level": 254,          # Matter Level Control (0–254)
        "power_watts": 0.0,
    },
    "dishwasher_01": {
        "device_id": "dishwasher_01",
        "device_type": "dishwasher",
        "operational_state": "off",
        "mode": "Normal",
        "power_watts": 0.0,
        "target_temperature_celsius": None,
    },
    "washing_machine_01": {
        "device_id": "washing_machine_01",
        "device_type": "washing_machine",
        "operational_state": "off",
        "mode": "Normal",
        "power_watts": 0.0,
        "target_temperature_celsius": None,
    },
    "water_heater_01": {
        "device_id": "water_heater_01",
        "device_type": "water_heater",
        "operational_state": "off",
        "mode": "Normal",
        "power_watts": 0.0,
        "target_temperature_celsius": 55.0,
    },
    "heat_pump_01": {
        "device_id": "heat_pump_01",
        "device_type": "heat_pump",
        "operational_state": "off",
        "mode": "Heat",
        "power_watts": 0.0,
        "target_temperature_celsius": 21.0,
    },
    "cctv_01": {
        "device_id": "cctv_01",
        "device_type": "cctv",
        "operational_state": "running",   # always-on
        "streaming": True,
        "recording": True,
        "power_watts": 10.0,
    },
    "microwave_01": {
        "device_id": "microwave_01",
        "device_type": "microwave",
        "operational_state": "off",
        "mode": "Cook",
        "cook_time_seconds_remaining": 0,
        "power_level_percent": 100,
        "power_watts": 0.0,
    },
    "refrigerator_01": {
        "device_id": "refrigerator_01",
        "device_type": "refrigerator",
        "operational_state": "running",   # always-on
        "mode": "Normal",
        "compressor_on": True,
        "current_temperature_celsius": 4.0,
        "target_temperature_celsius": 4.0,
        "power_watts": 150.0,             # rated draw when compressor on
        "cycle_on_duration_seconds": 600,
        "cycle_off_duration_seconds": 300,
        "door_open": False,
    },
}

# Rated powers used when turning devices on (W)
_RATED_POWER: Dict[str, float] = {
    "light_01":           15.0,
    "dishwasher_01":    1500.0,
    "washing_machine_01": 2200.0,
    "water_heater_01":  2200.0,
    "heat_pump_01":     4000.0,
    "cctv_01":            10.0,
    "microwave_01":     1200.0,
    "refrigerator_01":   150.0,
    "evse_01":          7000.0,
}

# System config (villa tier)
_SYSTEM_CONFIG: Dict[str, Any] = {
    "configured": False,
    "tier": None,
    "contracted_power_kva": None,
    "current_rating_a": None,
}

_VILLA_TIERS = {
    "small":  {"contracted_power_kva": 6.0,  "current_rating_a": 30.0,  "phase_config": "single_phase", "voltage_v": 230},
    "medium": {"contracted_power_kva": 9.2,  "current_rating_a": 40.0,  "phase_config": "single_phase", "voltage_v": 230},
    "large":  {"contracted_power_kva": 18.4, "current_rating_a": 26.0,  "phase_config": "three_phase",  "voltage_v": 400},
}

# Active alerts list
_ALERTS: List[Dict[str, Any]] = []
_ALERT_ID = 0

# Connected WebSocket clients
_WS_CLIENTS: List[WebSocket] = []


# ---------------------------------------------------------------------------
# WebSocket broadcast helpers
# ---------------------------------------------------------------------------

async def _broadcast(payload: Dict[str, Any]) -> None:
    dead = []
    msg = json.dumps(payload)
    for ws in list(_WS_CLIENTS):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in _WS_CLIENTS:
            _WS_CLIENTS.remove(ws)


async def _emit_state_change(device_id: str) -> None:
    d = _DEVICES[device_id]
    await _broadcast({
        "event": "state_change",
        "timestamp": _now(),
        "deviceId": device_id,
        "data": {
            "operationalState": d["operational_state"],
            "powerWatts": d.get("power_watts", d.get("current_power_watts", 0.0)),
            "metadata": {k: v for k, v in d.items()
                         if k not in ("device_id", "device_type")},
        },
    })


async def _emit_alert(severity: str, message: str,
                      total_watts: float, limit_watts: float) -> None:
    global _ALERT_ID
    _ALERT_ID += 1
    alert = {
        "id": str(_ALERT_ID),
        "severity": severity,
        "message": message,
        "total_draw_watts": round(total_watts, 1),
        "limit_watts": round(limit_watts, 1),
        "raised_at": _now(),
    }
    _ALERTS.append(alert)
    await _broadcast({"event": "alert", "timestamp": _now(), "data": alert})


# ---------------------------------------------------------------------------
# Background simulation task
# Drives: EVSE SOC, fridge duty-cycle, power_reading every 2 s, alerts
# ---------------------------------------------------------------------------

async def _simulation_loop() -> None:
    """
    Runs forever in the background while the server is up.
    Advances mock physics and fires WS events on the correct schedule.
    """
    tick = 0
    fridge_phase_elapsed = 0.0   # seconds in current compressor phase
    evse_last_soc = _DEVICES["evse_01"]["state_of_charge_percent"]

    while True:
        await asyncio.sleep(1.0)
        tick += 1

        # --- EVSE SOC advance (while charging) ---
        evse = _DEVICES["evse_01"]
        if evse["operational_state"] == "running":
            soc = evse["state_of_charge_percent"]
            power = evse["current_power_watts"]
            # 60 kWh battery; 1 tick = 1 s
            delta_soc = (power / 1000.0) / (3600.0) / 60.0 * 100.0
            new_soc = min(100.0, soc + delta_soc)
            was_tapering = evse["is_tapering"]
            is_tapering = new_soc >= evse["taper_start_soc_percent"]

            if is_tapering:
                # Linear taper: rated → 0 W over final 20% SOC
                taper_range = 100.0 - evse["taper_start_soc_percent"]
                progress = (new_soc - evse["taper_start_soc_percent"]) / taper_range
                power = max(0.0, evse["rated_power_watts"] * (1.0 - progress))

            evse["state_of_charge_percent"] = round(new_soc, 2)
            evse["current_power_watts"] = round(power, 1)
            evse["is_tapering"] = is_tapering
            evse["is_charging"] = True

            # Auto-stop at 100 %
            if new_soc >= 100.0:
                evse["operational_state"] = "off"
                evse["current_power_watts"] = 0.0
                evse["is_charging"] = False
                await _emit_state_change("evse_01")

            # Taper boundary crossing event
            elif is_tapering != was_tapering:
                await _broadcast({
                    "event": "soc_taper_update",
                    "timestamp": _now(),
                    "deviceId": "evse_01",
                    "data": {
                        "socPercent": round(new_soc, 2),
                        "powerWatts": round(power, 1),
                        "enteredTaper": is_tapering,
                    },
                })

        # --- Refrigerator duty-cycle ---
        fridge = _DEVICES["refrigerator_01"]
        if fridge["operational_state"] == "running":
            fridge_phase_elapsed += 1.0
            compressor_on = fridge["compressor_on"]
            phase_limit = (fridge["cycle_on_duration_seconds"]
                           if compressor_on
                           else fridge["cycle_off_duration_seconds"])

            if fridge_phase_elapsed >= phase_limit:
                fridge_phase_elapsed = 0.0
                new_compressor = not compressor_on
                fridge["compressor_on"] = new_compressor
                fridge["power_watts"] = _RATED_POWER["refrigerator_01"] if new_compressor else 5.0
                await _broadcast({
                    "event": "duty_cycle_toggle",
                    "timestamp": _now(),
                    "deviceId": "refrigerator_01",
                    "data": {
                        "compressorOn": new_compressor,
                        "powerWatts": fridge["power_watts"],
                    },
                })

        # --- power_reading every 2 ticks ---
        if tick % 2 == 0 and _SYSTEM_CONFIG["configured"]:
            total = sum(
                d.get("power_watts", d.get("current_power_watts", 0.0))
                for d in _DEVICES.values()
            )
            limit_kva = _SYSTEM_CONFIG["contracted_power_kva"] or 9.2
            limit_w = limit_kva * 1000.0
            ratio = total / limit_w

            bstatus = "ok"
            if ratio >= 0.95:
                bstatus = "critical"
            elif ratio >= 0.80:
                bstatus = "warning"

            await _broadcast({
                "event": "power_reading",
                "timestamp": _now(),
                "data": {
                    "totalDrawWatts": round(total, 1),
                    "limitWatts": round(limit_w, 1),
                    "status": bstatus,
                    "perDevice": [
                        {
                            "deviceId": did,
                            "watts": round(
                                d.get("power_watts", d.get("current_power_watts", 0.0)), 1
                            ),
                        }
                        for did, d in _DEVICES.items()
                    ],
                },
            })

            # Alert thresholds (Decision A: alert-only, no throttle)
            if ratio >= 0.95 and (not _ALERTS or _ALERTS[-1]["severity"] != "critical"):
                await _emit_alert(
                    "critical",
                    f"Household load {round(total/1000,2)} kW exceeds 95% of "
                    f"{round(limit_w/1000,2)} kW limit. Reduce load manually.",
                    total, limit_w,
                )
            elif 0.80 <= ratio < 0.95 and (not _ALERTS or _ALERTS[-1]["severity"] == "ok"):
                await _emit_alert(
                    "warning",
                    f"Household load {round(total/1000,2)} kW at 80%+ of "
                    f"{round(limit_w/1000,2)} kW limit.",
                    total, limit_w,
                )


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_simulation_loop(), name="mock_sim")
    yield
    task.cancel()


app = FastAPI(
    title="RNTBCI Mock Server",
    description="Frontend development mock — no database required. "
                "Same URLs and JSON shapes as the real server.",
    version="1.0.0-mock",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================================================
# SYSTEM ENDPOINTS
# ===========================================================================

# ---------------------------------------------------------------------------
# POST /api/v1/system/setup
# ---------------------------------------------------------------------------
# Example request:
#   POST /api/v1/system/setup
#   { "tier": "medium" }
#
# Example response:
#   {
#     "status": "configured",
#     "tier": "medium",
#     "contractedPowerKva": 9.2,
#     "currentRatingA": 40.0,
#     "phaseConfig": "single_phase",
#     "voltageV": 230
#   }
# ---------------------------------------------------------------------------

class SetupRequest(BaseModel):
    tier: str = Field(..., description="small | medium | large")


@app.post("/api/v1/system/setup")
async def setup_system(body: SetupRequest):
    if body.tier not in _VILLA_TIERS:
        raise HTTPException(400, f"Unknown tier '{body.tier}'. Valid: small, medium, large")
    preset = _VILLA_TIERS[body.tier]
    _SYSTEM_CONFIG.update({
        "configured": True,
        "tier": body.tier,
        **preset,
    })
    resp = {
        "status": "configured",
        "tier": body.tier,
        "contractedPowerKva": preset["contracted_power_kva"],
        "currentRatingA": preset["current_rating_a"],
        "phaseConfig": preset["phase_config"],
        "voltageV": preset["voltage_v"],
    }
    await _broadcast({"event": "setup_complete", "timestamp": _now(), "data": resp})
    return resp


# ---------------------------------------------------------------------------
# GET /api/v1/system/power-budget
# ---------------------------------------------------------------------------
# Example response (medium tier, EVSE + fridge + light running):
#   {
#     "totalDrawWatts": 7165.0,
#     "limitWatts": 9200.0,
#     "status": "warning",           ← reporting only, Decision A
#     "utilisationPct": 77.9,
#     "perDevice": [
#       { "deviceId": "evse_01",       "watts": 7000.0 },
#       { "deviceId": "refrigerator_01","watts": 150.0 },
#       { "deviceId": "light_01",       "watts": 15.0  },
#       ...
#     ]
#   }
# ---------------------------------------------------------------------------

@app.get("/api/v1/system/power-budget")
def power_budget():
    _require_setup()
    total = sum(
        d.get("power_watts", d.get("current_power_watts", 0.0))
        for d in _DEVICES.values()
    )
    limit_kva = _SYSTEM_CONFIG["contracted_power_kva"]
    limit_w = limit_kva * 1000.0
    ratio = total / limit_w if limit_w else 0
    bstatus = "critical" if ratio >= 0.95 else "warning" if ratio >= 0.80 else "ok"
    return {
        "totalDrawWatts": round(total, 1),
        "limitWatts": round(limit_w, 1),
        "status": bstatus,
        "utilisationPct": round(ratio * 100, 1),
        "perDevice": [
            {
                "deviceId": did,
                "watts": round(d.get("power_watts", d.get("current_power_watts", 0.0)), 1),
            }
            for did, d in _DEVICES.items()
        ],
    }


# ---------------------------------------------------------------------------
# GET /api/v1/system/alerts
# ---------------------------------------------------------------------------
# Example response:
#   [
#     {
#       "id": "1",
#       "severity": "warning",
#       "message": "Household load 7.37 kW at 80%+ of 9.2 kW limit.",
#       "total_draw_watts": 7365.0,
#       "limit_watts": 9200.0,
#       "raised_at": "2026-08-30T14:22:01Z"
#     }
#   ]
# NOTE: alerts are informational only. No device was turned off.
# ---------------------------------------------------------------------------

@app.get("/api/v1/system/alerts")
def get_alerts(limit: int = Query(20, le=100)):
    _require_setup()
    return list(reversed(_ALERTS))[:limit]


# ---------------------------------------------------------------------------
# GET /api/v1/system/export   — CSV or XLSX power history
# ---------------------------------------------------------------------------
# Columns: device_id, timestamp, power_watts
#
# Example: GET /api/v1/system/export?format=csv
#   device_id,timestamp,power_watts
#   evse_01,2026-08-30T14:00:00+00:00,7000.0
#   evse_01,2026-08-30T14:00:01+00:00,7000.0
#   refrigerator_01,2026-08-30T14:00:00+00:00,150.0
#   ...
#
# Example: GET /api/v1/system/export?format=csv&device_id=evse_01
#   → same columns, only rows for evse_01
#
# Example: GET /api/v1/system/export?format=csv&from=2026-08-30T14:00:00Z&to=2026-08-30T14:05:00Z
#   → rows in that time window only
# ---------------------------------------------------------------------------

@app.get("/api/v1/system/export")
def export_history(
    format: str = Query("csv", description="csv or xlsx"),
    device_id: Optional[str] = Query(None),
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    limit: int = Query(500, le=10000),
):
    _require_setup()
    fmt = format.lower()
    if fmt not in ("csv", "xlsx"):
        raise HTTPException(400, "format must be csv or xlsx")

    # Generate synthetic history rows (300 ticks = 5 min of 1-s data)
    rows = _generate_history_rows(device_id=device_id, n_ticks=min(limit, 300))

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["device_id", "timestamp", "power_watts"])
        for r in rows:
            writer.writerow([r["device_id"], r["timestamp"], r["power_watts"]])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=power_readings.csv"},
        )
    else:
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(501, "openpyxl not installed: pip install openpyxl")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "power_readings"
        ws.append(["device_id", "timestamp", "power_watts"])
        for r in rows:
            ws.append([r["device_id"], r["timestamp"], r["power_watts"]])
        buf_bytes = io.BytesIO()
        wb.save(buf_bytes)
        buf_bytes.seek(0)
        return StreamingResponse(
            iter([buf_bytes.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=power_readings.xlsx"},
        )


def _generate_history_rows(device_id: Optional[str], n_ticks: int) -> List[Dict]:
    """Synthetic power history: realistic values per device over n_ticks seconds."""
    rows = []
    device_ids = [device_id] if device_id else list(_DEVICES.keys())
    base_time = datetime.now(timezone.utc) - timedelta(seconds=n_ticks)

    for i in range(n_ticks):
        ts = (base_time + timedelta(seconds=i)).isoformat()
        for did in device_ids:
            d = _DEVICES[did]
            base_power = d.get("power_watts", d.get("current_power_watts", 0.0))

            # Fridge duty-cycle: on for 600 s, off for 300 s
            if did == "refrigerator_01":
                cycle_pos = i % 900
                base_power = 150.0 if cycle_pos < 600 else 5.0

            # EVSE taper: flat until 80% SOC then taper
            elif did == "evse_01" and d["operational_state"] == "running":
                soc = d["state_of_charge_percent"]
                synthetic_soc = min(100.0, soc + (i / n_ticks) * 15.0)
                if synthetic_soc >= 80.0:
                    progress = (synthetic_soc - 80.0) / 20.0
                    base_power = max(0.0, 7000.0 * (1.0 - progress))
                else:
                    base_power = 7000.0

            rows.append({
                "device_id": did,
                "timestamp": ts,
                "power_watts": round(base_power, 2),
            })
    return rows


# ===========================================================================
# DEVICE ENDPOINTS — GET state
# ===========================================================================

@app.get("/api/v1/devices")
def list_devices():
    return {
        "devices": [
            {
                "deviceId": d["device_id"],
                "deviceType": d["device_type"],
                "operationalState": d["operational_state"],
                "powerWatts": round(
                    d.get("power_watts", d.get("current_power_watts", 0.0)), 1
                ),
            }
            for d in _DEVICES.values()
        ]
    }


@app.get("/api/v1/devices/{device_id}")
def get_device(device_id: str):
    d = _get_device_or_404(device_id)
    return _matter_envelope(d)


# ===========================================================================
# DEVICE CONTROL ENDPOINTS
# Each device type has its own documented example payload below.
# ===========================================================================

class ControlRequest(BaseModel):
    action: str
    parameters: Optional[Dict[str, Any]] = None


@app.post("/api/v1/devices/{device_id}/control")
async def control_device(device_id: str, body: ControlRequest):
    _require_setup()
    d = _get_device_or_404(device_id)
    dtype = d["device_type"]
    params = body.parameters or {}

    # -----------------------------------------------------------------------
    # EVSE
    # -----------------------------------------------------------------------
    # ► Start charging (default power):
    #   POST /api/v1/devices/evse_01/control
    #   { "action": "start" }
    #
    # ► Start charging with custom power (slider — 1400 W to 7400 W):
    #   { "action": "start", "parameters": { "targetPowerWatts": 3500 } }
    #
    # ► Stop charging:
    #   { "action": "stop" }
    #
    # Response (EvseState Matter envelope):
    #   {
    #     "device_id": "evse_01",
    #     "device_type": "evse",
    #     "clusters": {
    #       "OnOff": { "attributes": { "OnOff": true } },
    #       "ElectricalPowerMeasurement": { "attributes": { "ActivePower": 3500.0 } },
    #       "EnergyEvse": {
    #         "attributes": {
    #           "StateOfCharge": 62.0,
    #           "IsTapering": false,
    #           "TaperStartSocPercent": 80.0,
    #           "RatedPowerWatts": 7000.0,
    #           "IsCharging": true
    #         }
    #       }
    #     },
    #     "meta": { "timestamp": "...", "operational_state": "running" }
    #   }
    # -----------------------------------------------------------------------
    if dtype == "evse":
        if body.action == "start":
            target = params.get("targetPowerWatts", d["rated_power_watts"])
            target = max(1400.0, min(7400.0, float(target)))
            d["operational_state"] = "running"
            d["current_power_watts"] = target
            d["is_charging"] = True
        elif body.action == "stop":
            d["operational_state"] = "off"
            d["current_power_watts"] = 0.0
            d["is_charging"] = False
        else:
            raise HTTPException(400, f"EVSE: unknown action '{body.action}'. Valid: start, stop")

    # -----------------------------------------------------------------------
    # LIGHT (OnOff Plug-in Unit)
    # -----------------------------------------------------------------------
    # ► Turn on:
    #   { "action": "on" }
    #
    # ► Turn off:
    #   { "action": "off" }
    #
    # ► Set brightness (level slider, Matter 0–254):
    #   { "action": "set_level", "parameters": { "level": 128 } }
    #   NOTE: setting level implicitly turns the light on.
    #
    # Response (LightState Matter envelope):
    #   {
    #     "device_id": "light_01",
    #     "device_type": "light",
    #     "clusters": {
    #       "OnOff": { "attributes": { "OnOff": true } },
    #       "ElectricalPowerMeasurement": { "attributes": { "ActivePower": 15.0 } },
    #       "LevelControl": { "attributes": { "CurrentLevel": 128 } }
    #     },
    #     "meta": { "timestamp": "...", "operational_state": "on" }
    #   }
    # -----------------------------------------------------------------------
    elif dtype == "light":
        if body.action == "on":
            d["on"] = True
            d["operational_state"] = "on"
            d["power_watts"] = _RATED_POWER["light_01"]
        elif body.action == "off":
            d["on"] = False
            d["operational_state"] = "off"
            d["power_watts"] = 0.0
        elif body.action == "set_level":
            level = int(params.get("level", 254))
            level = max(0, min(254, level))
            d["level"] = level
            d["on"] = level > 0
            d["operational_state"] = "on" if level > 0 else "off"
            d["power_watts"] = _RATED_POWER["light_01"] if level > 0 else 0.0
        else:
            raise HTTPException(400, f"Light: unknown action '{body.action}'. Valid: on, off, set_level")

    # -----------------------------------------------------------------------
    # GENERIC APPLIANCES: dishwasher, washing_machine, water_heater, heat_pump
    # -----------------------------------------------------------------------
    # ► Start (default or named mode):
    #   { "action": "start" }
    #   { "action": "start", "parameters": { "mode": "Eco" } }
    #
    # ► Start with target temperature (water_heater / heat_pump):
    #   { "action": "start", "parameters": { "mode": "Eco", "targetTemperatureCelsius": 50 } }
    #
    # ► Stop:
    #   { "action": "stop" }
    #
    # ► Pause (mid-cycle — dishwasher / washing_machine):
    #   { "action": "pause" }
    #
    # Valid modes per device:
    #   dishwasher:       Normal | Eco | Intensive | Quick
    #   washing_machine:  Normal | Eco | Quick | Delicate
    #   water_heater:     Normal | Eco | Boost
    #   heat_pump:        Heat | Cool | Auto | Off
    #
    # Response (ApplianceState Matter envelope):
    #   {
    #     "device_id": "dishwasher_01",
    #     "device_type": "dishwasher",
    #     "clusters": {
    #       "OnOff": { "attributes": { "OnOff": true } },
    #       "ElectricalPowerMeasurement": { "attributes": { "ActivePower": 1500.0 } }
    #     },
    #     "meta": {
    #       "timestamp": "...",
    #       "operational_state": "running",
    #       "mode": "Eco"
    #     }
    #   }
    # -----------------------------------------------------------------------
    elif dtype in ("dishwasher", "washing_machine", "water_heater", "heat_pump"):
        if body.action == "start":
            d["operational_state"] = "running"
            d["power_watts"] = _RATED_POWER[device_id]
            if "mode" in params:
                d["mode"] = params["mode"]
            if "targetTemperatureCelsius" in params:
                d["target_temperature_celsius"] = params["targetTemperatureCelsius"]
        elif body.action == "stop":
            d["operational_state"] = "off"
            d["power_watts"] = 0.0
        elif body.action == "pause":
            if dtype not in ("dishwasher", "washing_machine"):
                raise HTTPException(400, f"{dtype}: pause not supported")
            d["operational_state"] = "idle"
            d["power_watts"] = 0.0
        else:
            raise HTTPException(
                400, f"{dtype}: unknown action '{body.action}'. Valid: start, stop, pause"
            )

    # -----------------------------------------------------------------------
    # CCTV
    # -----------------------------------------------------------------------
    # ► Toggle streaming on/off:
    #   { "action": "set_streaming", "parameters": { "streaming": false } }
    #
    # ► Toggle recording on/off:
    #   { "action": "set_recording", "parameters": { "recording": false } }
    #
    # NOTE: CCTV is always-on (power never drops to 0). These commands only
    # change the streaming/recording flags, not the device power state.
    #
    # Response:
    #   {
    #     "device_id": "cctv_01",
    #     "device_type": "cctv",
    #     "clusters": {
    #       "OnOff": { "attributes": { "OnOff": true } },
    #       "ElectricalPowerMeasurement": { "attributes": { "ActivePower": 10.0 } },
    #       "CameraAvStreamManagement": {
    #         "attributes": { "StreamingEnabled": false, "RecordingEnabled": true }
    #       }
    #     },
    #     "meta": { "timestamp": "...", "operational_state": "running" }
    #   }
    # -----------------------------------------------------------------------
    elif dtype == "cctv":
        if body.action == "set_streaming":
            d["streaming"] = bool(params.get("streaming", True))
        elif body.action == "set_recording":
            d["recording"] = bool(params.get("recording", True))
        else:
            raise HTTPException(
                400, f"CCTV: unknown action '{body.action}'. Valid: set_streaming, set_recording"
            )

    # -----------------------------------------------------------------------
    # MICROWAVE
    # -----------------------------------------------------------------------
    # ► Start cook:
    #   { "action": "start",
    #     "parameters": {
    #       "mode": "Cook",            ← Cook | Defrost | Reheat
    #       "cookTimeSeconds": 120,    ← 1–3600
    #       "powerLevelPercent": 80    ← 10–100
    #     }
    #   }
    #
    # ► Stop:
    #   { "action": "stop" }
    #
    # Response:
    #   {
    #     "device_id": "microwave_01",
    #     "device_type": "microwave",
    #     "clusters": {
    #       "OnOff": { "attributes": { "OnOff": true } },
    #       "ElectricalPowerMeasurement": { "attributes": { "ActivePower": 1200.0 } },
    #       "MicrowaveOvenControl": {
    #         "attributes": {
    #           "CookTimerRemainingS": 120,
    #           "PowerLevelPercent": 80
    #         }
    #       }
    #     },
    #     "meta": { "timestamp": "...", "operational_state": "running" }
    #   }
    # -----------------------------------------------------------------------
    elif dtype == "microwave":
        if body.action == "start":
            d["operational_state"] = "running"
            d["power_watts"] = _RATED_POWER["microwave_01"]
            d["mode"] = params.get("mode", "Cook")
            d["cook_time_seconds_remaining"] = int(params.get("cookTimeSeconds", 60))
            d["power_level_percent"] = int(params.get("powerLevelPercent", 100))
        elif body.action == "stop":
            d["operational_state"] = "off"
            d["power_watts"] = 0.0
            d["cook_time_seconds_remaining"] = 0
        else:
            raise HTTPException(400, f"Microwave: unknown action '{body.action}'. Valid: start, stop")

    # -----------------------------------------------------------------------
    # REFRIGERATOR
    # -----------------------------------------------------------------------
    # NOTE: the fridge is always-on. These commands adjust mode/temp only.
    # You cannot turn the fridge off via the API.
    #
    # ► Set mode:
    #   { "action": "set_mode", "parameters": { "mode": "Eco" } }
    #   Valid modes: Normal | Eco | Rapid Cool
    #
    # ► Set target temperature:
    #   { "action": "set_temperature",
    #     "parameters": { "targetTemperatureCelsius": 2 } }
    #
    # Response:
    #   {
    #     "device_id": "refrigerator_01",
    #     "device_type": "refrigerator",
    #     "clusters": {
    #       "OnOff": { "attributes": { "OnOff": true } },
    #       "ElectricalPowerMeasurement": { "attributes": { "ActivePower": 150.0 } },
    #       "RefrigeratorAndTemperatureControlledCabinetMode": {
    #         "attributes": {
    #           "CompressorOn": true,
    #           "CycleOnDurationS": 600,
    #           "CycleOffDurationS": 300,
    #           "TimeInCurrentPhaseS": 42.0
    #         }
    #       }
    #     },
    #     "meta": {
    #       "timestamp": "...",
    #       "operational_state": "running",
    #       "mode": "Eco",
    #       "target_temperature_celsius": 2
    #     }
    #   }
    # -----------------------------------------------------------------------
    elif dtype == "refrigerator":
        if body.action == "set_mode":
            d["mode"] = params.get("mode", d["mode"])
        elif body.action == "set_temperature":
            d["target_temperature_celsius"] = float(
                params.get("targetTemperatureCelsius", d["target_temperature_celsius"])
            )
        else:
            raise HTTPException(
                400,
                f"Refrigerator: unknown action '{body.action}'. "
                "Valid: set_mode, set_temperature"
            )

    await _emit_state_change(device_id)
    return _matter_envelope(d)


# ===========================================================================
# ADD DEVICE  — POST /api/v1/devices/add
# ===========================================================================
# Onboards a new device into the digital twin.
#
# Example request (adding a second smart light):
#   POST /api/v1/devices/add
#   {
#     "deviceId":          "light_02",
#     "deviceType":        "light",
#     "displayName":       "Kitchen Light",
#     "powerBehaviorType": "flat",
#     "ratedPowerWatts":   15.0,
#     "ratedPowerConfig": {
#       "rated_power_watts": 15.0
#     }
#   }
#
# Example request (adding another EVSE):
#   {
#     "deviceId":          "evse_02",
#     "deviceType":        "evse",
#     "displayName":       "Garage Charger",
#     "powerBehaviorType": "taper",
#     "ratedPowerWatts":   11000.0,
#     "ratedPowerConfig": {
#       "rated_power_watts":     11000.0,
#       "taper_start_soc_pct":   80,
#       "taper_curve":           "linear"
#     }
#   }
#
# Example response:
#   {
#     "status": "registered",
#     "deviceId": "light_02",
#     "deviceType": "light",
#     "displayName": "Kitchen Light",
#     "operationalState": "off",
#     "powerWatts": 0.0,
#     "message": "Device light_02 registered. Simulation adapter created."
#   }
#
# Error — duplicate ID:
#   HTTP 409  { "detail": "Device 'light_02' already registered." }
#
# Error — unsupported device type:
#   HTTP 400  { "detail": "Unknown deviceType 'toaster'. Supported: evse, light,
#                           dishwasher, washing_machine, water_heater, heat_pump,
#                           cctv, microwave, refrigerator" }
# ===========================================================================

_SUPPORTED_DEVICE_TYPES = {
    "evse", "light", "dishwasher", "washing_machine",
    "water_heater", "heat_pump", "cctv", "microwave", "refrigerator",
}


class AddDeviceRequest(BaseModel):
    deviceId: str = Field(..., description="Unique device ID, e.g. 'light_02'")
    deviceType: str = Field(..., description="One of the 9 supported device types")
    displayName: str = Field(..., description="Human-readable name shown in the 3D scene")
    powerBehaviorType: str = Field(..., description="flat | taper | duty_cycle")
    ratedPowerWatts: float = Field(..., description="Rated power in watts")
    ratedPowerConfig: Dict[str, Any] = Field(
        default_factory=dict,
        description="Device-type-specific config (taper_start_soc_pct, cycle_on_s, etc.)"
    )


@app.post("/api/v1/devices/add", status_code=201)
async def add_device(body: AddDeviceRequest):
    if body.deviceId in _DEVICES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Device '{body.deviceId}' already registered."
        )
    if body.deviceType not in _SUPPORTED_DEVICE_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown deviceType '{body.deviceType}'. Supported: "
            + ", ".join(sorted(_SUPPORTED_DEVICE_TYPES))
        )

    # Build initial state for the new device
    new_device: Dict[str, Any] = {
        "device_id": body.deviceId,
        "device_type": body.deviceType,
        "display_name": body.displayName,
        "operational_state": "running" if body.deviceType in ("cctv", "refrigerator") else "off",
        "power_watts": body.ratedPowerWatts if body.deviceType in ("cctv", "refrigerator") else 0.0,
    }
    # Merge type-specific fields
    if body.deviceType == "evse":
        new_device.update({
            "rated_power_watts": body.ratedPowerWatts,
            "current_power_watts": 0.0,
            "state_of_charge_percent": 50.0,
            "is_tapering": False,
            "taper_start_soc_percent": body.ratedPowerConfig.get("taper_start_soc_pct", 80),
            "is_charging": False,
        })
    elif body.deviceType == "refrigerator":
        new_device.update({
            "compressor_on": True,
            "current_temperature_celsius": 4.0,
            "target_temperature_celsius": 4.0,
            "cycle_on_duration_seconds": body.ratedPowerConfig.get("cycle_on_s", 600),
            "cycle_off_duration_seconds": body.ratedPowerConfig.get("cycle_off_s", 300),
            "door_open": False,
        })

    _DEVICES[body.deviceId] = new_device
    _RATED_POWER[body.deviceId] = body.ratedPowerWatts

    resp = {
        "status": "registered",
        "deviceId": body.deviceId,
        "deviceType": body.deviceType,
        "displayName": body.displayName,
        "operationalState": new_device["operational_state"],
        "powerWatts": new_device["power_watts"],
        "message": f"Device {body.deviceId} registered. Simulation adapter created.",
    }
    await _broadcast({"event": "device_added", "timestamp": _now(), "data": resp})
    return resp


# ===========================================================================
# MODULE ENDPOINTS
# ===========================================================================

@app.get("/api/v1/modules/location")
def location():
    if not _SYSTEM_CONFIG["configured"]:
        return {
            "setupComplete": False,
            "tier": None, "phaseConfig": None,
            "voltageV": None, "contractedPowerKva": None, "currentRatingA": None,
        }
    preset = _VILLA_TIERS[_SYSTEM_CONFIG["tier"]]
    return {
        "setupComplete": True,
        "tier": _SYSTEM_CONFIG["tier"],
        "phaseConfig": preset["phase_config"],
        "voltageV": preset["voltage_v"],
        "contractedPowerKva": preset["contracted_power_kva"],
        "currentRatingA": preset["current_rating_a"],
    }


@app.get("/api/v1/modules/power/summary")
def power_summary():
    _require_setup()
    total = sum(
        d.get("power_watts", d.get("current_power_watts", 0.0)) for d in _DEVICES.values()
    )
    limit_w = (_SYSTEM_CONFIG["contracted_power_kva"] or 9.2) * 1000.0
    ratio = total / limit_w if limit_w else 0
    return {
        "totalWatts": round(total, 1),
        "limitWatts": round(limit_w, 1),
        "budgetStatus": "critical" if ratio >= 0.95 else "warning" if ratio >= 0.80 else "ok",
        "utilisationPct": round(ratio * 100, 1),
        "perDevice": [
            {
                "deviceId": did,
                "deviceType": d["device_type"],
                "operationalState": d["operational_state"],
                "powerWatts": round(d.get("power_watts", d.get("current_power_watts", 0.0)), 1),
            }
            for did, d in _DEVICES.items()
        ],
    }


@app.get("/api/v1/modules/ev/session")
def ev_session():
    _require_setup()
    evse = _DEVICES["evse_01"]
    soc = evse["state_of_charge_percent"]
    power = evse["current_power_watts"]
    minutes_to_full = None
    if power > 0 and soc < 100:
        remaining_kwh = 60.0 * (100.0 - soc) / 100.0
        minutes_to_full = round((remaining_kwh / (power / 1000.0)) * 60.0, 1)
    return {
        "deviceId": "evse_01",
        "operationalState": evse["operational_state"],
        "socPercent": soc,
        "powerWatts": power,
        "isTapering": evse["is_tapering"],
        "taperStartSocPercent": evse["taper_start_soc_percent"],
        "ratedPowerWatts": evse["rated_power_watts"],
        "minutesToFull": minutes_to_full,
    }


@app.get("/api/v1/modules/health")
def health_module():
    devices = []
    for did, d in _DEVICES.items():
        op = d["operational_state"]
        health = "fault" if op == "fault" else "healthy"
        devices.append({
            "deviceId": did,
            "deviceType": d["device_type"],
            "health": health,
            "operationalState": op,
            "uptimeSeconds": 0.0,
            "lastSeen": _now(),
            "faultMessage": f"Device {did} in fault state" if op == "fault" else None,
        })
    faults = sum(1 for x in devices if x["health"] == "fault")
    return {
        "overall": "fault" if faults else "healthy",
        "healthyCount": len(devices) - faults,
        "faultCount": faults,
        "degradedCount": 0,
        "offlineCount": 0,
        "devices": devices,
        "timestamp": _now(),
    }


# ===========================================================================
# WEBSOCKET — ws://localhost:8000/ws
# ===========================================================================

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _WS_CLIENTS.append(ws)
    try:
        # Handshake
        if not _SYSTEM_CONFIG["configured"]:
            await ws.send_text(json.dumps({
                "event": "setup_incomplete",
                "timestamp": _now(),
                "data": {"message": "Select a villa tier via POST /api/v1/system/setup"},
            }))
        else:
            await ws.send_text(json.dumps({
                "event": "setup_complete",
                "timestamp": _now(),
                "data": {
                    "tier": _SYSTEM_CONFIG["tier"],
                    "contractedPowerKva": _SYSTEM_CONFIG["contracted_power_kva"],
                    "currentRatingA": _SYSTEM_CONFIG["current_rating_a"],
                },
            }))

        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "ping":
                        await ws.send_text(json.dumps({"type": "pong", "timestamp": _now()}))
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "keepalive", "timestamp": _now()}))

    except WebSocketDisconnect:
        pass
    finally:
        if ws in _WS_CLIENTS:
            _WS_CLIENTS.remove(ws)


# ===========================================================================
# HEALTH CHECK
# ===========================================================================

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "mode": "mock",
        "setupComplete": _SYSTEM_CONFIG["configured"],
        "devicesRegistered": len(_DEVICES),
        "wsClients": len(_WS_CLIENTS),
    }


# ===========================================================================
# HELPERS
# ===========================================================================

def _require_setup():
    if not _SYSTEM_CONFIG["configured"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "error": "setup_incomplete",
                "message": "POST /api/v1/system/setup with tier=small|medium|large first.",
            },
        )


def _get_device_or_404(device_id: str) -> Dict[str, Any]:
    if device_id not in _DEVICES:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Device '{device_id}' not found. "
            f"Known devices: {', '.join(_DEVICES.keys())}",
        )
    return _DEVICES[device_id]


def _matter_envelope(d: Dict[str, Any]) -> Dict[str, Any]:
    """Build a Matter-style envelope identical to the real server's shape."""
    dtype = d["device_type"]
    on = d["operational_state"] in ("on", "running")
    power = round(d.get("power_watts", d.get("current_power_watts", 0.0)), 2)

    clusters: Dict[str, Any] = {
        "OnOff": {"attributes": {"OnOff": on}},
        "ElectricalPowerMeasurement": {"attributes": {"ActivePower": power}},
    }

    if dtype == "evse":
        clusters["EnergyEvse"] = {"attributes": {
            "StateOfCharge": d.get("state_of_charge_percent", 0.0),
            "IsTapering": d.get("is_tapering", False),
            "TaperStartSocPercent": d.get("taper_start_soc_percent", 80.0),
            "RatedPowerWatts": d.get("rated_power_watts", 7000.0),
            "IsCharging": d.get("is_charging", False),
        }}
    elif dtype == "light":
        clusters["LevelControl"] = {"attributes": {"CurrentLevel": d.get("level", 254)}}
    elif dtype == "refrigerator":
        clusters["RefrigeratorAndTemperatureControlledCabinetMode"] = {"attributes": {
            "CompressorOn": d.get("compressor_on", False),
            "CycleOnDurationS": d.get("cycle_on_duration_seconds", 600),
            "CycleOffDurationS": d.get("cycle_off_duration_seconds", 300),
            "TimeInCurrentPhaseS": 0.0,
        }}
    elif dtype == "microwave":
        clusters["MicrowaveOvenControl"] = {"attributes": {
            "CookTimerRemainingS": d.get("cook_time_seconds_remaining", 0),
            "PowerLevelPercent": d.get("power_level_percent", 100),
        }}
    elif dtype == "cctv":
        clusters["CameraAvStreamManagement"] = {"attributes": {
            "StreamingEnabled": d.get("streaming", True),
            "RecordingEnabled": d.get("recording", True),
        }}

    meta: Dict[str, Any] = {
        "timestamp": _now(),
        "operational_state": d["operational_state"],
    }
    # Include mode/temperature in meta where relevant
    if "mode" in d:
        meta["mode"] = d["mode"]
    if "target_temperature_celsius" in d:
        meta["target_temperature_celsius"] = d["target_temperature_celsius"]

    return {
        "device_id": d["device_id"],
        "device_type": dtype,
        "clusters": clusters,
        "meta": meta,
    }


# ===========================================================================
# ENTRY POINT
# ===========================================================================

if __name__ == "__main__":
    import uvicorn
    print("\n  RNTBCI Mock Server")
    print("  REST  →  http://localhost:8000/api/v1")
    print("  WS    →  ws://localhost:8000/ws")
    print("  Docs  →  http://localhost:8000/docs\n")
    uvicorn.run("mock_server:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
