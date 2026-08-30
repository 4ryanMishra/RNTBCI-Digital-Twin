"""
Phase 3 Tests - Digital Twin Core Validation
Tests live state store, history store, and core orchestration.
"""
from live_state_store import LiveStateStore
from device_interface import DeviceState
from simulation_adapter import FlatPowerDevice, TaperDevice
from digital_twin_core import DigitalTwinCore


def test_live_state_store():
    """Test live state store operations."""
    print("\n" + "="*60)
    print("Testing Live State Store")
    print("="*60)
    
    store = LiveStateStore()
    
    # Test empty store
    assert store.device_count() == 0, "Empty store should have 0 devices"
    print("  ✓ Empty store initialized")
    
    # Add a state
    state1 = DeviceState(
        device_id="test_01",
        device_type="light",
        operational_state="running",
        power_watts=15.0,
        metadata={}
    )
    store.update_state("test_01", state1)
    
    assert store.device_count() == 1, "Should have 1 device"
    retrieved = store.get_state("test_01")
    assert retrieved is not None, "Should retrieve state"
    assert retrieved.power_watts == 15.0, "Power should match"
    print("  ✓ State stored and retrieved")
    
    # Test total power calculation
    state2 = DeviceState(
        device_id="test_02",
        device_type="evse",
        operational_state="running",
        power_watts=7000.0,
        metadata={}
    )
    store.update_state("test_02", state2)
    
    total_power = store.get_total_power()
    assert abs(total_power - 7015.0) < 0.1, f"Total power should be 7015W, got {total_power}W"
    print(f"  ✓ Total power calculation: {total_power}W")
    
    # Test get_all_states
    all_states = store.get_all_states()
    assert len(all_states) == 2, "Should have 2 states"
    print("  ✓ Get all states")
    
    # Test clear
    store.clear()
    assert store.device_count() == 0, "Cleared store should have 0 devices"
    print("  ✓ Store cleared")
    
    print("\nLive State Store: PASSED ✓\n")


def test_digital_twin_core_without_history():
    """Test digital twin core with live store only."""
    print("\n" + "="*60)
    print("Testing Digital Twin Core (No History Store)")
    print("="*60)
    
    live_store = LiveStateStore()
    twin = DigitalTwinCore(live_store=live_store, history_store=None)
    
    # Register devices
    light = FlatPowerDevice(
        device_id="light_test",
        device_type="light",
        rated_power_config={"rated_power_watts": 15.0}
    )
    twin.register_device(light)
    
    evse = TaperDevice(
        device_id="evse_test",
        device_type="evse",
        rated_power_config={
            "rated_power_watts": 7000.0,
            "taper_start_soc_pct": 80.0,
            "battery_capacity_kwh": 60.0
        }
    )
    twin.register_device(evse)
    
    assert twin.get_device_count() == 2, "Should have 2 devices"
    print(f"  ✓ Registered {twin.get_device_count()} devices")
    
    # Apply commands
    twin.apply_command("light_test", {"action": "start"})
    twin.apply_command("evse_test", {"action": "start", "initial_soc_percent": 78.0})
    
    # Check live states
    light_state = twin.get_live_state("light_test")
    assert light_state.operational_state == "running", "Light should be running"
    assert light_state.power_watts == 15.0, "Light power should be 15W"
    print("  ✓ Light command applied")
    
    evse_state = twin.get_live_state("evse_test")
    assert evse_state.operational_state == "running", "EVSE should be running"
    assert evse_state.power_watts == 7000.0, "EVSE power should be 7000W"
    print("  ✓ EVSE command applied")
    
    # Test tick
    initial_total = twin.get_total_power()
    assert abs(initial_total - 7015.0) < 0.1, f"Initial total should be 7015W, got {initial_total}W"
    print(f"  ✓ Initial total power: {initial_total}W")
    
    # Run a few ticks
    for _ in range(5):
        twin.tick(1.0)
    
    # EVSE SOC should have increased slightly
    evse_state_after = twin.get_live_state("evse_test")
    assert evse_state_after.metadata["soc_percent"] > 78.0, "EVSE SOC should have increased"
    print(f"  ✓ EVSE SOC after 5 ticks: {evse_state_after.metadata['soc_percent']:.4f}%")
    
    # History count should be 0 (no history store)
    count = twin.get_history_reading_count()
    assert count == 0, "History count should be 0 without history store"
    print(f"  ✓ History count: {count} (no history store)")
    
    print("\nDigital Twin Core (No History): PASSED ✓\n")


def test_operational_state_values():
    """Test that operational_state values are correct lowercase."""
    print("\n" + "="*60)
    print("Testing Operational State Values")
    print("="*60)
    
    valid_states = {'off', 'on', 'running', 'idle', 'fault', 'setup_incomplete'}
    
    live_store = LiveStateStore()
    twin = DigitalTwinCore(live_store=live_store, history_store=None)
    
    # Create devices in different states
    devices = [
        FlatPowerDevice("test_off", "light", {"rated_power_watts": 15.0}),
        FlatPowerDevice("test_running", "light", {"rated_power_watts": 15.0}),
    ]
    
    # Register and set states
    twin.register_device(devices[0])  # Will be "off"
    twin.register_device(devices[1])
    twin.apply_command("test_running", {"action": "start"})  # Will be "running"
    
    # Verify states are valid
    for device_id in ["test_off", "test_running"]:
        state = twin.get_live_state(device_id)
        assert state.operational_state in valid_states, \
            f"Invalid state: {state.operational_state}"
        print(f"  ✓ {device_id}: {state.operational_state} (valid)")
    
    print("\nOperational State Values: PASSED ✓\n")


def main():
    """Run all Phase 3 tests."""
    print("\n" + "="*60)
    print("PHASE 3 VALIDATION TESTS")
    print("="*60)
    print("\nValidating Layer 2 (Digital Twin Core) components:")
    print("  - Live State Store (in-memory)")
    print("  - Digital Twin Core orchestration")
    print("  - Independent failure resistance")
    print("\n" + "="*60)
    
    try:
        test_live_state_store()
        test_digital_twin_core_without_history()
        test_operational_state_values()
        
        print("="*60)
        print("ALL PHASE 3 TESTS PASSED ✓")
        print("="*60)
        print("\nPhase 3 implementation validated:")
        print("  ✓ Live state store working")
        print("  ✓ Digital twin core orchestration working")
        print("  ✓ Operational states correct (lowercase)")
        print("  ✓ Independent stores (live works without history)")
        print("\nReady for Phase 4 (Master Agent)\n")
        return 0
    
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        return 1


if __name__ == "__main__":
    exit(main())
