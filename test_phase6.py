"""
Phase 6 smoke tests — no database, no network required.

Sections:
  1. Module imports
  2. PowerModule — household summary + layer-boundary enforcement
  3. EvBatteryModule — session tracking, energy accumulation, minutes-to-full
  4. LocationModule — setup_complete=False path (no DB)
  5. DeviceHealthModule — healthy / fault / uptime logic
  6. Matter envelope — _build_matter_envelope() for all device types
  7. routers/modules_router routes registered
  8. Export route registered on system router
  9. deps.py — new module accessors wired correctly
 10. Layer 1 isolation — modules never call Layer 1 methods directly
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

from device_interface import DeviceState


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _ok(msg: str) -> None:
    print(f"  \u2713  {msg}")


def _fail(msg: str) -> None:
    print(f"  \u2717  {msg}", file=sys.stderr)
    raise AssertionError(msg)


def _section(title: str) -> None:
    print(f"\n{'='*60}\n  {title}\n{'='*60}")


def _state(device_id="dev", device_type="light", op_state="running",
           power=15.0, meta=None):
    return DeviceState(
        device_id=device_id,
        device_type=device_type,
        operational_state=op_state,
        power_watts=power,
        metadata=meta or {},
    )


# ---------------------------------------------------------------------------
# 1. Imports
# ---------------------------------------------------------------------------

def test_imports() -> None:
    _section("1. Module imports")
    mods = [
        "modules.power_module",
        "modules.ev_battery_module",
        "modules.location_module",
        "modules.device_health_module",
        "routers.modules_router",
    ]
    for m in mods:
        try:
            __import__(m)
            _ok(f"import {m}")
        except Exception as exc:
            _fail(f"import {m} raised {type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# 2. PowerModule
# ---------------------------------------------------------------------------

def test_power_module() -> None:
    _section("2. PowerModule — summary + layer boundary")
    from modules.power_module import PowerModule

    # Stub twin (Layer 2) — returns known live states
    twin = MagicMock()
    twin.get_all_live_states.return_value = {
        "evse_01":  _state("evse_01",  "evse",       "running", 7000.0),
        "light_01": _state("light_01", "light",      "running",   15.0),
        "cctv_01":  _state("cctv_01",  "cctv",       "running",   10.0),
    }

    # Stub master_agent (Layer 3) — returns a budget with known values
    agent = MagicMock()
    budget = MagicMock()
    budget.total_load_watts = 7025.0
    budget.limit_watts      = 9000.0
    budget.status           = "ok"
    budget.per_device = [
        {"device_id": "evse_01",  "watts": 7000.0},
        {"device_id": "light_01", "watts":   15.0},
        {"device_id": "cctv_01",  "watts":   10.0},
    ]
    agent.check_power_budget.return_value = budget

    pm = PowerModule(twin, agent, db_session_factory=None)

    summary = pm.get_household_summary()

    assert summary.total_watts == 7025.0
    _ok(f"total_watts = {summary.total_watts}")

    assert summary.limit_watts == 9000.0
    _ok(f"limit_watts = {summary.limit_watts}")

    assert summary.budget_status == "ok"
    _ok(f"budget_status = {summary.budget_status!r}")

    expected_util = round(7025.0 / 9000.0 * 100, 1)
    assert summary.utilisation_pct == expected_util
    _ok(f"utilisation_pct = {summary.utilisation_pct}% (expected {expected_util}%)")

    assert len(summary.per_device) == 3
    _ok("per_device has 3 entries")

    # Layer boundary: PowerModule must NOT call any Layer 1 methods
    # The only calls allowed are twin.get_all_live_states() and agent.check_power_budget()
    called = {c[0] for c in twin.method_calls}
    assert "get_all_live_states" in called
    layer1_calls = called - {"get_all_live_states", "get_all_live_states()"}
    forbidden = {c for c in layer1_calls if "apply_command" in c or "get_power_draw" in c}
    assert not forbidden, f"PowerModule called Layer 1 methods: {forbidden}"
    _ok("Layer boundary respected — no Layer 1 calls from PowerModule")


# ---------------------------------------------------------------------------
# 3. EvBatteryModule
# ---------------------------------------------------------------------------

def test_ev_battery_module() -> None:
    _section("3. EvBatteryModule — session tracking + energy accumulation")
    from modules.ev_battery_module import EvBatteryModule

    twin = MagicMock()

    # Start: not charging
    twin.get_live_state.return_value = _state(
        "evse_01", "evse", "off", 0.0,
        {"soc_percent": 50.0, "is_tapering": False,
         "rated_power_watts": 7000.0, "taper_start_soc_percent": 80.0},
    )

    mod = EvBatteryModule(twin)

    snap = mod.get_session_snapshot()
    assert snap is not None
    assert snap.soc_percent == 50.0
    assert snap.power_watts == 0.0
    assert snap.minutes_to_full is None   # not charging
    _ok("snapshot when not charging: minutes_to_full=None")

    # Simulate 3 ticks of charging at 7000 W
    twin.get_live_state.return_value = _state(
        "evse_01", "evse", "running", 7000.0,
        {"soc_percent": 50.0, "is_tapering": False,
         "rated_power_watts": 7000.0, "taper_start_soc_percent": 80.0},
    )
    for _ in range(3):
        mod.on_tick(delta_seconds=1.0)

    # 7000 W × 3 s = 7000/1000 × 3/3600 kWh ≈ 0.005833 kWh
    expected_kwh = round((7000 / 1000) * (3 / 3600), 4)
    snap2 = mod.get_session_snapshot()
    assert snap2 is not None
    assert abs(snap2.energy_added_kwh - expected_kwh) < 0.0001, \
        f"energy_added_kwh={snap2.energy_added_kwh}, expected≈{expected_kwh}"
    _ok(f"energy_added_kwh ≈ {snap2.energy_added_kwh} kWh after 3 ticks at 7 kW")

    # minutes_to_full: 60 kWh battery, 50% remaining = 30 kWh at 7 kW → ~257 min
    assert snap2.minutes_to_full is not None and snap2.minutes_to_full > 0
    _ok(f"minutes_to_full = {snap2.minutes_to_full} min")

    # Stop charging → session closes
    twin.get_live_state.return_value = _state(
        "evse_01", "evse", "off", 0.0,
        {"soc_percent": 52.0},
    )
    mod.on_tick(delta_seconds=1.0)
    sessions = mod.get_session_history()
    assert len(sessions) == 1
    assert sessions[0].completed is True
    _ok(f"session closed on stop: energy={sessions[0].energy_added_kwh} kWh")


# ---------------------------------------------------------------------------
# 4. LocationModule (setup_incomplete path — no DB needed)
# ---------------------------------------------------------------------------

def test_location_module() -> None:
    _section("4. LocationModule — setup_incomplete path")
    from modules.location_module import LocationModule

    cfg = MagicMock()
    cfg.is_setup_complete.return_value = False

    mod = LocationModule(cfg, db_session_factory=None)
    info = mod.get_location_info()

    assert info.setup_complete is False
    _ok("setup_complete=False when not configured")
    assert info.tier is None
    _ok("tier=None when not configured")
    assert info.contracted_power_kva is None
    _ok("contractedPowerKva=None when not configured")


# ---------------------------------------------------------------------------
# 5. DeviceHealthModule
# ---------------------------------------------------------------------------

def test_device_health_module() -> None:
    _section("5. DeviceHealthModule — healthy / fault / uptime")
    from modules.device_health_module import DeviceHealthModule

    twin = MagicMock()
    twin.get_all_live_states.return_value = {
        "light_01": _state("light_01", "light", "running",  15.0),
        "cctv_01":  _state("cctv_01",  "cctv",  "fault",    10.0),
    }
    twin.get_live_state.side_effect = lambda did: {
        "light_01": _state("light_01", "light", "running", 15.0),
        "cctv_01":  _state("cctv_01",  "cctv",  "fault",   10.0),
    }.get(did)

    mod = DeviceHealthModule(twin)
    rollup = mod.get_all_health()

    assert rollup.healthy_count == 1
    _ok("1 healthy device (light_01)")

    assert rollup.fault_count == 1
    _ok("1 fault device (cctv_01)")

    assert rollup.overall == "fault"
    _ok("overall='fault' when any device is in fault state")

    # Single device health
    h = mod.get_device_health("cctv_01")
    assert h is not None
    assert h.health == "fault"
    assert h.fault_message is not None
    _ok(f"cctv_01 health='fault', message={h.fault_message!r}")

    # Uptime: simulate 5 ticks for light_01 (running)
    for _ in range(5):
        mod.on_tick()

    lh = mod.get_device_health("light_01")
    assert lh is not None
    assert lh.uptime_seconds >= 0
    _ok(f"light_01 uptime_seconds={lh.uptime_seconds}s after 5 ticks")


# ---------------------------------------------------------------------------
# 6. Matter envelope
# ---------------------------------------------------------------------------

def test_matter_envelope() -> None:
    _section("6. Matter envelope — _build_matter_envelope()")
    from routers.devices import _build_matter_envelope

    # Generic flat-power device (light)
    s = _state("light_01", "light", "running", 15.0)
    env = _build_matter_envelope(s)
    assert env.device_id == "light_01"
    assert "OnOff" in env.clusters
    assert env.clusters["OnOff"]["attributes"]["OnOff"] is True
    assert "ElectricalPowerMeasurement" in env.clusters
    assert env.clusters["ElectricalPowerMeasurement"]["attributes"]["ActivePower"] == 15.0
    assert "operational_state" in env.meta
    _ok("light: OnOff + ElectricalPowerMeasurement present")

    # EVSE — should add EnergyEvse cluster
    evse_meta = {
        "soc_percent": 82.5,
        "is_tapering": True,
        "taper_start_soc_percent": 80.0,
        "rated_power_watts": 7000.0,
        "is_charging": True,
    }
    se = _state("evse_01", "evse", "running", 6930.0, evse_meta)
    ee = _build_matter_envelope(se)
    assert "EnergyEvse" in ee.clusters
    assert ee.clusters["EnergyEvse"]["attributes"]["StateOfCharge"] == 82.5
    assert ee.clusters["EnergyEvse"]["attributes"]["IsTapering"] is True
    _ok("evse: EnergyEvse cluster with SOC + IsTapering")

    # Refrigerator — should add duty-cycle cluster
    fridge_meta = {
        "compressor_on": False,
        "cycle_on_s": 600,
        "cycle_off_s": 300,
        "time_in_current_phase": 42.0,
    }
    sf = _state("refrigerator_01", "refrigerator", "running", 5.0, fridge_meta)
    ef = _build_matter_envelope(sf)
    assert "RefrigeratorAndTemperatureControlledCabinetMode" in ef.clusters
    attrs = ef.clusters["RefrigeratorAndTemperatureControlledCabinetMode"]["attributes"]
    assert attrs["CompressorOn"] is False
    assert attrs["CycleOnDurationS"] == 600
    _ok("refrigerator: duty-cycle cluster with CompressorOn + cycle durations")

    # CCTV
    sc = _state("cctv_01", "cctv", "running", 10.0)
    ec = _build_matter_envelope(sc)
    assert "CameraAvStreamManagement" in ec.clusters
    _ok("cctv: CameraAvStreamManagement cluster present")


# ---------------------------------------------------------------------------
# 7. Module router routes registered
# ---------------------------------------------------------------------------

def test_modules_router_routes() -> None:
    _section("7. modules_router — routes registered")
    from api_server import app

    expected = [
        ("power_summary",      {}),
        ("power_history",      {}),
        ("ev_session",         {}),
        ("ev_session_history", {}),
        ("location",           {}),
        ("household_health",   {}),
        ("device_health",      {"device_id": "x"}),
    ]
    for name, kwargs in expected:
        try:
            path = str(app.url_path_for(name, **kwargs))
            _ok(f"{name} → {path}")
        except Exception as exc:
            _fail(f"Route '{name}' not registered: {exc}")


# ---------------------------------------------------------------------------
# 8. Export route registered
# ---------------------------------------------------------------------------

def test_export_route() -> None:
    _section("8. Export route registered")
    from api_server import app

    try:
        path = str(app.url_path_for("export_power_readings"))
        _ok(f"export_power_readings → {path}")
    except Exception as exc:
        _fail(f"export_power_readings route not registered: {exc}")


# ---------------------------------------------------------------------------
# 9. deps.py module accessors
# ---------------------------------------------------------------------------

def test_deps_module_accessors() -> None:
    _section("9. deps.py — module accessors")
    import routers.deps as deps

    mock_power   = MagicMock(name="power_module")
    mock_ev      = MagicMock(name="ev_module")
    mock_loc     = MagicMock(name="location_module")
    mock_health  = MagicMock(name="health_module")
    mock_twin    = MagicMock(name="twin")
    mock_cfg     = MagicMock(name="cfg")
    mock_agent   = MagicMock(name="agent")

    deps.set_globals(mock_twin, mock_cfg, mock_agent,
                     mock_power, mock_ev, mock_loc, mock_health)

    assert deps.get_power_module()    is mock_power;  _ok("get_power_module() wired")
    assert deps.get_ev_module()       is mock_ev;     _ok("get_ev_module() wired")
    assert deps.get_location_module() is mock_loc;    _ok("get_location_module() wired")
    assert deps.get_health_module()   is mock_health; _ok("get_health_module() wired")


# ---------------------------------------------------------------------------
# 10. Layer 1 isolation — modules must not expose Layer 1 methods
# ---------------------------------------------------------------------------

def test_layer1_isolation() -> None:
    _section("10. Layer 1 isolation — no direct Layer 1 access in modules")

    layer1_methods = {"get_power_draw", "apply_command", "tick"}

    import modules.power_module as pm
    import modules.ev_battery_module as evm
    import modules.location_module as lm
    import modules.device_health_module as dhm

    for mod_name, mod in [
        ("power_module",         pm),
        ("ev_battery_module",    evm),
        ("location_module",      lm),
        ("device_health_module", dhm),
    ]:
        import ast, inspect, textwrap
        src = inspect.getsource(mod)
        for method in layer1_methods:
            # Check the source doesn't call Layer 1 interface methods directly
            # (calling .tick() on a device object would be a Layer 1 violation;
            #  calling twin.get_all_live_states() is Layer 2 — allowed)
            # We look for patterns like "device.apply_command" or ".get_power_draw()"
            # being called outside of the twin/store wrapper.
            pattern = f"device.{method}"
            assert pattern not in src, \
                f"VIOLATION: {mod_name} calls Layer 1 '{pattern}' directly"
        _ok(f"{mod_name}: no direct Layer 1 device calls")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def main() -> int:
    tests = [
        test_imports,
        test_power_module,
        test_ev_battery_module,
        test_location_module,
        test_device_health_module,
        test_matter_envelope,
        test_modules_router_routes,
        test_export_route,
        test_deps_module_accessors,
        test_layer1_isolation,
    ]

    passed = failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as exc:
            print(f"\n  \u2717  FAILED: {exc}", file=sys.stderr)
            failed += 1
        except Exception as exc:
            import traceback
            print(f"\n  \u2717  ERROR in {test.__name__}:", file=sys.stderr)
            traceback.print_exc()
            failed += 1

    print(f"\n{'='*60}")
    print(f"  Phase 6 results: {passed} passed, {failed} failed")
    print(f"{'='*60}\n")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
