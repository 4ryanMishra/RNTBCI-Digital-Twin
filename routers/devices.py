"""
Devices router — /api/v1/devices/*
Covers all 9 devices from MASTER_SPEC.md Part 3.

URL pattern (matches openapi.yaml):
  GET  /devices                       — list all
  GET  /devices/{device_id}           — state of one device
  POST /devices/{device_id}/control   — send command

Device-specific URLs in openapi.yaml (/devices/evse, /devices/light, …) are
aliases that resolve to the same generic handler via the device_id path param.
Dedicated sub-responses (EvseState, RefrigeratorState, …) are shaped by
`_build_response()` which adds device-type-specific fields from DeviceState.metadata.

Decision A enforced: control endpoint accepts commands only, never issues throttle.
Decision E enforced: camelCase JSON.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from device_registry import get_all_devices
from routers.deps import get_config_manager, get_twin, require_setup
from ws_broadcaster import broadcaster

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class DeviceStateResponse(BaseModel):
    deviceId: str
    deviceType: str
    operationalState: str
    powerWatts: float
    # Extra fields populated from metadata (EVSE SOC, fridge compressor, etc.)
    metadata: Dict[str, Any] = {}


class DeviceListItem(BaseModel):
    deviceId: str
    deviceType: str
    operationalState: str
    powerWatts: float


class DeviceListResponse(BaseModel):
    devices: List[DeviceListItem]


class ControlRequest(BaseModel):
    action: str = Field(
        ...,
        description="Command action: start | stop | pause (device-specific)",
    )
    parameters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional action parameters (e.g. initialSocPercent for EVSE)",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Stable device_id → device_type map built once from registry
_DEVICE_TYPE: Dict[str, str] = {
    d["device_id"]: d["device_type"] for d in get_all_devices()
}

_VALID_IDS = set(_DEVICE_TYPE.keys())


def _state_response(device_id: str, twin) -> DeviceStateResponse:
    """Pull live state from the twin and shape into API response."""
    state = twin.get_live_state(device_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found.",
        )
    return DeviceStateResponse(
        deviceId=state.device_id,
        deviceType=state.device_type,
        operationalState=state.operational_state,
        powerWatts=state.power_watts,
        metadata=state.metadata,
    )


# ---------------------------------------------------------------------------
# GET /devices
# ---------------------------------------------------------------------------

@router.get("", response_model=DeviceListResponse)
def list_devices(twin=Depends(get_twin)) -> DeviceListResponse:
    """List all 9 registered devices with their current live state."""
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
# GET /devices/{device_id}
# ---------------------------------------------------------------------------

@router.get("/{device_id}", response_model=DeviceStateResponse)
def get_device(
    device_id: str,
    config_manager=Depends(get_config_manager),
    twin=Depends(get_twin),
) -> DeviceStateResponse:
    """Get current state of a single device."""
    require_setup(config_manager)
    if device_id not in _VALID_IDS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown device '{device_id}'.",
        )
    return _state_response(device_id, twin)


# ---------------------------------------------------------------------------
# POST /devices/{device_id}/control
# ---------------------------------------------------------------------------

@router.post("/{device_id}/control", response_model=DeviceStateResponse)
async def control_device(
    device_id: str,
    body: ControlRequest,
    config_manager=Depends(get_config_manager),
    twin=Depends(get_twin),
) -> DeviceStateResponse:
    """
    Send a command to a device.
    Per Decision A: only device-internal commands are accepted here.
    The system NEVER issues a throttle command via this endpoint.
    """
    require_setup(config_manager)

    if device_id not in _VALID_IDS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown device '{device_id}'.",
        )

    # Build command dict — snake_case internally, camelCase accepted from client
    command: Dict[str, Any] = {"action": body.action}
    if body.parameters:
        # Accept both camelCase and snake_case from clients
        for k, v in body.parameters.items():
            # camelCase → snake_case for internal use
            snake = _camel_to_snake(k)
            command[snake] = v

    # Capture previous EVSE taper state for boundary detection
    prev_state = twin.get_live_state(device_id)
    prev_tapering = (
        prev_state.metadata.get("is_tapering", False)
        if prev_state else False
    )

    updated_state = twin.apply_command(device_id, command)
    if updated_state is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Command '{body.action}' rejected by device '{device_id}'.",
        )

    device_type = _DEVICE_TYPE.get(device_id, "")

    # ---- Broadcast typed WebSocket events ----

    # 1. state_change  (all devices)
    await broadcaster.emit_state_change(
        device_id=device_id,
        operational_state=updated_state.operational_state,
        power_watts=updated_state.power_watts,
        metadata=updated_state.metadata,
    )

    # 2. soc_taper_update (EVSE only, boundary crossing only)
    if device_type == "evse":
        new_tapering = updated_state.metadata.get("is_tapering", False)
        if new_tapering != prev_tapering:
            await broadcaster.emit_soc_taper_update(
                device_id=device_id,
                soc_percent=updated_state.metadata.get("soc_percent", 0.0),
                power_watts=updated_state.power_watts,
                entered_taper=new_tapering,
            )

    return DeviceStateResponse(
        deviceId=updated_state.device_id,
        deviceType=updated_state.device_type,
        operationalState=updated_state.operational_state,
        powerWatts=updated_state.power_watts,
        metadata=updated_state.metadata,
    )


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _camel_to_snake(name: str) -> str:
    """Convert camelCase → snake_case for internal command keys."""
    import re
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
