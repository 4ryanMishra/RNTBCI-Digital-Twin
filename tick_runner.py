"""
Simulation Tick Runner
Drives the digital twin forward in real time and fires WebSocket events.

Per MASTER_SPEC.md Part 6 throttling rules:
- power_reading  → broadcast every 2 s  (DB still gets a row every tick)
- state_change   → immediate on user commands (fired by the control endpoint)
- duty_cycle_toggle → immediate when fridge compressor flips
- soc_taper_update  → immediate on EVSE taper boundary crossing only
- alert             → immediate (fired by master_agent / power-budget endpoint)

The runner only fires the *autonomous* events — duty_cycle_toggle and
soc_taper_update — because those originate from the simulation clock, not
from a user command.  state_change on user commands is fired by the control
endpoint itself.

This module is intentionally free of FastAPI imports so it can be unit-tested
standalone.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional

from digital_twin_core import DigitalTwinCore
from device_interface import DeviceState
from system_config_manager import SystemConfigManager
from master_agent import MasterAgent
from ws_broadcaster import ConnectionManager

logger = logging.getLogger(__name__)

# How many real-time seconds between each simulation tick
TICK_INTERVAL_S: float = 1.0

# How many ticks between power_reading WebSocket broadcasts (2 s throttle)
POWER_READING_BROADCAST_EVERY_N_TICKS: int = 2


class TickRunner:
    """
    Async background task that:
    1. Advances the digital twin one tick per TICK_INTERVAL_S
    2. Detects autonomous state changes (fridge duty-cycle, EVSE taper)
    3. Broadcasts the correct WS events per Part 6 rules
    4. Runs budget checks and fires alerts via MasterAgent
    """

    def __init__(
        self,
        twin: DigitalTwinCore,
        config_manager: SystemConfigManager,
        master_agent: MasterAgent,
        ws: ConnectionManager,
    ) -> None:
        self._twin = twin
        self._config = config_manager
        self._agent = master_agent
        self._ws = ws

        # Track previous per-device state so we can diff on each tick
        self._prev_states: Dict[str, DeviceState] = {}

        self._tick_count: int = 0
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Schedule the background tick loop on the running event loop."""
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="tick_runner")
        logger.info("TickRunner started (interval=%.1fs)", TICK_INTERVAL_S)

    def stop(self) -> None:
        """Cancel the background task gracefully."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("TickRunner stopped")

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        try:
            while self._running:
                await asyncio.sleep(TICK_INTERVAL_S)
                await self._tick()
        except asyncio.CancelledError:
            logger.debug("TickRunner loop cancelled")
        except Exception as exc:
            logger.exception("TickRunner loop crashed: %s", exc)

    async def _tick(self) -> None:
        """One simulation tick: advance twin → diff states → broadcast events."""
        self._tick_count += 1

        # 1. Snapshot states BEFORE advancing so we can diff
        prev: Dict[str, DeviceState] = {
            did: s for did, s in self._twin.get_all_live_states().items()
        }

        # 2. Advance twin (updates live store + writes history row per Decision B)
        self._twin.tick(TICK_INTERVAL_S)

        # 3. Snapshot states AFTER advancing
        curr: Dict[str, DeviceState] = self._twin.get_all_live_states()

        # 4. Detect and broadcast autonomous events
        await self._detect_events(prev, curr)

        # 5. Power reading broadcast every 2 ticks (throttled)
        if self._tick_count % POWER_READING_BROADCAST_EVERY_N_TICKS == 0:
            await self._broadcast_power_reading(curr)

    # ------------------------------------------------------------------
    # Event detection
    # ------------------------------------------------------------------

    async def _detect_events(
        self,
        prev: Dict[str, DeviceState],
        curr: Dict[str, DeviceState],
    ) -> None:
        for did, state in curr.items():
            p = prev.get(did)

            if state.device_type == "refrigerator":
                await self._check_duty_cycle(did, p, state)

            elif state.device_type == "evse":
                await self._check_taper(did, p, state)

    async def _check_duty_cycle(
        self,
        device_id: str,
        prev: Optional[DeviceState],
        curr: DeviceState,
    ) -> None:
        """Fire duty_cycle_toggle if compressor flipped since last tick."""
        if prev is None:
            return

        prev_on: bool = prev.metadata.get("compressor_on", False)
        curr_on: bool = curr.metadata.get("compressor_on", False)

        if prev_on != curr_on:
            logger.debug(
                "duty_cycle_toggle: %s compressor %s → %s",
                device_id,
                prev_on,
                curr_on,
            )
            await self._ws.emit_duty_cycle_toggle(
                device_id=device_id,
                compressor_on=curr_on,
                power_watts=curr.power_watts,
            )

    async def _check_taper(
        self,
        device_id: str,
        prev: Optional[DeviceState],
        curr: DeviceState,
    ) -> None:
        """
        Fire soc_taper_update only when the EVSE crosses the taper boundary.
        Per Part 6: 'Immediate, on taper zone enter/exit — not continuous.'
        """
        if prev is None:
            return

        prev_tapering: bool = prev.metadata.get("is_tapering", False)
        curr_tapering: bool = curr.metadata.get("is_tapering", False)

        if prev_tapering != curr_tapering:
            logger.info(
                "soc_taper_update: %s entered_taper=%s  soc=%.1f%%",
                device_id,
                curr_tapering,
                curr.metadata.get("soc_percent", 0.0),
            )
            await self._ws.emit_soc_taper_update(
                device_id=device_id,
                soc_percent=curr.metadata.get("soc_percent", 0.0),
                power_watts=curr.power_watts,
                entered_taper=curr_tapering,
            )

    # ------------------------------------------------------------------
    # Power reading broadcast (throttled)
    # ------------------------------------------------------------------

    async def _broadcast_power_reading(
        self, curr: Dict[str, DeviceState]
    ) -> None:
        """
        Broadcast current power snapshot to all WS clients.
        Only fires if setup is complete (no kVA limit available otherwise).
        """
        if not self._config.is_setup_complete():
            return

        total = sum(s.power_watts for s in curr.values())
        kva = self._config.get_contracted_power_kva() or 0.0
        limit_w = kva * 1000.0

        # Determine status string (matches PowerBudget schema)
        ratio = total / limit_w if limit_w > 0 else 0.0
        if ratio >= 0.95:
            budget_status = "critical"
        elif ratio >= 0.80:
            budget_status = "warning"
        else:
            budget_status = "ok"

        per_device = [
            {"device_id": did, "watts": s.power_watts}
            for did, s in curr.items()
        ]

        await self._ws.emit_power_reading(
            total_draw_watts=total,
            limit_watts=limit_w,
            status=budget_status,
            per_device=per_device,
        )
