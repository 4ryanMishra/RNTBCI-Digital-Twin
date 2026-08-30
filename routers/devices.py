"""
Devices router — /api/v1/devices/*
Covers all 9 devices from MASTER_SPEC.md Part 3.

URL pattern (matches openapi.yaml):
  GET  /devices                       — list all (compact)
  GET  /devices/{device_id}           — full Matter-style envelope
  POST /devices/{device_id}/control   — send command

Matter-style envelope (per MASTER_SPEC.md Part 5):
  {
    "device_id": "microwave_01",
    "device_type": "microwave",
    "clusters": {
      "OnOff":                      { "attributes": { "OnOff": <bool> } },
      "ElectricalPowerMeasurement": { "attributes": { "ActivePower": <watts> } },
      <device-type-specific clusters>
    },
    "meta": {
      "timestamp": "<ISO-8601>",
      "operational_state": "<state>"
    }
  }

Decision A: control endpoint never issues throttle commands.
Decision E: camelCase JSON payloads.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from device_registry import get_all_devices
from routers.deps import get_config_manager, get_twin, require_setup
from ws_broadcaster import broadcaster

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class DeviceListItem(BaseModel):
    deviceId: str
    deviceType: str
    operationalState: str
    powerWatts: float


class DeviceListResponse(BaseModel):
    devices: List[DeviceListItem]


class MatterEnvelopeResponse(BaseModel):
    """
    Matter-style device envelope per MASTER_SPEC.md Part 5.
    Clusters vary by device type; all devices expose OnOff and
    ElectricalPowerMeasurement at minimum.
    """
    device_id: str
    device_type: str
    clusters: Dict[str, Any]
    meta: Dict[str, Any]


class ControlRequest(BaseModel):
    action: str = Field(..., description="start | stop | pause")
    parameters: Optional[Dict[str, Any]] = Field(default=None)


# ---------------------------------------------------------------------------
# Registry helpers
# ---------------------------------------------------------------------------

_DEVICE_TYPE: Dict[str, str] = {
    d["device_id"]: d["device_type"] for d in get_all_devices()
}
_VALID_IDS = set(_DEVICE_TYPE.keys())


# ---------------------------------------------------------------------------
# Matter cluster builder
# ---------------------------------------------------------------------------

def _build_matter_envelope(state) -> MatterEnvelopeResponse:
    """
    Build a Matter-style envelope from a DeviceState.

    Every device gets:
      - OnOff cluster            (OnOff attribute = bool)
      - ElectricalPowerMeasurement (ActivePower = watts)

    Device-specific clusters are added based on device_type:
      evse          → EnergyEvse (StateOfCharge, IsTapering, TaperStartSoc)
      refrigerator  → RefrigeratorAndTemperatureControlledCabinetMode
                       (CompressorOn, CycleOnDurationS, CycleOffDurationS)
      microwave     → MicrowaveOvenControl (if metadata present)
    """
    meta = state.metadata
    on = state.operational_state in ("on", "running")

    clusters: Dict[str, Any] = {
        "OnOff": {
            "attributes": {"OnOff": on}
        },
        "ElectricalPowerMeasurement": {
            "attributes": {"ActivePower": round(state.power_watts, 2)}
        },
    }

    dtype = state.device_type

    if dtype == "evse":
        clusters["EnergyEvse"] = {
            "attributes": {
                "StateOfCharge": meta.get("soc_percent", 0.0),
                "IsTapering": meta.get("is_tapering", False),
                "TaperStartSocPercent": meta.get("taper_start_soc_percent", 80.0),
                "RatedPowerWatts": meta.get("rated_power_watts", 7000.0),
                "IsCharging": meta.get("is_charging", False),
            }
        }

    elif dtype == "refrigerator":
        clusters["RefrigeratorAndTemperatureControlledCabinetMode"] = {
            "attributes": {
                "CompressorOn": meta.get("compressor_on", False),
                "CycleOnDurationS": meta.get("cycle_on_s", 600),
                "CycleOffDurationS": meta.get("cycle_off_s", 300),
                "TimeInCurrentPhaseS": round(meta.get("time_in_current_phase", 0.0), 1),
            }
        }

    elif dtype == "microwave":
        if meta:
            clusters["MicrowaveOvenControl"] = {
                "attributes": {
                    "CookTimerRemainingS": meta.get("cook_time_seconds_remaining", 0),
                    "PowerLevelPercent": meta.get("power_level_percent", 100),
                }
            }

    elif dtype == "cctv":
        clusters["CameraAvStreamManagement"] = {
            "attributes": {
                "StreamingEnabled": meta.get("streaming", on),
                "RecordingEnabled": meta.get("recording", on),
            }
        }

    return MatterEnvelopeResponse(
        device_id=state.device_id,
        device_type=state.device_type,
        clusters=clusters,
        meta={
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "operational_state": state.operational_state,
        },
    )


# ---------------------------------------------------------------------------
# GET /devices
# ---------------------------------------------------------------------------

@router.get("", response_model=DeviceListResponse)
def list_devices(twin=Depends(get_twin)) -> DeviceListResponse:
    """Compact list of all 9 devices with live state (no Matter envelope)."""
    items: List[DeviceListItem] = []
    for spec in get_all_devices():
        did = spec["device_id"]
        state = twin.get_live_state(did)
        items.append(
            DeviceListItem(
                deviceId=did,
                deviceType=spec["device_type"],
                operationalState=state.operational_state if state else "off",
                powerWatts=state.power_watts if state else 0.0,
            )
        )
    return DeviceListResponse(devices=items)


# ---------------------------------------------------------------------------
# GET /devices/{device_id}  — Matter-style envelope
# ---------------------------------------------------------------------------

@router.get("/{device_id}", response_model=MatterEnvelopeResponse)
def get_device(
    device_id: str,
    config_manager=Depends(get_config_manager),
    twin=Depends(get_twin),
) -> MatterEnvelopeResponse:
    """
    Full Matter-style device envelope.
    Per MASTER_SPEC.md Part 5: clusters + meta shape.
    """
    require_setup(config_manager)

    if device_id not in _VALID_IDS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown device '{device_id}'.",
        )

    state = twin.get_live_state(device_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' has no live state.",
        )

    return _build_matter_envelope(state)


# ---------------------------------------------------------------------------
# POST /devices/{device_id}/control
# ---------------------------------------------------------------------------

@router.post("/{device_id}/control", response_model=MatterEnvelopeResponse)
async def control_device(
    device_id: str,
    body: ControlRequest,
    config_manager=Depends(get_config_manager),
    twin=Depends(get_twin),
) -> MatterEnvelopeResponse:
    """
    Send a control command to a device.
    Per Decision A: only device-internal commands — no throttle ever issued.
    Returns updated Matter-style envelope.
    """
    require_setup(config_manager)

    if device_id not in _VALID_IDS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown device '{device_id}'.",
        )

    # Build command dict — accept camelCase params from client, convert internally
    command: Dict[str, Any] = {"action": body.action}
    if body.parameters:
        for k, v in body.parameters.items():
            command[_camel_to_snake(k)] = v

    # Snapshot previous EVSE taper state for boundary detection
    prev_state = twin.get_live_state(device_id)
    prev_tapering = (
        prev_state.metadata.get("is_tapering", False) if prev_state else False
    )

    updated_state = twin.apply_command(device_id, command)
    if updated_state is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Command '{body.action}' rejected by device '{device_id}'.",
        )

    # ---- Broadcast typed WebSocket events ----

    await broadcaster.emit_state_change(
        device_id=device_id,
        operational_state=updated_state.operational_state,
        power_watts=updated_state.power_watts,
        metadata=updated_state.metadata,
    )

    if _DEVICE_TYPE.get(device_id) == "evse":
        new_tapering = updated_state.metadata.get("is_tapering", False)
        if new_tapering != prev_tapering:
            await broadcaster.emit_soc_taper_update(
                device_id=device_id,
                soc_percent=updated_state.metadata.get("soc_percent", 0.0),
                power_watts=updated_state.power_watts,
                entered_taper=new_tapering,
            )

    return _build_matter_envelope(updated_state)


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _camel_to_snake(name: str) -> str:
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
