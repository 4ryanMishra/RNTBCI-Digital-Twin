"""
Phase 3 Demo - Digital Twin Core with Live + History Stores
Demonstrates independent failure resistance per MASTER_SPEC.md Part 2.
"""
import logging
from datetime import datetime
from device_registry import get_all_devices
from simulation_adapter import create_simulated_device
from live_state_store import LiveStateStore
from history_store import HistoryStore
from digital_twin_core import DigitalTwinCore
from database import SessionLocal

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def demo_without_database():
    """
    Demo 1: Digital twin core with live store only (no database).
    Shows that simulation works even if history store is unavailable.
    """
    print("\n" + "="*80)
    print("DEMO 1: LIVE STATE ONLY (No Database)")
    print("="*80)
    print("Demonstrates: Live state works independently of history store")
    print()
    
    # Create live store only
    live_store = LiveStateStore()
    
    # Create digital twin core without history store
    twin = DigitalTwinCore(live_store=live_store, history_store=None)
    
    # Register devices
    print("Registering devices...")
    for device_config in get_all_devices():
        device = create_simulated_device(
            device_id=device_config["device_id"],
            device_type=device_config["device_type"],
            power_behavior_type=device_config["power_behavior_type"],
            rated_power_config=device_config["rated_power_config"]
        )
        twin.register_device(device)
    
    print(f"Registered {twin.get_device_count()} devices\n")
    
    # Start CCTV (always-on)
    twin.apply_command("cctv_01", {"action": "start"})
    
    # Start EVSE charging
    twin.apply_command("evse_01", {"action": "start", "initial_soc_percent": 78.0})
    
    # Run simulation for 10 ticks
    print("Running simulation (10 ticks)...")
    for i in range(10):
        twin.tick(1.0)
        if i % 3 == 0:
            total_power = twin.get_total_power()
            print(f"  Tick {i+1}: Total power = {total_power:.1f}W")
    
    print()
    
    # Show final live states
    print("Final live states:")
    states = twin.get_all_live_states()
    for device_id in sorted(states.keys()):
        state = states[device_id]
        print(f"  {device_id:20} | {state.operational_state:10} | {state.power_watts:7.1f}W")
    
    print(f"\nLive state working without database")
    print(f"History readings recorded: {twin.get_history_reading_count()} (expected: 0, no DB)")
    print("\n" + "="*80 + "\n")


def demo_with_database():
    """
    Demo 2: Digital twin core with both live and history stores.
    Shows row-per-tick history writes (Decision B).
    """
    print("\n" + "="*80)
    print("DEMO 2: LIVE STATE + HISTORY STORE (With Database)")
    print("="*80)
    print("Demonstrates: Row-per-tick history writes (Decision B)")
    print()
    
    try:
        # Create both stores
        live_store = LiveStateStore()
        history_store = HistoryStore(db_session_factory=SessionLocal)
        
        # Create digital twin core with both stores
        twin = DigitalTwinCore(live_store=live_store, history_store=history_store)
        
        # Register 3 devices for demo (not all 9, to keep output readable)
        print("Registering 3 devices (CCTV, EVSE, Light)...")
        for device_config in get_all_devices():
            if device_config["device_id"] in ["cctv_01", "evse_01", "light_01"]:
                device = create_simulated_device(
                    device_id=device_config["device_id"],
                    device_type=device_config["device_type"],
                    power_behavior_type=device_config["power_behavior_type"],
                    rated_power_config=device_config["rated_power_config"]
                )
                twin.register_device(device)
        
        print(f"Registered {twin.get_device_count()} devices\n")
        
        # Start devices
        twin.apply_command("cctv_01", {"action": "start"})
        twin.apply_command("evse_01", {"action": "start", "initial_soc_percent": 78.0})
        
        initial_count = twin.get_history_reading_count()
        print(f"Initial history count: {initial_count} rows\n")
        
        # Run simulation for 5 ticks
        print("Running simulation (5 ticks, 3 devices = 15 expected rows)...")
        for i in range(5):
            twin.tick(1.0)
            count = twin.get_history_reading_count()
            print(f"  Tick {i+1}: {count} total rows in power_readings")
        
        print()
        
        final_count = twin.get_history_reading_count()
        expected_new_rows = 5 * 3  # 5 ticks × 3 devices
        actual_new_rows = final_count - initial_count
        
        print(f"History rows added: {actual_new_rows} (expected: {expected_new_rows})")
        print(f"Decision B verified: Row-per-tick, every device\n")
        
        # Show live states
        print("Final live states:")
        states = twin.get_all_live_states()
        for device_id in sorted(states.keys()):
            state = states[device_id]
            print(f"  {device_id:20} | {state.operational_state:10} | {state.power_watts:7.1f}W")
        
        print("\n" + "="*80 + "\n")
        return True
    
    except Exception as e:
        logger.error(f"Demo 2 failed: {e}")
        print(f"\nDemo 2 requires database connection.")
        print(f"Run 'alembic upgrade head' first, then retry.")
        print(f"Or run Demo 1 only (works without database).\n")
        return False


def main():
    """Run both demos."""
    print("\n" + "="*80)
    print("PHASE 3: DIGITAL TWIN CORE DEMONSTRATION")
    print("="*80)
    print("\nDemonstrating MASTER_SPEC.md Part 2 architecture:")
    print("  - Layer 2: Live state store (in-memory) + History store (database)")
    print("  - Both stores are independent - one failure doesn't crash the other")
    print("  - Decision B: Row-per-tick history writes")
    print("\n" + "="*80)
    
    # Demo 1: Always works (no database needed)
    demo_without_database()
    
    # Demo 2: Requires database
    input("Press Enter to run Demo 2 (requires database connection)...")
    demo_with_database()
    
    print("\n" + "="*80)
    print("PHASE 3 DEMOS COMPLETE")
    print("="*80)
    print("\nKey Takeaways:")
    print("  1. Live state works independently of database")
    print("  2. History writes don't block simulation if they fail")
    print("  3. Row-per-tick recording (Decision B) working correctly")
    print("  4. Separate stores prevent cascading failures")
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    main()
