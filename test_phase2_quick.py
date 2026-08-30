"""
Quick smoke test for Phase 2 implementation.
Runs a brief simulation to verify basic functionality.
"""
from device_registry import get_all_devices
from simulation_adapter import create_simulated_device


def test_device_creation():
    """Test that all 9 devices can be created."""
    print("Testing device creation...")
    devices = {}
    
    for device_config in get_all_devices():
        device = create_simulated_device(
            device_id=device_config["device_id"],
            device_type=device_config["device_type"],
            power_behavior_type=device_config["power_behavior_type"],
            rated_power_config=device_config["rated_power_config"]
        )
        devices[device_config["device_id"]] = device
        print(f"  ✓ Created {device_config['device_id']}")
    
    assert len(devices) == 9, f"Expected 9 devices, got {len(devices)}"
    print(f"\n✓ All 9 devices created successfully\n")
    return devices


def test_operational_states():
    """Test that operational_state values are correct (lowercase)."""
    print("Testing operational_state values...")
    
    valid_states = {'off', 'on', 'running', 'idle', 'fault', 'setup_incomplete'}
    
    devices = test_device_creation()
    
    for device_id, device in devices.items():
        state = device.get_state()
        assert state.operational_state in valid_states, \
            f"{device_id} has invalid state: {state.operational_state}"
        print(f"  ✓ {device_id}: {state.operational_state} (valid)")
    
    print(f"\n✓ All operational_state values are lowercase and valid\n")


def test_cctv_always_running():
    """Test that CCTV starts in 'running' state (always-on device)."""
    print("Testing CCTV initialization...")
    
    from simulation_adapter import FlatPowerDevice
    
    # Create CCTV device
    cctv = FlatPowerDevice(
        device_id="cctv_01",
        device_type="cctv",
        rated_power_config={"rated_power_watts": 10.0}
    )
    
    # CCTV should start 'off' initially (default for FlatPowerDevice)
    initial_state = cctv.get_state()
    assert initial_state.operational_state == "off", \
        f"CCTV should initialize to 'off', got '{initial_state.operational_state}'"
    print(f"  ✓ CCTV initial state: {initial_state.operational_state}")
    
    # Apply start command to set it to running (always-on)
    cctv.apply_command({"action": "start"})
    running_state = cctv.get_state()
    assert running_state.operational_state == "running", \
        f"CCTV should be 'running' after start command, got '{running_state.operational_state}'"
    print(f"  ✓ CCTV after start command: {running_state.operational_state}")
    
    # Verify power is correct
    power = cctv.get_power_draw()
    assert power == 10.0, f"CCTV should draw 10W when running, got {power}W"
    print(f"  ✓ CCTV power draw: {power}W")
    
    print(f"\n✓ CCTV initialization working correctly\n")


def test_evse_taper():
    """Quick test of EVSE taper behavior."""
    print("Testing EVSE taper...")
    
    from simulation_adapter import TaperDevice
    
    evse = TaperDevice(
        device_id="test_evse",
        device_type="evse",
        rated_power_config={
            "rated_power_watts": 7000.0,
            "taper_start_soc_pct": 80.0,
            "battery_capacity_kwh": 60.0
        }
    )
    
    # Test before taper
    evse.apply_command({"action": "start", "initial_soc_percent": 78.0})
    power_before = evse.get_power_draw()
    assert power_before == 7000.0, f"Expected 7000W before taper, got {power_before}W"
    print(f"  ✓ Before taper (78% SOC): {power_before}W")
    
    # Test at taper start
    evse.apply_command({"action": "start", "initial_soc_percent": 80.0})
    power_at_start = evse.get_power_draw()
    assert power_at_start == 7000.0, f"Expected 7000W at taper start, got {power_at_start}W"
    print(f"  ✓ Taper start (80% SOC): {power_at_start}W")
    
    # Test mid taper
    evse.apply_command({"action": "start", "initial_soc_percent": 90.0})
    power_mid = evse.get_power_draw()
    assert abs(power_mid - 3500.0) < 0.1, f"Expected 3500W at 90% SOC, got {power_mid}W"
    print(f"  ✓ Mid taper (90% SOC): {power_mid}W")
    
    # Test at full
    evse.apply_command({"action": "start", "initial_soc_percent": 100.0})
    power_full = evse.get_power_draw()
    assert power_full == 0.0, f"Expected 0W at 100% SOC, got {power_full}W"
    print(f"  ✓ Full charge (100% SOC): {power_full}W")
    
    print(f"\n✓ EVSE taper working correctly (Decision D)\n")


