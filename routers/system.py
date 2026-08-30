"""
System router — /api/v1/system/*
Endpoints: setup, power-budget, alerts.
Per MASTER_SPEC.md Part 5 (REST) and openapi.yaml.
Decision A enforced: power-budget is read-only reporting, never auto-throttles.
Decision C enforced: setup gate on every power-aware endpoint.
Decision E enforced: camelCase in JSON payloads.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from database import SessionLocal
from routers.deps import (
    get_config_manager,
    get_master_agent,
    get_twin,
    require_setup,
)
from ws_broadcaster import broadcaster

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["system"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class VillaTierSetupRequest(BaseModel):
    tier: str = Field(..., description="small | medium | large")


class SetupResponse(BaseModel):
    status: str
    tier: str
    contractedPowerKva: float
    currentRatingA: float


class PerDevicePower(BaseModel):
    deviceId: str
    watts: float


class PowerBudgetResponse(BaseModel):
    totalDrawWatts: float
    limitWatts: float
    # "ok" | "warning" | "critical"  (Decision A: reporting only, never triggers throttle)
    status: str
    perDevice: List[PerDevicePower]


class AlertItem(BaseModel):
    id: str
    severity: str          # "warning" | "critical"
    alertType: str
    message: str
    totalDrawWatts: float
    limitWatts: float
    raisedAt: str          # ISO-8601


# ---------------------------------------------------------------------------
# POST /system/setup
# ---------------------------------------------------------------------------

@router.post("/setup", response_model=SetupResponse, status_code=200)
async def setup_system(
    body: VillaTierSetupRequest,
    config_manager=Depends(get_config_manager),
) -> SetupResponse:
    """
    Configure the household from a villa tier preset.
    Per Decision C: the gate lifts only after this call succeeds.
    """
    ok = config_manager.setup_from_villa_tier(body.tier)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown tier '{body.tier}'. Valid values: small, medium, large.",
        )

    kva: float = config_manager.get_contracted_power_kva()
    amps: float = config_manager.get_current_rating_a()

    # Broadcast setup_complete to all live WebSocket clients
    await broadcaster.emit_setup_complete(
        tier=body.tier,
        contracted_power_kva=kva,
        current_rating_a=amps,
    )

    return SetupResponse(
        status="configured",
        tier=body.tier,
        contractedPowerKva=kva,
        currentRatingA=amps,
    )


# ---------------------------------------------------------------------------
# GET /system/power-budget
# ---------------------------------------------------------------------------

@router.get("/power-budget", response_model=PowerBudgetResponse)
async def get_power_budget(
    config_manager=Depends(get_config_manager),
    twin=Depends(get_twin),
    agent=Depends(get_master_agent),
) -> PowerBudgetResponse:
    """
    Snapshot of total household power draw vs contracted limit.
    Per Decision A: status field is REPORTING ONLY — this endpoint never
    auto-throttles any device.
    """
    require_setup(config_manager)

    live_states = twin.get_all_live_states()
    budget = agent.check_power_budget(live_states)

    # Check thresholds and fire DB alert + WS broadcast if needed
    alert = agent.check_and_fire_alerts(budget)
    if alert:
        await broadcaster.emit_alert(
            alert_type=alert.alert_type,
            message=alert.message,
            total_load_watts=alert.total_load_watts,
            limit_watts=alert.limit_watts,
        )

    return PowerBudgetResponse(
        totalDrawWatts=budget.total_load_watts,
        limitWatts=budget.limit_watts,
        status=budget.status,
        perDevice=[
            PerDevicePower(deviceId=d["device_id"], watts=d["watts"])
            for d in budget.per_device
        ],
    )


# ---------------------------------------------------------------------------
# GET /system/alerts
# ---------------------------------------------------------------------------

@router.get("/alerts", response_model=List[AlertItem])
def get_alerts(
    limit: int = 20,
    config_manager=Depends(get_config_manager),
) -> List[AlertItem]:
    """
    Most-recent system alerts, newest first.
    Requires setup to be complete (otherwise there were no alerts to fetch).
    """
    require_setup(config_manager)

    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                "SELECT id, timestamp, alert_type, message, "
                "total_load_watts, limit_watts "
                "FROM alerts ORDER BY timestamp DESC LIMIT :lim"
            ),
            {"lim": limit},
        ).fetchall()

        items: List[AlertItem] = []
        for row in rows:
            alert_type: str = row[2] or ""
            severity = "critical" if "trip" in alert_type or "CRITICAL" in (row[3] or "") else "warning"
            items.append(
                AlertItem(
                    id=str(row[0]),
                    severity=severity,
                    alertType=alert_type,
                    message=row[3] or "",
                    totalDrawWatts=float(row[4] or 0),
                    limitWatts=float(row[5] or 0),
                    raisedAt=row[1].isoformat() if isinstance(row[1], datetime) else str(row[1]),
                )
            )
        return items
    finally:
        db.close()


# ===========================================================================
# EXPORT ENDPOINT — GET /system/export
# Per MASTER_SPEC.md Part 5:
#   GET /system/export?format=csv|xlsx&device_id={optional}&from={ts}&to={ts}
#   Read-only, backed by power_readings table (Decision B).
# ===========================================================================

import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import Query
from fastapi.responses import StreamingResponse


@router.get("/export")
def export_power_readings(
    format: str = Query("csv", description="csv or xlsx"),
    device_id: Optional[str] = Query(None, description="Filter to one device"),
    from_ts: Optional[datetime] = Query(None, alias="from", description="ISO-8601 start"),
    to_ts: Optional[datetime] = Query(None, alias="to", description="ISO-8601 end"),
    limit: int = Query(10000, le=100000),
    config_manager=Depends(get_config_manager),
) -> StreamingResponse:
    """
    Export power_readings as CSV or XLSX.
    Per MASTER_SPEC.md Part 5 and Decision B (row-per-tick history).
    Requires setup to be complete.
    """
    require_setup(config_manager)

    fmt = format.lower().strip()
    if fmt not in ("csv", "xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="format must be 'csv' or 'xlsx'.",
        )

    # Query power_readings
    filters: list[str] = []
    params: dict = {"limit": limit}

    if device_id:
        filters.append("device_id = :device_id")
        params["device_id"] = device_id
    if from_ts:
        filters.append("timestamp >= :from_ts")
        params["from_ts"] = from_ts
    if to_ts:
        filters.append("timestamp <= :to_ts")
        params["to_ts"] = to_ts

    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                f"SELECT device_id, timestamp, power_watts "
                f"FROM power_readings {where} "
                f"ORDER BY timestamp ASC LIMIT :limit"
            ),
            params,
        ).fetchall()
    finally:
        db.close()

    columns = ["device_id", "timestamp", "power_watts"]

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        for row in rows:
            writer.writerow([row[0], row[1].isoformat() if isinstance(row[1], datetime) else row[1], row[2]])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=power_readings.csv"},
        )

    else:  # xlsx
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="openpyxl not installed. Install it with: pip install openpyxl",
            )
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "power_readings"
        ws.append(columns)
        for row in rows:
            ts = row[1].isoformat() if isinstance(row[1], datetime) else str(row[1])
            ws.append([row[0], ts, float(row[2])])

        buf_bytes = io.BytesIO()
        wb.save(buf_bytes)
        buf_bytes.seek(0)
        return StreamingResponse(
            iter([buf_bytes.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=power_readings.xlsx"},
        )
