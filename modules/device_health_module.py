"""
Device Health Module — Layer 4
Consumer of Layer 2 (twin live states) only.
NEVER touches Layer 1 directly.

Responsibilities:
- Per-device health status (healthy | degraded | fault | offline)
- Fault detection: device in 'fault' operational_state
- Offline detection: device not reporting (last-seen tracking)
- Uptime tracking: continuous 'running' or 'on' time per device
- Household-level health roll-up
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional


# How long without a state update before a device is considered offline
OFFLINE_THRESHOLD_S: float = 30.0


@dataclass
class DeviceHealthStatus:
    device_id: str
    device_type: str
    health: str                     # "healthy" | "degraded" | "fault" | "offline"
    operational_state: str
    uptime_seconds: float           # continuous seconds in running/on state
    last_seen: Optional[datetime]
    fault_message: Optional[str]    # populated when health == "fault"


@dataclass
class HouseholdHealthRollup:
    healthy_count: int
    degraded_count: int
    fault_count: int
    offline_count: int
    devices: List[DeviceHealthStatus]
    overall: str                    # "healthy" | "degraded" | "fault"
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class DeviceHealthModule:
    """
    Layer 4 device health module.
    Reads from Layer 2 live states only.
    Tracks uptime and last-seen timestamps internally.
    """

    def __init__(self, twin) -> None:
        self._twin = twin
        # device_id → datetime of last state update seen by this module
        self._last_seen: Dict[str, datetime] = {}
        # device_id → datetime when current continuous uptime run started
        self._uptime_started: Dict[str, Optional[datetime]] = {}
        # device_id → accumulated uptime seconds (for completed runs)
        self._uptime_acc: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_all_health(self) -> HouseholdHealthRollup:
        """Household-level health roll-up."""
        now = datetime.now(timezone.utc)
        live = self._twin.get_all_live_states()
        statuses: List[DeviceHealthStatus] = []

        for did, state in live.items():
            self._update_tracking(did, state, now)
            statuses.append(self._build_status(did, state, now))

        healthy = sum(1 for s in statuses if s.health == "healthy")
        degraded = sum(1 for s in statuses if s.health == "degraded")
        fault = sum(1 for s in statuses if s.health == "fault")
        offline = sum(1 for s in statuses if s.health == "offline")

        if fault > 0:
            overall = "fault"
        elif degraded > 0 or offline > 0:
            overall = "degraded"
        else:
            overall = "healthy"

        return HouseholdHealthRollup(
            healthy_count=healthy,
            degraded_count=degraded,
            fault_count=fault,
            offline_count=offline,
            devices=statuses,
            overall=overall,
        )

    def get_device_health(self, device_id: str) -> Optional[DeviceHealthStatus]:
        """Health status for a single device."""
        now = datetime.now(timezone.utc)
        state = self._twin.get_live_state(device_id)
        if state is None:
            return None
        self._update_tracking(device_id, state, now)
        return self._build_status(device_id, state, now)

    def on_tick(self) -> None:
        """
        Call once per simulation tick to keep uptime clocks accurate.
        Updates last_seen for every device currently in the live store.
        """
        now = datetime.now(timezone.utc)
        live = self._twin.get_all_live_states()
        for did, state in live.items():
            self._update_tracking(did, state, now)

    # ------------------------------------------------------------------
    # Internal tracking helpers
    # ------------------------------------------------------------------

    def _update_tracking(self, device_id: str, state, now: datetime) -> None:
        """Update last_seen and uptime start/accumulation."""
        self._last_seen[device_id] = now

        running = state.operational_state in ("running", "on")

        if running:
            # Start uptime counter if not already running
            if self._uptime_started.get(device_id) is None:
                self._uptime_started[device_id] = now
        else:
            # Device stopped — accumulate uptime and reset start
            start = self._uptime_started.get(device_id)
            if start is not None:
                elapsed = (now - start).total_seconds()
                self._uptime_acc[device_id] = (
                    self._uptime_acc.get(device_id, 0.0) + elapsed
                )
                self._uptime_started[device_id] = None

    def _build_status(self, device_id: str, state, now: datetime) -> DeviceHealthStatus:
        """Build DeviceHealthStatus from tracked data + current state."""
        last_seen = self._last_seen.get(device_id)

        # Offline check
        if last_seen is None:
            is_offline = True
        else:
            age_s = (now - last_seen).total_seconds()
            is_offline = age_s > OFFLINE_THRESHOLD_S

        # Current uptime
        acc = self._uptime_acc.get(device_id, 0.0)
        start = self._uptime_started.get(device_id)
        if start is not None:
            acc += (now - start).total_seconds()
        uptime_s = round(acc, 1)

        # Health classification
        fault_msg: Optional[str] = None
        if is_offline:
            health = "offline"
        elif state.operational_state == "fault":
            health = "fault"
            fault_msg = f"Device {device_id} reported fault state"
        elif state.operational_state == "setup_incomplete":
            health = "degraded"
        else:
            health = "healthy"

        return DeviceHealthStatus(
            device_id=device_id,
            device_type=state.device_type,
            health=health,
            operational_state=state.operational_state,
            uptime_seconds=uptime_s,
            last_seen=last_seen,
            fault_message=fault_msg,
        )
