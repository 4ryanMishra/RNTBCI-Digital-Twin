"""
Phase 5 smoke tests — no database, no network required.

What is verified:
  1. All Phase 5 modules import cleanly
  2. ws_broadcaster: ConnectionManager API is complete and typed correctly
  3. routers/deps: set_globals + require_setup gate
  4. routers/devices: _camel_to_snake helper
  5. tick_runner: TickRunner wires to DigitalTwinCore correctly,
                  duty_cycle_toggle and soc_taper_update fire on the right tick,
                  power_reading is throttled to every 2 ticks
  6. api_server:   app is a FastAPI instance; /health route registered;
                   /ws route registered; routers mounted at /api/v1
  7. Decision A:   MasterAgent still has no throttle methods (regression guard)
"""
import asyncio
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _ok(msg: str) -> None:
    print(f"  ✓  {msg}")

def _fail(msg: str) -> None:
    print(f"  ✗  {msg}", file=sys.stderr)
    raise AssertionError(msg)

def _section(title: str) -> None:
    print(f"\n{'='*60}\n  {title}\n{'='*60}")


# ---------------------------------------------------------------------------
# 1. Import smoke test
# ---------------------------------------------------------------------------

def test_imports() -> None:
    _section("1. Module imports")

    modules = [
        "ws_broadcaster",
        "tick_runner",
        "routers.deps",
        "routers.system",
        "routers.devices",
        "api_server",
    ]
    for mod in modules:
        try:
            __import__(mod)
            _ok(f"import {mod}")
        except Exception as exc:
            _fail(f"import {mod} raised {type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# 2. ws_broadcaster: ConnectionManager API
# ---------------------------------------------------------------------------

def test_broadcaster_api() -> None:
    _section("2. ws_broadcaster — ConnectionManager API")

    from ws_broadcaster import ConnectionManager, broadcaster

    mgr = ConnectionManager()

    required_methods = [
        "connect", "disconnect", "broadcast", "send_to",
        "emit_setup_incomplete", "emit_setup_complete",
        "emit_power_reading", "emit_state_change",
        "emit_alert", "emit_duty_cycle_toggle", "emit_soc_taper_update",
    ]
    for method in required_methods:
        assert hasattr(mgr, method), f"Missing method: {method}"
        _ok(f"has  {method}()")

    # Module-level singleton exists
    assert broadcaster is not None
    _ok("module-level `broadcaster` singleton present")

    # _clients starts empty
    assert mgr._clients == []
    _ok("_clients initialises empty")


# ---------------------------------------------------------------------------
# 3. routers/deps: set_globals + require_setup gate
# ---------------------------------------------------------------------------

def test_deps() -> None:
    _section("3. routers/deps — injection + setup gate")
    import routers.deps as deps
    from fastapi import HTTPException

    # set_globals populates references
    mock_twin = MagicMock()
    mock_cfg = MagicMock()
    mock_agent = MagicMock()
    deps.set_globals(mock_twin, mock_cfg, mock_agent)

    assert deps.get_twin() is mock_twin
    _ok("get_twin() returns injected twin")
    assert deps.get_config_manager() is mock_cfg
    _ok("get_config_manager() returns injected config_manager")
    assert deps.get_master_agent() is mock_agent
    _ok("get_master_agent() returns injected master_agent")

    # require_setup raises 409 when setup incomplete
    mock_cfg.is_setup_complete.return_value = False
    try:
        deps.require_setup(mock_cfg)
        _fail("require_setup should have raised 409 when setup incomplete")
    except HTTPException as exc:
        assert exc.status_code == 409
        _ok("require_setup raises HTTP 409 when setup_incomplete")

    # require_setup passes when setup complete
    mock_cfg.is_setup_complete.return_value = True
    deps.require_setup(mock_cfg)   # must not raise
    _ok("require_setup passes when setup complete")


# ---------------------------------------------------------------------------
# 4. routers/devices: _camel_to_snake
# ---------------------------------------------------------------------------

def test_camel_to_snake() -> None:
    _section("4. routers/devices — _camel_to_snake")
    from routers.devices import _camel_to_snake

    cases = [
        ("initialSocPercent", "initial_soc_percent"),
        ("targetTemperatureCelsius", "target_temperature_celsius"),
        ("cookTimeSeconds", "cook_time_seconds"),
        ("on", "on"),
        ("powerWatts", "power_watts"),
    ]
    for camel, expected in cases:
        result = _camel_to_snake(camel)
        assert result == expected, f"{camel} → expected '{expected}', got '{result}'"
        _ok(f"_camel_to_snake('{camel}') == '{expected}'")


# ---------------------------------------------------------------------------
# 5. tick_runner: TickRunner logic (async, no network)
# ---------------------------------------------------------------------------

def test_tick_runner() -> None:
    _section("5. tick_runner — duty_cycle_toggle + soc_taper_update + power_reading throttle")

    asyncio.run(_async_tick_runner())


async def _async_tick_runner() -> None:
    from tick_runner import TickRunner, POWER_READING_BROADCAST_EVERY_N_TICKS
    from device_interface import DeviceState

    # ------ Minimal stubs ------

    def _state(device_id, device_type, compressor_on=None, is_tapering=None,
                soc=0.0, power=0.0, op_state="running"):
        meta = {}
        if compressor_on is not None:
            meta["compressor_on"] = compressor_on
        if is_tapering is not None:
            meta["is_tapering"] = is_tapering
            meta["soc_percent"] = soc
        return DeviceState(
            device_id=device_id,
            device_type=device_type,
            operational_state=op_state,
            power_watts=power,
            metadata=meta,
        )

    # States: fridge compressor was ON, will flip to OFF
    prev_fridge = _state("fridge", "refrigerator", compressor_on=True, power=150.0)
    curr_fridge  = _state("fridge", "refrigerator", compressor_on=False, power=5.0)

    # States: EVSE crosses taper boundary (False → True)
    prev_evse = _state("evse", "evse", is_tapering=False, soc=79.0, power=7000.0)
    curr_evse = _state("evse", "evse", is_tapering=True,  soc=80.1, power=6930.0)

    call_seq = []

    # Mock twin
    twin = MagicMock()
    twin.get_all_live_states.side_effect = [
        # First _tick() call: before-advance snapshot
        {"fridge": prev_fridge, "evse": prev_evse},
        # After twin.tick(), curr snapshot
        {"fridge": curr_fridge, "evse": curr_evse},
    ]
    twin.tick = MagicMock()

    # Mock config
    cfg = MagicMock()
    cfg.is_setup_complete.return_value = True
    cfg.get_contracted_power_kva.return_value = 9.0

    # Mock agent (not used by tick runner directly)
    agent = MagicMock()

    # Mock broadcaster
    ws = MagicMock()
    ws.emit_duty_cycle_toggle = AsyncMock(side_effect=lambda **kw: call_seq.append(("dct", kw)))
    ws.emit_soc_taper_update  = AsyncMock(side_effect=lambda **kw: call_seq.append(("stu", kw)))
    ws.emit_power_reading     = AsyncMock(side_effect=lambda **kw: call_seq.append(("pr",  kw)))

    runner = TickRunner(twin, cfg, agent, ws)

    # --- Single tick with tick_count = 1 (no power_reading yet) ---
    runner._tick_count = 0
    await runner._tick()

    assert twin.tick.called
    _ok("twin.tick() called on each runner tick")

    dct_calls = [c for c in call_seq if c[0] == "dct"]
    assert len(dct_calls) == 1
    assert dct_calls[0][1]["compressor_on"] is False
    _ok("duty_cycle_toggle fired when fridge compressor flipped")

    stu_calls = [c for c in call_seq if c[0] == "stu"]
    assert len(stu_calls) == 1
    assert stu_calls[0][1]["entered_taper"] is True
    _ok("soc_taper_update fired when EVSE entered taper zone")

    # power_reading fires on tick 2 (POWER_READING_BROADCAST_EVERY_N_TICKS = 2)
    pr_calls_tick1 = [c for c in call_seq if c[0] == "pr"]
    assert len(pr_calls_tick1) == 0
    _ok(f"power_reading NOT broadcast on tick 1 (throttled to every {POWER_READING_BROADCAST_EVERY_N_TICKS} ticks)")

    # --- Second tick: power_reading should now fire ---
    twin.get_all_live_states.side_effect = [
        {"fridge": curr_fridge, "evse": curr_evse},
        {"fridge": curr_fridge, "evse": curr_evse},
    ]
    await runner._tick()

    pr_calls_tick2 = [c for c in call_seq if c[0] == "pr"]
    assert len(pr_calls_tick2) == 1
    _ok("power_reading broadcast on tick 2")

    pr = pr_calls_tick2[0][1]
    assert pr["limit_watts"] == 9000.0
    _ok(f"power_reading limit_watts = {pr['limit_watts']} (9 kVA × 1000)")


# ---------------------------------------------------------------------------
# 6. api_server: FastAPI app structure
# ---------------------------------------------------------------------------

def test_api_server_structure() -> None:
    _section("6. api_server — app structure")
    from api_server import app
    from fastapi import FastAPI

    assert isinstance(app, FastAPI)
    _ok("app is a FastAPI instance")

    # Use url_path_for — resolves even when FastAPI flattens routers into
    # _IncludedRouter objects that don't expose .path on the top-level app.
    def url(name, **kw):
        try:
            return str(app.url_path_for(name, **kw))
        except Exception as exc:
            _fail(f"Route '{name}' not registered: {exc}")

    assert url("health") == "/health"
    _ok("GET /health registered")

    # WebSocket route — check via app.routes directly (websockets don't get
    # named routes via url_path_for in all FastAPI versions)
    ws_paths = {getattr(r, "path", None) for r in app.routes}
    assert "/ws" in ws_paths, f"/ws not in top-level routes: {ws_paths}"
    _ok("WS  /ws registered")

    # System router
    assert url("setup_system") == "/api/v1/system/setup"
    _ok("POST /api/v1/system/setup registered")

    assert url("get_power_budget") == "/api/v1/system/power-budget"
    _ok("GET  /api/v1/system/power-budget registered")

    assert url("get_alerts") == "/api/v1/system/alerts"
    _ok("GET  /api/v1/system/alerts registered")

    # Devices router
    assert url("get_device", device_id="evse_01") == "/api/v1/devices/evse_01"
    _ok("GET  /api/v1/devices/{device_id} registered")

    assert url("control_device", device_id="evse_01") == "/api/v1/devices/evse_01/control"
    _ok("POST /api/v1/devices/{device_id}/control registered")


# ---------------------------------------------------------------------------
# 7. Decision A regression: MasterAgent still has no throttle methods
# ---------------------------------------------------------------------------

def test_decision_a_no_throttle() -> None:
    _section("7. Decision A regression — no throttle methods on MasterAgent")
    from master_agent import MasterAgent

    throttle_names = [
        name for name in dir(MasterAgent)
        if "throttle" in name.lower() and not name.startswith("__")
    ]
    assert throttle_names == [], \
        f"VIOLATION: MasterAgent has throttle methods: {throttle_names}"
    _ok("MasterAgent has ZERO throttle methods (Decision A enforced)")

    assert hasattr(MasterAgent, "fire_alert")
    _ok("MasterAgent.fire_alert() present")

    assert hasattr(MasterAgent, "check_power_budget")
    _ok("MasterAgent.check_power_budget() present")

    assert hasattr(MasterAgent, "check_and_fire_alerts")
    _ok("MasterAgent.check_and_fire_alerts() present")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def main() -> int:
    tests = [
        test_imports,
        test_broadcaster_api,
        test_deps,
        test_camel_to_snake,
        test_tick_runner,
        test_api_server_structure,
        test_decision_a_no_throttle,
    ]

    passed = failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as exc:
            print(f"\n  ✗  FAILED: {exc}", file=sys.stderr)
            failed += 1
        except Exception as exc:
            import traceback
            print(f"\n  ✗  ERROR in {test.__name__}:", file=sys.stderr)
            traceback.print_exc()
            failed += 1

    print(f"\n{'='*60}")
    print(f"  Phase 5 results: {passed} passed, {failed} failed")
    print(f"{'='*60}\n")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
