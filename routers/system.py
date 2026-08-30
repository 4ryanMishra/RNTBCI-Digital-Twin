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
