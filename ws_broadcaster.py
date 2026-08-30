"""
WebSocket Broadcaster
Singleton connection manager for the single multiplexed socket.
Per MASTER_SPEC.md Part 6: single socket, all events multiplexed.

Events emitted:
- setup_incomplete / setup_complete  (on connect / on tier selection)
- power_reading                      (every 2 s, throttled — DB still gets row every tick)
- state_change                       (immediate, on any device on/off or mode switch)
- alert                              (immediate, never batched)
- duty_cycle_toggle                  (immediate, fridge compressor flip)
- soc_taper_update                   (immediate, EVSE taper zone enter/exit only)
"""
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConnectionManager:
    """Thread-safe WebSocket connection registry with typed broadcast helpers."""

    def __init__(self) -> None:
        self._clients: List[WebSocket] = []

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.append(ws)
        logger.info("WS client connected  (total=%d)", len(self._clients))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._clients:
            self._clients.remove(ws)
        logger.info("WS client disconnected (total=%d)", len(self._clients))

    # ------------------------------------------------------------------
    # Low-level send helpers
    # ------------------------------------------------------------------

    async def _send(self, ws: WebSocket, payload: Dict[str, Any]) -> bool:
        """Send one payload to one client.  Returns False if the client is gone."""
        try:
            await ws.send_text(json.dumps(payload))
            return True
        except Exception as exc:
            logger.debug("WS send failed (%s) — removing client", exc)
            return False

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        """Broadcast to all connected clients; remove dead ones."""
        dead: List[WebSocket] = []
        for ws in list(self._clients):
            ok = await self._send(ws, payload)
            if not ok:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_to(self, ws: WebSocket, payload: Dict[str, Any]) -> None:
        """Send to a single client only (used for on-connect handshake)."""
        ok = await self._send(ws, payload)
        if not ok:
            self.disconnect(ws)

    # ------------------------------------------------------------------
    # Typed event helpers  (match MASTER_SPEC.md Part 6 event names)
    # ------------------------------------------------------------------

    async def emit_setup_incomplete(self, ws: WebSocket) -> None:
        await self.send_to(ws, {
            "event": "setup_incomplete",
            "timestamp": _now_iso(),
            "data": {"message": "System configuration required. Select a villa tier."},
        })

    async def emit_setup_complete(
        self,
        tier: str,
        contracted_power_kva: float,
        current_rating_a: float,
    ) -> None:
        await self.broadcast({
            "event": "setup_complete",
            "timestamp": _now_iso(),
            "data": {
                "tier": tier,
                "contractedPowerKva": contracted_power_kva,
                "currentRatingA": current_rating_a,
            },
        })

    async def emit_power_reading(
        self,
        total_draw_watts: float,
        limit_watts: float,
        status: str,
        per_device: List[Dict[str, Any]],
    ) -> None:
        """Throttled to 2 s by the tick_runner — this method just sends."""
        await self.broadcast({
            "event": "power_reading",
            "timestamp": _now_iso(),
            "data": {
                "totalDrawWatts": total_draw_watts,
                "limitWatts": limit_watts,
                "status": status,
                "perDevice": [
                    {"deviceId": d["device_id"], "watts": d["watts"]}
                    for d in per_device
                ],
            },
        })

    async def emit_state_change(
        self,
        device_id: str,
        operational_state: str,
        power_watts: float,
        metadata: Dict[str, Any],
    ) -> None:
        await self.broadcast({
            "event": "state_change",
            "timestamp": _now_iso(),
            "deviceId": device_id,
            "data": {
                "operationalState": operational_state,
                "powerWatts": power_watts,
                "metadata": metadata,
            },
        })

    async def emit_alert(
        self,
        alert_type: str,
        message: str,
        total_load_watts: float,
        limit_watts: float,
    ) -> None:
        await self.broadcast({
            "event": "alert",
            "timestamp": _now_iso(),
            "data": {
                "alertType": alert_type,
                "message": message,
                "totalLoadWatts": total_load_watts,
                "limitWatts": limit_watts,
            },
        })

    async def emit_duty_cycle_toggle(
        self,
        device_id: str,
        compressor_on: bool,
        power_watts: float,
    ) -> None:
        """Fires when fridge compressor flips — distinct from a user state_change."""
        await self.broadcast({
            "event": "duty_cycle_toggle",
            "timestamp": _now_iso(),
            "deviceId": device_id,
            "data": {
                "compressorOn": compressor_on,
                "powerWatts": power_watts,
            },
        })

    async def emit_soc_taper_update(
        self,
        device_id: str,
        soc_percent: float,
        power_watts: float,
        entered_taper: bool,
    ) -> None:
        """Fires only when EVSE crosses the taper boundary — not on every tick."""
        await self.broadcast({
            "event": "soc_taper_update",
            "timestamp": _now_iso(),
            "deviceId": device_id,
            "data": {
                "socPercent": soc_percent,
                "powerWatts": power_watts,
                "enteredTaper": entered_taper,   # True = just entered, False = just exited (e.g. new session)
            },
        })


# Module-level singleton — import this everywhere
broadcaster = ConnectionManager()
