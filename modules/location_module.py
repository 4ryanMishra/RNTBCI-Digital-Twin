"""
Location Module — Layer 4
Consumer of Layer 3 (system_config_manager) only.
NEVER touches Layer 1 directly.

Responsibilities:
- Exposes the configured villa tier and its electrical parameters
  (contracted power, rated current, phase config, voltage)
- Acts as the single place the frontend reads household identity/setup from
- Per MASTER_SPEC.md Decision C: returns setup_incomplete status when
  the tier has not yet been selected
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy import text


@dataclass
class LocationInfo:
    """Resolved villa configuration."""
    tier: Optional[str]               # 'small' | 'medium' | 'large' | None
    phase_config: Optional[str]       # 'single_phase' | 'three_phase'
    voltage_v: Optional[float]
    contracted_power_kva: Optional[float]
    current_rating_a: Optional[float]
    setup_complete: bool


class LocationModule:
    """
    Layer 4 location/site module.
    Reads from system_config (Layer 3) and villa_tier_presets (DB lookup).
    Never reads device state — not its concern.
    """

    def __init__(self, config_manager, db_session_factory) -> None:
        self._config = config_manager
        self._db = db_session_factory

    def get_location_info(self) -> LocationInfo:
        """
        Return the current villa configuration.
        If setup is incomplete, returns LocationInfo with setup_complete=False
        and all tier fields as None.
        """
        if not self._config.is_setup_complete():
            return LocationInfo(
                tier=None,
                phase_config=None,
                voltage_v=None,
                contracted_power_kva=None,
                current_rating_a=None,
                setup_complete=False,
            )

        kva = self._config.get_contracted_power_kva()
        amps = self._config.get_current_rating_a()

        # Resolve tier name + phase config from villa_tier_presets by matching kva/amps
        tier, phase_config, voltage_v = self._resolve_tier(kva, amps)

        return LocationInfo(
            tier=tier,
            phase_config=phase_config,
            voltage_v=voltage_v,
            contracted_power_kva=kva,
            current_rating_a=amps,
            setup_complete=True,
        )

    def _resolve_tier(
        self,
        kva: Optional[float],
        amps: Optional[float],
    ) -> tuple[Optional[str], Optional[str], Optional[float]]:
        """
        Match system_config values back to the villa_tier_presets row to get
        tier name, phase_config, and voltage.  Returns (None, None, None) if
        no match found (e.g. manually overridden values).
        """
        if kva is None or amps is None:
            return None, None, None

        db = self._db()
        try:
            row = db.execute(
                text(
                    "SELECT tier, phase_config, voltage_v "
                    "FROM villa_tier_presets "
                    "WHERE contracted_power_kva = :kva "
                    "  AND current_rating_a = :amps "
                    "LIMIT 1"
                ),
                {"kva": kva, "amps": amps},
            ).fetchone()

            if row:
                return row[0], row[1], float(row[2])
            return None, None, None
        finally:
            db.close()
