"""
Power Module — Layer 4
Consumer of Layer 2 (twin) and Layer 3 (master_agent).
NEVER touches Layer 1 (devices) directly.

Responsibilities:
- Current household power summary (total + per-device breakdown)
- Per-device power history queries (backed by power_readings table)
- Peak-load detection from history
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import text


@dataclass
class DevicePowerSummary:
    device_id: str
    device_type: str
    operational_state: str
    power_watts: float


@dataclass
class HouseholdPowerSummary:
    total_watts: float
    limit_watts: float
    budget_status: str          # "ok" | "warning" | "critical" | "setup_incomplete"
    utilisation_pct: float      # 0–100
    per_device: List[DevicePowerSummary]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class PowerHistoryRow:
    device_id: str
    timestamp: datetime
    watts: float


class PowerModule:
    """
    Layer 4 power aggregation module.
    Reads from Layer 2 (twin live states + history store) and
    Layer 3 (master_agent for budget status).
    Never calls any Layer 1 method directly.
    """

    def __init__(self, twin, master_agent, db_session_factory) -> None:
        # twin: DigitalTwinCore  — Layer 2
        # master_agent: MasterAgent — Layer 3
        self._twin = twin
        self._agent = master_agent
        self._db = db_session_factory

    # ------------------------------------------------------------------
    # Live summary
    # ------------------------------------------------------------------

    def get_household_summary(self) -> HouseholdPowerSummary:
        """
        Current total power draw and budget status.
        Uses Layer 2 live states + Layer 3 budget check.
        """
        live = self._twin.get_all_live_states()
        budget = self._agent.check_power_budget(live)

        per_device = [
            DevicePowerSummary(
                device_id=s.device_id,
                device_type=s.device_type,
                operational_state=s.operational_state,
                power_watts=s.power_watts,
            )
            for s in live.values()
        ]

        util = (
            (budget.total_load_watts / budget.limit_watts * 100.0)
            if budget.limit_watts > 0
            else 0.0
        )

        return HouseholdPowerSummary(
            total_watts=budget.total_load_watts,
            limit_watts=budget.limit_watts,
            budget_status=budget.status,
            utilisation_pct=round(util, 1),
            per_device=per_device,
        )

    # ------------------------------------------------------------------
    # History queries (backed by power_readings — Decision B)
    # ------------------------------------------------------------------

    def get_device_history(
        self,
        device_id: str,
        from_ts: Optional[datetime] = None,
        to_ts: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[PowerHistoryRow]:
        """
        Power reading history for one device from power_readings table.
        """
        db = self._db()
        try:
            filters = ["device_id = :device_id"]
            params: Dict = {"device_id": device_id, "limit": limit}

            if from_ts:
                filters.append("timestamp >= :from_ts")
                params["from_ts"] = from_ts
            if to_ts:
                filters.append("timestamp <= :to_ts")
                params["to_ts"] = to_ts

            where = " AND ".join(filters)
            rows = db.execute(
                text(
                    f"SELECT device_id, timestamp, power_watts "
                    f"FROM power_readings WHERE {where} "
                    f"ORDER BY timestamp DESC LIMIT :limit"
                ),
                params,
            ).fetchall()

            return [
                PowerHistoryRow(
                    device_id=r[0],
                    timestamp=r[1],
                    watts=float(r[2]),
                )
                for r in rows
            ]
        finally:
            db.close()

    def get_all_history(
        self,
        from_ts: Optional[datetime] = None,
        to_ts: Optional[datetime] = None,
        device_id: Optional[str] = None,
        limit: int = 5000,
    ) -> List[PowerHistoryRow]:
        """
        Power reading history across all (or one) device(s).
        Backing store for the CSV/XLSX export endpoint.
        """
        db = self._db()
        try:
            filters: List[str] = []
            params: Dict = {"limit": limit}

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
            rows = db.execute(
                text(
                    f"SELECT device_id, timestamp, power_watts "
                    f"FROM power_readings {where} "
                    f"ORDER BY timestamp ASC LIMIT :limit"
                ),
                params,
            ).fetchall()

            return [
                PowerHistoryRow(device_id=r[0], timestamp=r[1], watts=float(r[2]))
                for r in rows
            ]
        finally:
            db.close()

    def get_peak_load(
        self,
        from_ts: Optional[datetime] = None,
        to_ts: Optional[datetime] = None,
    ) -> Optional[float]:
        """
        Maximum single-tick total load recorded in the given window.
        Sums all devices per timestamp then returns the max sum.
        """
        db = self._db()
        try:
            filters: List[str] = []
            params: Dict = {}

            if from_ts:
                filters.append("timestamp >= :from_ts")
                params["from_ts"] = from_ts
            if to_ts:
                filters.append("timestamp <= :to_ts")
                params["to_ts"] = to_ts

            where = ("WHERE " + " AND ".join(filters)) if filters else ""
            row = db.execute(
                text(
                    f"SELECT MAX(tick_total) FROM ("
                    f"  SELECT timestamp, SUM(power_watts) AS tick_total "
                    f"  FROM power_readings {where} "
                    f"  GROUP BY timestamp"
                    f") AS tick_sums"
                ),
                params,
            ).fetchone()

            return float(row[0]) if row and row[0] is not None else None
        finally:
            db.close()
