"""
Power calculation validation script.
Hand-calculated expected values vs. simulator output for critical scenarios.
"""
from simulation_adapter import TaperDevice, DutyCycleDevice, FlatPowerDevice


def validate_flat_power():
    """Validate flat power device calculations."""
    print("\n" + "="*80)
    print("VALIDATING FLAT POWER DEVICES")
    print("="*80)
    
    device = FlatPowerDevice(
        device_id="test_flat",
        device_type="light",
        rated_power_config={"rated_power_watts": 15.0}
    )
    
    # Test 1: Off state
    assert device.get_power_draw() == 0.0, "Failed: Off state should be 0W"
    print("✓ Off state: 0W (correct)")
    
    # Test 2: Running state
    device.apply_command({"action": "start"})
    assert device.get_power_draw() == 15.0, "Failed: Running state should be 15W"
    print("✓ Running state: 15W (correct)")
    
    # Test 3: Stop command
    device.apply_command({"action": "stop"})
    assert device.get_power_draw() == 0.0, "Failed: Stopped state should be 0W"
    print("✓ Stop command: returns to 0W (correct)")
    
    print("\nFlat power validation: PASSED ✓")


def validate_taper():
    """Validate EVSE taper calculations (Decision D)."""
    print("\n" + "="*80)
    print("VALIDATING EVSE TAPER (Decision D)")
    print("="*80)
    
    device = TaperDevice(
        device_id="test_evse",
        device_type="evse",
        rated_power_config={
            "rated_power_watts": 7000.0,
            "taper_start_soc_pct": 80.0,
            "battery_capacity_kwh": 60.0
        }
    )
    
    # Start charging at different SOC levels
    print("\nTesting power at various SOC levels:")
    
    test_cases = [
        (78.0, 7000.0, "Before taper zone"),
        (79.5, 7000.0, "Before taper zone"),
        (80.0, 7000.0, "At taper start (80%)"),
        (85.0, 5250.0, "Mid-taper (85%)"),  # 5250 = 7000 * (100-85)/(100-80) = 7000 * 15/20
        (90.0, 3500.0, "Mid-taper (90%)"),  # 3500 = 7000 * (100-90)/(100-80) = 7000 * 10/20
        (95.0, 1750.0, "Late taper (95%)"),  # 1750 = 7000 * (100-95)/(100-80) = 7000 * 5/20
        (99.0, 350.0, "Near full (99%)"),   # 350 = 7000 * (100-99)/(100-80) = 7000 * 1/20
        (100.0, 0.0, "Full (100%)"),
    ]
    
    for soc, expected_power, description in test_cases:
        device.apply_command({"action": "start", "initial_soc_percent": soc})
        actual_power = device.get_power_draw()
        
        # Allow small floating point tolerance
        tolerance = 0.1
        assert abs(actual_power - expected_power) < tolerance, \
            f"Failed at {soc}% SOC: expected {expected_power}W, got {actual_power}W"
        
        print(f"  SOC {soc:5.1f}%: {actual_power:7.1f}W (expected {expected_power:7.1f}W) - {description} ✓")
    
    # Test taper formula explicitly
    print("\nTaper formula verification:")
    print("  Formula: power = rated_power × (100 - current_soc) / (100 - taper_start_soc)")
    print("  At 85% SOC: 7000 × (100-85)/(100-80) = 7000 × 15/20 = 5250W ✓")
    print("  At 90% SOC: 7000 × (100-90)/(100-80) = 7000 × 10/20 = 3500W ✓")
    print("  At 95% SOC: 7000 × (100-95)/(100-80) = 7000 × 5/20 = 1750W ✓")
    
    print("\nEVSE taper validation: PASSED ✓")


