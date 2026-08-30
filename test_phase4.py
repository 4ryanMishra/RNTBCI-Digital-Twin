"""
Phase 4 Test - Master Agent (Decision A: Alert-Only)
Tests that Master Agent fires alerts but NEVER throttles devices.
"""
from system_config_manager import SystemConfigManager
from master_agent import MasterAgent, PowerBudgetStatus
from live_state_store import LiveStateStore
from device_interface import DeviceState
from digital_twin_core import DigitalTwinCore
from simulation_adapter import FlatPowerDevice
from database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)


def test_decision_a_no_throttle():
    """
    Critical test: Verify Decision A is enforced.
    Master Agent must NEVER issue throttle commands.
    """
    print("\n" + "="*60)
    print("TESTING DECISION A: ALERT-ONLY (NO THROTTLE)")
    print("="*60)
    
    # Create Master Agent
    config_mgr = SystemConfigManager(SessionLocal)
    agent = MasterAgent(config_mgr, SessionLocal)
    
    # Verify Master Agent has no throttle methods
    methods = [m for m in dir(agent) if not m.startswith('_')]
    throttle_methods = [m for m in methods if 'throttle' in m.lower()]
    
    assert len(throttle_methods) == 0, f"VIOLATION: Master Agent has throttle methods: {throttle_methods}"
    print("  ✓ Master Agent has NO throttle methods")
    
    # Verify fire_alert exists (alert-only)
    assert hasattr(agent, 'fire_alert'), "Master Agent must have fire_alert"
    assert hasattr(agent, 'check_power_budget'), "Master Agent must have check_power_budget"
    print("  ✓ Master Agent has alert-only methods")
    
    print("\nDecision A Verified: ALERT-ONLY, NO AUTO-THROTTLE ✓\n")


def test_power_budget_calculation():
    """Test power budget calculation without database."""
    print("\n" + "="*60)
    print("TESTING POWER BUDGET CALCULATION")
    print("="*60)
    
    config_mgr = SystemConfigManager(SessionLocal)
    
    # Check if setup incomplete
    if not config_mgr.is_setup_complete():
        print("  ℹ Setup incomplete - will test with mock data")
        
        # Mock setup (for testing without DB)
        class MockConfig:
            def is_setup_complete(self): return True
            def get_contracted_power_kva(self): return 6.0
            def get_current_rating_a(self): return 30.0
        
        config_mgr = MockConfig()
    
    agent = MasterAgent(config_mgr, SessionLocal)
    
    # Create mock live states
    states = {
        'evse_01': DeviceState('evse_01', 'evse', 'running', 7000.0, {}),
        'light_01': DeviceState('light_01', 'light', 'running', 15.0, {}),
        'cctv_01': DeviceState('cctv_01', 'cctv', 'running', 10.0, {})
    }
    
    budget = agent.check_power_budget(states)
    
    assert budget.total_load_watts == 7025.0, f"Total should be 7025W, got {budget.total_load_watts}W"
    print(f"  ✓ Total load: {budget.total_load_watts}W")
    
    assert budget.limit_watts == 6000.0, f"Limit should be 6000W (6kVA), got {budget.limit_watts}W"
    print(f"  ✓ Limit: {budget.limit_watts}W (6 kVA)")
    
    # 7025 / 6000 = 1.17 = 117% > 95% critical threshold
    assert budget.status == 'critical', f"Status should be 'critical', got '{budget.status}'"
    print(f"  ✓ Status: {budget.status} (load exceeds limit)")
    
    print("\nPower Budget Calculation: PASSED ✓\n")


def test_alert_thresholds():
    """Test warning and critical thresholds."""
    print("\n" + "="*60)
    print("TESTING ALERT THRESHOLDS")
    print("="*60)
    
    class MockConfig:
        def is_setup_complete(self): return True
        def get_contracted_power_kva(self): return 10.0
        def get_current_rating_a(self): return 45.0
    
    agent = MasterAgent(MockConfig(), SessionLocal)
    
    # Limit = 10 kVA = 10000W
    # Warning threshold = 80% = 8000W
    # Critical threshold = 95% = 9500W
    
    # Test 1: Below warning (5000W)
    states1 = {'test': DeviceState('test', 'test', 'running', 5000.0, {})}
    budget1 = agent.check_power_budget(states1)
    assert budget1.status == 'ok', f"5000W should be 'ok', got '{budget1.status}'"
    print(f"  ✓ 5000W / 10000W = 50% → status: {budget1.status}")
    
    # Test 2: Above warning, below critical (8500W)
    states2 = {'test': DeviceState('test', 'test', 'running', 8500.0, {})}
    budget2 = agent.check_power_budget(states2)
    assert budget2.status == 'warning', f"8500W should be 'warning', got '{budget2.status}'"
    print(f"  ✓ 8500W / 10000W = 85% → status: {budget2.status}")
    
    # Test 3: Above critical (9800W)
    states3 = {'test': DeviceState('test', 'test', 'running', 9800.0, {})}
    budget3 = agent.check_power_budget(states3)
    assert budget3.status == 'critical', f"9800W should be 'critical', got '{budget3.status}'"
    print(f"  ✓ 9800W / 10000W = 98% → status: {budget3.status}")
    
    print("\nAlert Thresholds: PASSED ✓\n")


def main():
    print("\n" + "="*60)
    print("PHASE 4: MASTER AGENT VALIDATION")
    print("="*60)
    print("\nValidating Decision A enforcement and power budget logic\n")
    
    try:
        test_decision_a_no_throttle()
        test_power_budget_calculation()
        test_alert_thresholds()
        
        print("="*60)
        print("ALL PHASE 4 TESTS PASSED ✓")
        print("="*60)
        print("\nDecision A enforced: Master Agent is alert-only")
        print("Power budget calculation working correctly")
        print("Alert thresholds (80% warning, 95% critical) validated")
        print("\nReady for Phase 5 (REST + WebSocket API)\n")
        return 0
    
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        return 1


if __name__ == "__main__":
    exit(main())
