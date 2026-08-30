"""
EV / Battery Module — Layer 4
Consumer of Layer 2 (twin live states) only.
NEVER touches Layer 1 directly.

Responsibilities:
- Current EVSE session state (SOC, power, taper status)
- Session energy accumulation (kWh added this session)
- Estimated time to full charge
- Session history (start/end SOC, energy added, duration)
  stored in-memory for now; persisted to DB if a sessions table exists
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional


EVSE_DEVICE_ID = "evse_01"


@dataclass
class EvseSessionSnapshot:
    """Live state of the current (or last) charging session."""
    device_id: str
    operational_state: str
    soc_percent: float
    power_watts: float
    is_tapering: bool
    taper_start_soc_percent: float
    rated_power_watts: float
    # Derived
    energy_added_kwh: float         # accumulated this session
    minutes_to_full: Optional[float]  # None if not charging or SOC=100


@dataclass
class EvseSessionRecord:
    """Completed or in-progress session record (in-memory log)."""
    session_id: int
    started_at: datetime
    ended_at: Optional[datetime]
    start_soc_pct: float
    end_soc_pct: float
    energy_added_kwh: float
    peak_power_watts: float
    completed: bool


class EvBatteryModule:
    """
    Layer 4 EV/Battery module.
    Reads from Layer 2 (twin.get_live_state) only.
    Accumulates session energy by tracking power × elapsed time.
    """

    def __init__(self, twin) -> None:
        self._twin = twin

        # Session tracking (in-memory)
        self._session_active: bool = False
        self._session_start_soc: float = 0.0
        self._session_start_time: Optional[datetime] = None
        self._session_energy_kwh: float = 0.0
        self._session_peak_watts: float = 0.0
        self._sessions: List[EvseSessionRecord] = []
        self._next_session_id: int = 1
        self._last_tick_time: Optional[datetime] = None
        self._battery_capacity_kwh: float = 60.0  # read from device metadata on first call

    # ------------------------------------------------------------------
    # Live snapshot
    # ------------------------------------------------------------------

    def get_session_snapshot(self) -> Optional[EvseSessionSnapshot]:
        """
        Current EVSE state.  Returns None if device not found.
        Never touches the device adapter — reads Layer 2 live store only.
        """
        state = self._twin.get_live_state(EVSE_DEVICE_ID)
        if state is None:
            return None

        meta = state.metadata
        soc = meta.get("soc_percent", 0.0)
        is_tapering = meta.get("is_tapering", False)
        rated = meta.get("rated_power_watts", 7000.0)
        taper_start = meta.get("taper_start_soc_percent", 80.0)

        # Estimate minutes to full charge
        minutes_to_full: Optional[float] = None
        if state.power_watts > 0 and soc < 100.0:
            battery_capacity_kwh = self._battery_capacity_kwh
            remaining_kwh = battery_capacity_kwh * (100.0 - soc) / 100.0
            hours = remaining_kwh / (state.power_watts / 1000.0)
            minutes_to_full = round(hours * 60.0, 1)

        return EvseSessionSnapshot(
            device_id=state.device_id,
            operational_state=state.operational_state,
            soc_percent=soc,
            power_watts=state.power_watts,
            is_tapering=is_tapering,
            taper_start_soc_percent=taper_start,
            rated_power_watts=rated,
            energy_added_kwh=round(self._session_energy_kwh, 4),
            minutes_to_full=minutes_to_full,
        )

    # ------------------------------------------------------------------
    # Session tracking (called by tick_runner or a background task)
    # ------------------------------------------------------------------

    def on_tick(self, delta_seconds: float = 1.0) -> None:
        """
        Called each simulation tick to accumulate session energy.
        Detects session start/end by watching operational_state transitions.
        """
        state = self._twin.get_live_state(EVSE_DEVICE_ID)
        if state is None:
            return

        charging = state.operational_state == "running" and state.power_watts > 0

        if charging and not self._session_active:
            # Session start
            self._session_active = True
            self._session_start_soc = state.metadata.get("soc_percent", 0.0)
            self._session_start_time = datetime.now(timezone.utc)
            self._session_energy_kwh = 0.0
            self._session_peak_watts = 0.0

        if charging and self._session_active:
            # Accumulate energy: P(W) × t(s) → kWh
            energy_kwh = (state.power_watts / 1000.0) * (delta_seconds / 3600.0)
            self._session_energy_kwh += energy_kwh
            self._session_peak_watts = max(self._session_peak_watts, state.power_watts)

        if not charging and self._session_active:
            # Session end
            self._close_session(state.metadata.get("soc_percent", 0.0))

    def _close_session(self, end_soc: float) -> None:
        record = EvseSessionRecord(
            session_id=self._next_session_id,
            started_at=self._session_start_time or datetime.now(timezone.utc),
            ended_at=datetime.now(timezone.utc),
            start_soc_pct=self._session_start_soc,
            end_soc_pct=end_soc,
            energy_added_kwh=round(self._session_energy_kwh, 4),
            peak_power_watts=self._session_peak_watts,
            completed=True,
        )
        self._sessions.append(record)
        self._next_session_id += 1
        self._session_active = False
        self._session_energy_kwh = 0.0

    # ------------------------------------------------------------------
    # Session history
    # ------------------------------------------------------------------

    def get_session_history(self, limit: int = 20) -> List[EvseSessionRecord]:
        """Most-recent completed sessions, newest first."""
        return list(reversed(self._sessions))[:limit]

    def get_total_energy_delivered_kwh(self) -> float:
        """Lifetime total energy delivered across all completed sessions."""
        return round(sum(s.energy_added_kwh for s in self._sessions), 4)
