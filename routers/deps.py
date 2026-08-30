"""
Shared dependency injection for all routers.

The FastAPI app populates these module-level references during startup.
Routers import `get_twin`, `get_config_manager`, `get_master_agent` and
use them as FastAPI dependencies so every endpoint has access to the
singleton instances without circular imports.
"""
from fastapi import HTTPException, status
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from digital_twin_core import DigitalTwinCore
    from system_config_manager import SystemConfigManager
    from master_agent import MasterAgent

# Populated by api_server.py on startup
_twin: "DigitalTwinCore | None" = None
_config_manager: "SystemConfigManager | None" = None
_master_agent: "MasterAgent | None" = None


def set_globals(twin, config_manager, master_agent) -> None:
    """Called once during FastAPI startup to inject singletons."""
    global _twin, _config_manager, _master_agent
    _twin = twin
    _config_manager = config_manager
    _master_agent = master_agent


def get_twin() -> "DigitalTwinCore":
    assert _twin is not None, "DigitalTwinCore not initialised"
    return _twin


def get_config_manager() -> "SystemConfigManager":
    assert _config_manager is not None, "SystemConfigManager not initialised"
    return _config_manager


def get_master_agent() -> "MasterAgent":
    assert _master_agent is not None, "MasterAgent not initialised"
    return _master_agent


def require_setup(config_manager: "SystemConfigManager") -> None:
    """
    Raises HTTP 409 if villa tier has not been configured yet.
    Per Decision C: no defaults, user must select a tier first.
    """
    if not config_manager.is_setup_complete():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "setup_incomplete",
                "message": (
                    "System configuration is incomplete. "
                    "POST /api/v1/system/setup with a valid tier "
                    "(small | medium | large) before using this endpoint."
                ),
            },
        )
