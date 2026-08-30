"""
Modules router — /api/v1/modules/*
Exposes the four Layer 4 application modules as REST endpoints.

  GET /modules/power/summary          — household power + utilisation
  GET /modules/power/history          — per-device history (query params)
  GET /modules/ev/session             — current EVSE session snapshot
  GET /modules/ev/sessions            — completed session history
  GET /modules/location               — villa tier + electrical config
  GET /modules/health                 — device health roll-up
  GET /modules/health/{device_id}     — single device health

All modules consume Layer 2/3 only (never Layer 1 directly).
Decision C: setup gate on all endpoints except /modules/location
            (location returns setup_complete=False gracefully).
Decision E: camelCase JSON.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from routers.deps import (
    get_config_manager,
    get_ev_module,
    get_health_module,
    get_location_module,
    get_power_module,
    require_setup,
)

router = APIRouter(prefix="/modules", tags=["modules"])


# ---------------------------------------------------------------------------
# Power module endpoints
# ---------------------------------------------------------------------------

class PerDevicePowerItem(BaseModel):
    deviceId: str
    deviceType: str
    operationalState: str
    powerWatts: float


class PowerSummaryResponse(BaseModel):
    totalWatts: float
    limitWatts: float
    budgetStatus: str
    utilisationPct: float
    perDevice: List[PerDevicePowerItem]
    timestamp: str


class PowerHistoryItem(BaseModel):
    deviceId: str
    timestamp: str
    watts: float


@router.get("/power/summary", response_model=PowerSummaryResponse)
def power_summary(
    config_manager=Depends(get_config_manager),
    power_module=Depends(get_power_module),
) -> PowerSummaryResponse:
    """Current household power draw and budget utilisation."""
    require_setup(config_manager)
    s = power_module.get_household_summary()
    return PowerSummaryResponse(
        totalWatts=s.total_watts,
        limitWatts=s.limit_watts,
        budgetStatus=s.budget_status,
        utilisationPct=s.utilisation_pct,
        perDevice=[
            PerDevicePowerItem(
                deviceId=d.device_id,
                deviceType=d.device_type,
                operationalState=d.operational_state,
                powerWatts=d.power_watts,
            )
            for d in s.per_device
        ],
        timestamp=s.timestamp.isoformat(),
    )


@router.get("/power/history", response_model=List[PowerHistoryItem])
def power_history(
    device_id: Optional[str] = Query(None),
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    limit: int = Query(500, le=5000),
    config_manager=Depends(get_config_manager),
    power_module=Depends(get_power_module),
) -> List[PowerHistoryItem]:
    """Power reading history from power_readings table."""
    require_setup(config_manager)
    rows = power_module.get_all_history(
        from_ts=from_ts, to_ts=to_ts, device_id=device_id, limit=limit
    )
    return [
        PowerHistoryItem(
            deviceId=r.device_id,
            timestamp=r.timestamp.isoformat() if hasattr(r.timestamp, "isoformat") else str(r.timestamp),
            watts=r.watts,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# EV/Battery module endpoints
# ---------------------------------------------------------------------------

class EvSessionSnapshotResponse(BaseModel):
    deviceId: str
    operationalState: str
    socPercent: float
    powerWatts: float
    isTapering: bool
    taperStartSocPercent: float
    ratedPowerWatts: float
    energyAddedKwh: float
    minutesToFull: Optional[float]


class EvSessionRecordResponse(BaseModel):
    sessionId: int
    startedAt: str
    endedAt: Optional[str]
    startSocPct: float
    endSocPct: float
    energyAddedKwh: float
    peakPowerWatts: float
    completed: bool


@router.get("/ev/session", response_model=Optional[EvSessionSnapshotResponse])
def ev_session(
    config_manager=Depends(get_config_manager),
    ev_module=Depends(get_ev_module),
) -> Optional[EvSessionSnapshotResponse]:
    """Current EVSE charging session snapshot."""
    require_setup(config_manager)
    snap = ev_module.get_session_snapshot()
    if snap is None:
        return None
    return EvSessionSnapshotResponse(
        deviceId=snap.device_id,
        operationalState=snap.operational_state,
        socPercent=snap.soc_percent,
        powerWatts=snap.power_watts,
        isTapering=snap.is_tapering,
        taperStartSocPercent=snap.taper_start_soc_percent,
        ratedPowerWatts=snap.rated_power_watts,
        energyAddedKwh=snap.energy_added_kwh,
        minutesToFull=snap.minutes_to_full,
    )


@router.get("/ev/sessions", response_model=List[EvSessionRecordResponse])
def ev_session_history(
    limit: int = Query(20, le=100),
    config_manager=Depends(get_config_manager),
    ev_module=Depends(get_ev_module),
) -> List[EvSessionRecordResponse]:
    """Completed EVSE charging session history."""
    require_setup(config_manager)
    records = ev_module.get_session_history(limit=limit)
    return [
        EvSessionRecordResponse(
            sessionId=r.session_id,
            startedAt=r.started_at.isoformat(),
            endedAt=r.ended_at.isoformat() if r.ended_at else None,
            startSocPct=r.start_soc_pct,
            endSocPct=r.end_soc_pct,
            energyAddedKwh=r.energy_added_kwh,
            peakPowerWatts=r.peak_power_watts,
            completed=r.completed,
        )
        for r in records
    ]


# ---------------------------------------------------------------------------
# Location module endpoint
# ---------------------------------------------------------------------------

class LocationResponse(BaseModel):
    setupComplete: bool
    tier: Optional[str]
    phaseConfig: Optional[str]
    voltageV: Optional[float]
    contractedPowerKva: Optional[float]
    currentRatingA: Optional[float]


@router.get("/location", response_model=LocationResponse)
def location(
    location_module=Depends(get_location_module),
) -> LocationResponse:
    """
    Villa tier and electrical configuration.
    Returns setupComplete=False (not 409) so the frontend can show the
    setup screen gracefully without an error state.
    """
    info = location_module.get_location_info()
    return LocationResponse(
        setupComplete=info.setup_complete,
        tier=info.tier,
        phaseConfig=info.phase_config,
        voltageV=info.voltage_v,
        contractedPowerKva=info.contracted_power_kva,
        currentRatingA=info.current_rating_a,
    )


# ---------------------------------------------------------------------------
# Device health module endpoints
# ---------------------------------------------------------------------------

class DeviceHealthItem(BaseModel):
    deviceId: str
    deviceType: str
    health: str         # healthy | degraded | fault | offline
    operationalState: str
    uptimeSeconds: float
    lastSeen: Optional[str]
    faultMessage: Optional[str]


class HouseholdHealthResponse(BaseModel):
    overall: str
    healthyCount: int
    degradedCount: int
    faultCount: int
    offlineCount: int
    devices: List[DeviceHealthItem]
    timestamp: str


@router.get("/health", response_model=HouseholdHealthResponse)
def household_health(
    health_module=Depends(get_health_module),
) -> HouseholdHealthResponse:
    """Household-level device health roll-up."""
    rollup = health_module.get_all_health()
    return HouseholdHealthResponse(
        overall=rollup.overall,
        healthyCount=rollup.healthy_count,
        degradedCount=rollup.degraded_count,
        faultCount=rollup.fault_count,
        offlineCount=rollup.offline_count,
        devices=[_health_item(d) for d in rollup.devices],
        timestamp=rollup.timestamp.isoformat(),
    )


@router.get("/health/{device_id}", response_model=DeviceHealthItem)
def device_health(
    device_id: str,
    health_module=Depends(get_health_module),
) -> DeviceHealthItem:
    """Health status for a single device."""
    status_obj = health_module.get_device_health(device_id)
    if status_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found.",
        )
    return _health_item(status_obj)


def _health_item(d) -> DeviceHealthItem:
    return DeviceHealthItem(
        deviceId=d.device_id,
        deviceType=d.device_type,
        health=d.health,
        operationalState=d.operational_state,
        uptimeSeconds=d.uptime_seconds,
        lastSeen=d.last_seen.isoformat() if d.last_seen else None,
        faultMessage=d.fault_message,
    )