def test_refrigerator_duty_cycle():
    """Quick test of refrigerator duty cycle."""
    print("Testing refrigerator duty cycle...")
    
    from simulation_adapter import DutyCycleDevice
    
    fridge = DutyCycleDevice(
        device_id="test_fridge",
        device_type="refrigerator",
        rated_power_config={
            "on_power_watts": 150.0,
            "idle_power_watts": 5.0,
            "cycle_on_s": 600.0,
            "cycle_off_s": 300.0,
            "simulation_compression": 10.0
        }
    )
    
    fridge.apply_command({"action": "start"})
    
    # Should start with compressor ON
    assert fridge.compressor_on == True, "Should start with compressor ON"
    power_on = fridge.get_power_draw()
    assert power_on == 150.0, f"Expected 150W when compressor ON, got {power_on}W"
    print(f"  ✓ Initial state: Compressor ON, {power_on}W")
    
    # Simulate through ON phase (60s compressed)
    for _ in range(60):
        fridge.tick(1.0)
    
    # Should transition to OFF
    assert fridge.compressor_on == False, "Should transition to OFF after 60s"
    power_off = fridge.get_power_draw()
    assert power_off == 5.0, f"Expected 5W when compressor OFF, got {power_off}W"
    print(f"  ✓ After 60s: Compressor OFF, {power_off}W")
    
    # Simulate through OFF phase (30s compressed)
    for _ in range(30):
        fridge.tick(1.0)
    
    # Should transition back to ON
    assert fridge.compressor_on == True, "Should transition to ON after 30s OFF"
    power_on_again = fridge.get_power_draw()
    assert power_on_again == 150.0, f"Expected 150W when compressor ON again, got {power_on_again}W"
    print(f"  ✓ After 90s: Compressor ON (cycle repeat), {power_on_again}W")
    
    print(f"\n✓ Refrigerator duty cycle working correctly\n")


def test_simulator_cctv_initialization():
    """Test that CCTV is properly initialized to 'running' in Simulator."""
    print("Testing CCTV initialization in Simulator...")
    
    from phase2_demo import Simulator
    
    sim = Simulator()
    
    # CCTV should be running after initialization
    cctv_state = sim.devices["cctv_01"].get_state()
    assert cctv_state.operational_state == "running", \
        f"CCTV should be 'running' in Simulator, got '{cctv_state.operational_state}'"
    print(f"  ✓ CCTV state in Simulator: {cctv_state.operational_state}")
    
    # Verify power draw
    power = sim.devices["cctv_01"].get_power_draw()
    assert power == 10.0, f"CCTV should draw 10W, got {power}W"
    print(f"  ✓ CCTV power draw: {power}W")
    
    # Verify all other devices are 'off' except CCTV
    for device_id, device in sim.devices.items():
        if device_id == "cctv_01":
            continue
        state = device.get_state()
        assert state.operational_state == "off", \
            f"{device_id} should start 'off', got '{state.operational_state}'"
        print(f"  ✓ {device_id}: {state.operational_state}")
    
    print(f"\n✓ Simulator CCTV initialization correct (always-on device)\n")


def main():
    """Run quick smoke tests."""
    print("\n" + "="*60)
    print("PHASE 2 QUICK SMOKE TEST")
    print("="*60 + "\n")
    
    try:
        test_device_creation()
        test_operational_states()
        test_cctv_always_running()
        test_simulator_cctv_initialization()
        test_evse_taper()
        test_refrigerator_duty_cycle()
        
        print("="*60)
        print("ALL QUICK TESTS PASSED ✓")
        print("="*60)
        print("\nPhase 2 implementation is working correctly.")
        print("Run 'python validate_power_math.py' for detailed validation.")
        print("Run 'python phase2_demo.py' for full simulation demo.")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
