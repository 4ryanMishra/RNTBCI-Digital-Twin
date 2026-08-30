"""
Phase 2 Standalone Demo Script
Simulates all 9 devices and prints power draw over time for manual verification.

Per your specifications:
- Tick rate: 1 second per tick (Decision B)
- Duration: ~25-30 minutes to show EVSE taper (78% → 100%) and 2+ fridge duty cycles
- Initial states: All off except CCTV (running)
- EVSE starts at 78% SOC to demonstrate taper immediately
- State changes: EVSE charging at t=0, Light/Dishwasher turn on partway through
"""
import time
from typing import Dict, List
from device_registry import get_all_devices
from simulation_adapter import create_simulated_device
from device_interface import DeviceInterface


class Simulator:
    """Simulation orchestrator for all 9 devices."""
    
    def __init__(self):
        self.devices: Dict[str, DeviceInterface] = {}
        self.current_time = 0.0
        self.tick_interval = 1.0  # 1 second per tick
        
        # Initialize all devices from registry
        for device_config in get_all_devices():
            device = create_simulated_device(
                device_id=device_config["device_id"],
                device_type=device_config["device_type"],
                power_behavior_type=device_config["power_behavior_type"],
                rated_power_config=device_config["rated_power_config"]
            )
            self.devices[device_config["device_id"]] = device
        
        # Set initial states per your specification
        self._initialize_device_states()
    
    def _initialize_device_states(self):
        """
        Initial states:
        - All devices: off
        - CCTV: running (always-on in practice)
        - EVSE: off (will be started at t=0 with 78% SOC)
        """
        # All devices start off by default (already initialized in adapters)
        
        # CCTV starts running
        self.devices["cctv_01"].apply_command({"action": "start"})
    
    def tick(self):
        """Advance simulation by one tick interval."""
        for device in self.devices.values():
            device.tick(self.tick_interval)
        self.current_time += self.tick_interval
    
    def get_total_power(self) -> float:
        """Calculate total household power draw."""
        return sum(device.get_power_draw() for device in self.devices.values())
    
    def print_device_states(self, label: str = ""):
        """Print current state of all devices."""
        print(f"\n{'='*80}")
        if label:
            print(f"{label}")
        print(f"Time: {self.current_time:.1f}s ({self.current_time/60:.1f} min)")
        print(f"{'='*80}")
        
        total_power = 0.0
        
        for device_id in sorted(self.devices.keys()):
            device = self.devices[device_id]
            state = device.get_state()
            power = state.power_watts
            total_power += power
            
            # Format device-specific metadata
            metadata_str = ""
            if device_id == "evse_01":
                soc = state.metadata.get("soc_percent", 0)
                is_tapering = state.metadata.get("is_tapering", False)
                taper_marker = " [TAPERING]" if is_tapering else ""
                metadata_str = f" | SOC: {soc:.1f}%{taper_marker}"
            elif device_id == "refrigerator_01":
                compressor = state.metadata.get("compressor_on", False)
                phase_time = state.metadata.get("time_in_current_phase", 0)
                comp_marker = "ON " if compressor else "OFF"
                metadata_str = f" | Compressor: {comp_marker} ({phase_time:.1f}s in phase)"
            
            print(f"{device_id:20} | {state.operational_state:15} | {power:7.1f}W{metadata_str}")
        
        print(f"{'-'*80}")
        print(f"{'TOTAL HOUSEHOLD LOAD':37} | {total_power:7.1f}W")
        print(f"{'='*80}")
    
    def run_demo(self):
        """
        Run the demo simulation.
        Timeline:
        - t=0: Start EVSE charging at 78% SOC
        - t=0: Refrigerator starts duty cycling
        - t=300s (5min): Turn on Light
        - t=600s (10min): Turn on Dishwasher
        - Run until EVSE reaches 100% SOC or ~30 minutes
        """
        print("\n" + "="*80)
        print("RNTBCI DIGITAL TWIN - PHASE 2 SIMULATION DEMO")
        print("="*80)
        print("\nDevice Abstraction Layer Test")
        print("Demonstrating all 9 devices with correct power behaviors:")
        print("  - EVSE: Linear taper from 7000W (at 80% SOC) to 0W (at 100% SOC)")
        print("  - Refrigerator: Duty cycle (150W on / 5W idle, compressed timing)")
        print("  - Others: Flat power when running, 0W when off")
        print("\n" + "="*80)
        
        # Initial state
        self.print_device_states("INITIAL STATE (all off except CCTV)")
        
        # t=0: Start EVSE charging at 78% SOC and refrigerator duty cycling
        print("\n>>> t=0: Starting EVSE charging (78% SOC) and Refrigerator duty cycle...")
        self.devices["evse_01"].apply_command({
            "action": "start",
            "initial_soc_percent": 78.0
        })
        self.devices["refrigerator_01"].apply_command({"action": "start"})
        self.print_device_states("t=0: EVSE and Refrigerator started")
        
        # Simulation loop
        target_duration = 30 * 60  # 30 minutes
        print_interval = 60  # Print every 60 seconds
        next_print_time = print_interval
        
        # State change timings
        light_on_time = 5 * 60  # 5 minutes
        dishwasher_on_time = 10 * 60  # 10 minutes
        light_turned_on = False
        dishwasher_turned_on = False
        
        while self.current_time < target_duration:
            self.tick()
            
            # Check for EVSE completion
            evse_state = self.devices["evse_01"].get_state()
            if evse_state.metadata.get("soc_percent", 0) >= 100.0:
                self.print_device_states("EVSE CHARGING COMPLETE (100% SOC)")
                break
            
            # State changes at specific times
            if not light_turned_on and self.current_time >= light_on_time:
                print(f"\n>>> t={self.current_time:.0f}s: Turning on Light...")
                self.devices["light_01"].apply_command({"action": "start"})
                self.print_device_states(f"t={self.current_time:.0f}s: Light turned on")
                light_turned_on = True
            
            if not dishwasher_turned_on and self.current_time >= dishwasher_on_time:
                print(f"\n>>> t={self.current_time:.0f}s: Starting Dishwasher...")
                self.devices["dishwasher_01"].apply_command({"action": "start"})
                self.print_device_states(f"t={self.current_time:.0f}s: Dishwasher started")
                dishwasher_turned_on = True
            
            # Regular status prints
            if self.current_time >= next_print_time:
                self.print_device_states(f"Status Update (t={self.current_time:.0f}s)")
                next_print_time += print_interval
        
        # Final state
        self.print_device_states("FINAL STATE")
        
        # Summary
        print("\n" + "="*80)
        print("SIMULATION COMPLETE")
        print("="*80)
        print("\nKey Observations to Verify:")
        print("1. EVSE Power Draw:")
        print("   - Should be flat at 7000W from 78% to 80% SOC")
        print("   - Should linearly decrease from 7000W (at 80%) to 0W (at 100%)")
        print("   - Taper range: 20% SOC = 20% of charge time")
        print("\n2. Refrigerator Duty Cycle:")
        print("   - Should alternate: 150W for 60s (compressed), then 5W for 30s")
        print("   - Should complete at least 2 full cycles during demo")
        print("\n3. Flat Power Devices:")
        print("   - CCTV: constant 10W throughout (always running)")
        print("   - Light: 0W until t=300s, then constant 15W")
        print("   - Dishwasher: 0W until t=600s, then constant 1500W")
        print("\n4. Total Household Load:")
        print("   - Should be sum of all active devices at any moment")
        print("   - Peak likely around 8700W+ when EVSE + Dishwasher + others running")
        print("\n" + "="*80)


def main():
    """Run the Phase 2 demo."""
    simulator = Simulator()
    simulator.run_demo()


if __name__ == "__main__":
    main()