def validate_duty_cycle():
    """Validate refrigerator duty cycle calculations."""
    print("\n" + "="*80)
    print("VALIDATING REFRIGERATOR DUTY CYCLE")
    print("="*80)
    
    device = DutyCycleDevice(
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
    
    # Start device
    device.apply_command({"action": "start"})
    
    print("\nCompressed timing: 60s on, 30s off (10x compression of 600s/300s)")
    print("\nSimulating one complete duty cycle:")
    
    # Cycle should start in ON phase (compressor_on=True)
    assert device.compressor_on == True, "Failed: Should start with compressor ON"
    assert device.get_power_draw() == 150.0, "Failed: ON phase should be 150W"
    print("  t=0s: Compressor ON, Power = 150W ✓")
    
    # Simulate through ON phase (60s compressed)
    for i in range(59):
        device.tick(1.0)
        assert device.get_power_draw() == 150.0, f"Failed at t={i+1}s: Should still be 150W"
    print(f"  t=1-59s: Compressor ON, Power = 150W ✓")
    
    # At 60s, should transition to OFF phase
    device.tick(1.0)
    assert device.compressor_on == False, "Failed: Should transition to OFF at 60s"
    assert device.get_power_draw() == 5.0, "Failed: OFF phase should be 5W"
    print(f"  t=60s: Compressor OFF (transition), Power = 5W ✓")
    
    # Simulate through OFF phase (30s compressed)
    for i in range(29):
        device.tick(1.0)
        assert device.get_power_draw() == 5.0, f"Failed at t={60+i+1}s: Should still be 5W"
    print(f"  t=61-89s: Compressor OFF, Power = 5W ✓")
    
    # At 90s, should transition back to ON phase
    device.tick(1.0)
    assert device.compressor_on == True, "Failed: Should transition to ON at 90s"
    assert device.get_power_draw() == 150.0, "Failed: Should return to 150W"
    print(f"  t=90s: Compressor ON (cycle repeat), Power = 150W ✓")
    
    print("\nDuty cycle timing:")
    print("  Compressed ON duration: 60s (600s / 10) ✓")
    print("  Compressed OFF duration: 30s (300s / 10) ✓")
    print("  Full cycle: 90s ✓")
    print("  Real-world cycle: 900s (15 minutes) ✓")
    
    print("\nRefrigerator duty cycle validation: PASSED ✓")


def validate_soc_progression():
    """Validate that SOC increases correctly based on power and time."""
    print("\n" + "="*80)
    print("VALIDATING SOC PROGRESSION")
    print("="*80)
    
    device = TaperDevice(
        device_id="test_evse_soc",
        device_type="evse",
        rated_power_config={
            "rated_power_watts": 7000.0,
            "taper_start_soc_pct": 80.0,
            "battery_capacity_kwh": 60.0
        }
    )
    
    # Start at 78% SOC (flat power zone)
    device.apply_command({"action": "start", "initial_soc_percent": 78.0})
    initial_soc = 78.0
    
    print(f"\nStarting SOC: {initial_soc}%")
    print(f"Charging at flat power: 7000W")
    print(f"Battery capacity: 60 kWh")
    
    # Charge for 60 seconds at 7000W
    duration_s = 60.0
    for _ in range(60):
        device.tick(1.0)
    
    # Calculate expected SOC increase
    # Energy = Power × Time = 7000W × (60s / 3600s/h) = 7000 × 0.01667 = 116.67 Wh = 0.11667 kWh
    # SOC increase = (0.11667 kWh / 60 kWh) × 100 = 0.1944%
    
    energy_kwh = (7000.0 / 1000.0) * (60.0 / 3600.0)
    expected_soc_increase = (energy_kwh / 60.0) * 100.0
    expected_final_soc = initial_soc + expected_soc_increase
    
    actual_final_soc = device.soc_percent
    
    print(f"\nAfter {duration_s}s of charging:")
    print(f"  Energy added: {energy_kwh:.4f} kWh")
    print(f"  Expected SOC increase: {expected_soc_increase:.4f}%")
    print(f"  Expected final SOC: {expected_final_soc:.4f}%")
    print(f"  Actual final SOC: {actual_final_soc:.4f}%")
    
    tolerance = 0.001
    assert abs(actual_final_soc - expected_final_soc) < tolerance, \
        f"Failed: SOC mismatch (expected {expected_final_soc:.4f}%, got {actual_final_soc:.4f}%)"
    
    print(f"  ✓ SOC progression correct within {tolerance*100}% tolerance")
    
    print("\nSOC progression validation: PASSED ✓")


def main():
    """Run all validation tests."""
    print("\n" + "="*80)
    print("PHASE 2 POWER CALCULATION VALIDATION")
    print("Hand-calculated expected values vs. simulator output")
    print("="*80)
    
    try:
        validate_flat_power()
        validate_taper()
        validate_duty_cycle()
        validate_soc_progression()
        
        print("\n" + "="*80)
        print("ALL VALIDATIONS PASSED ✓")
        print("="*80)
        print("\nPower calculations are mathematically correct.")
        print("Ready to proceed with integration into digital twin core.")
        
    except AssertionError as e:
        print(f"\n❌ VALIDATION FAILED: {e}")
        print("\nPlease review the calculations before proceeding.")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
