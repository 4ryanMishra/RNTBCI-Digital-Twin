"""
Simulation adapters for all 9 devices.
Implements DeviceInterface for simulated devices using power_behavior_type logic.
Per MASTER_SPEC.md Part 3 device registry and Decision D (EVSE taper).
"""
from typing import Dict, Any
from device_interface import DeviceInterface, DeviceState


class FlatPowerDevice(DeviceInterface):
    """
    Flat power behavior: rated_power_watts while running, 0 while off.
    Used by: Light, Dishwasher, Washing Machine, Water Heater, Heat Pump, CCTV, Microwave.
    """
    
    def __init__(self, device_id: str, device_type: str, rated_power_config: Dict[str, Any]):
        super().__init__(device_id, device_type, rated_power_config)
        self.operational_state = "off"
        self.rated_power_watts = rated_power_config["rated_power_watts"]
    
    def get_state(self) -> DeviceState:
        return DeviceState(
            device_id=self.device_id,
            device_type=self.device_type,
            operational_state=self.operational_state,
            power_watts=self.get_power_draw(),
            metadata={}
        )
    
    def get_power_draw(self) -> float:
        # Binary: full power while running, 0 while off
        if self.operational_state in ["running", "on"]:
            return self.rated_power_watts
        return 0.0
    
    def apply_command(self, command: Dict[str, Any]) -> DeviceState:
        action = command.get("action")
        
        if action == "start":
            self.operational_state = "running"
        elif action == "stop":
            self.operational_state = "off"
        
        return self.get_state()
    
    def tick(self, delta_seconds: float) -> None:
        # Flat power devices don't change state over time
        pass


class TaperDevice(DeviceInterface):
    """
    Taper behavior for EVSE (Decision D).
    Flat power at rated_power_watts until taper_start_soc_pct,
    then LINEAR taper from rated_power_watts to 0W at 100% SOC.
    NOT a DC-fast-charge curve across the whole session.
    """
    
    def __init__(self, device_id: str, device_type: str, rated_power_config: Dict[str, Any]):
        super().__init__(device_id, device_type, rated_power_config)
        self.operational_state = "off"
        self.rated_power_watts = rated_power_config["rated_power_watts"]
        self.taper_start_soc_pct = rated_power_config["taper_start_soc_pct"]
        
        # Battery state
        self.soc_percent = 0.0  # Will be set via command
        self.battery_capacity_kwh = rated_power_config.get("battery_capacity_kwh", 60.0)  # Default 60kWh
        self.is_charging = False
    
    def get_state(self) -> DeviceState:
        return DeviceState(
            device_id=self.device_id,
            device_type=self.device_type,
            operational_state=self.operational_state,
            power_watts=self.get_power_draw(),
            metadata={
                "soc_percent": self.soc_percent,
                "is_tapering": self._is_in_taper_zone(),
                "taper_start_soc_percent": self.taper_start_soc_pct,
                "rated_power_watts": self.rated_power_watts,
                "is_charging": self.is_charging
            }
        )
    
    def _is_in_taper_zone(self) -> bool:
        return self.soc_percent >= self.taper_start_soc_pct and self.soc_percent < 100.0
    
    def get_power_draw(self) -> float:
        if not self.is_charging or self.operational_state != "running":
            return 0.0
        
        if self.soc_percent >= 100.0:
            return 0.0
        
        # Flat power until taper zone
        if self.soc_percent < self.taper_start_soc_pct:
            return self.rated_power_watts
        
        # Linear taper from rated_power_watts at taper_start_soc_pct down to 0W at 100% SOC
        # Formula: power = rated_power * (100 - current_soc) / (100 - taper_start_soc)
        taper_range = 100.0 - self.taper_start_soc_pct
        remaining_in_taper = 100.0 - self.soc_percent
        
        if taper_range > 0:
            power = self.rated_power_watts * (remaining_in_taper / taper_range)
            return max(0.0, power)
        
        return 0.0
    
    def apply_command(self, command: Dict[str, Any]) -> DeviceState:
        action = command.get("action")
        
        if action == "start":
            self.is_charging = True
            self.operational_state = "running"
            # Can set initial SOC via command
            if "initial_soc_percent" in command:
                self.soc_percent = command["initial_soc_percent"]
        elif action == "stop":
            self.is_charging = False
            self.operational_state = "off"
        
        return self.get_state()
    
    def tick(self, delta_seconds: float) -> None:
        """
        Update SOC based on current power draw.
        Energy added = (power_watts * time_hours) = kWh
        SOC increase = (energy_kwh / battery_capacity_kwh) * 100
        """
        if not self.is_charging or self.soc_percent >= 100.0:
            return
        
        current_power = self.get_power_draw()
        
        if current_power > 0:
            # Convert watts to kW, seconds to hours
            energy_added_kwh = (current_power / 1000.0) * (delta_seconds / 3600.0)
            soc_increase = (energy_added_kwh / self.battery_capacity_kwh) * 100.0
            
            self.soc_percent = min(100.0, self.soc_percent + soc_increase)
        
        # Stop charging when full
        if self.soc_percent >= 100.0:
            self.is_charging = False
            self.operational_state = "idle"


class DutyCycleDevice(DeviceInterface):
    """
    Duty cycle behavior for Refrigerator.
    Cycles between on_power_watts (during cycle_on_s) and idle_power_watts (during cycle_off_s).
    Pure time-based, no temperature logic.
    """
    
    def __init__(self, device_id: str, device_type: str, rated_power_config: Dict[str, Any]):
        super().__init__(device_id, device_type, rated_power_config)
        self.operational_state = "off"
        
        self.on_power_watts = rated_power_config["on_power_watts"]
        self.idle_power_watts = rated_power_config["idle_power_watts"]
        
        # Use real-world timings stored in config
        self.cycle_on_s = rated_power_config["cycle_on_s"]
        self.cycle_off_s = rated_power_config["cycle_off_s"]
        
        # Simulation compression factor (for demo purposes)
        self.simulation_compression = rated_power_config.get("simulation_compression", 10.0)
        
        # Current cycle state
        self.compressor_on = False
        self.time_in_current_phase = 0.0
    
    def get_state(self) -> DeviceState:
        return DeviceState(
            device_id=self.device_id,
            device_type=self.device_type,
            operational_state=self.operational_state,
            power_watts=self.get_power_draw(),
            metadata={
                "compressor_on": self.compressor_on,
                "cycle_on_s": self.cycle_on_s,
                "cycle_off_s": self.cycle_off_s,
                "simulation_compression": self.simulation_compression,
                "time_in_current_phase": self.time_in_current_phase
            }
        )
    
    def get_power_draw(self) -> float:
        if self.operational_state == "off":
            return 0.0
        
        # Return current power based on compressor state
        return self.on_power_watts if self.compressor_on else self.idle_power_watts
    
    def apply_command(self, command: Dict[str, Any]) -> DeviceState:
        action = command.get("action")
        
        if action == "start":
            self.operational_state = "running"
            # Start with compressor on
            self.compressor_on = True
            self.time_in_current_phase = 0.0
        elif action == "stop":
            self.operational_state = "off"
            self.compressor_on = False
            self.time_in_current_phase = 0.0
        
        return self.get_state()
    
    def tick(self, delta_seconds: float) -> None:
        """
        Cycle between compressor on/off based on timing.
        Uses compressed timing for simulation speed.
        """
        if self.operational_state != "running":
            return
        
        self.time_in_current_phase += delta_seconds
        
        # Apply simulation compression
        compressed_on_s = self.cycle_on_s / self.simulation_compression
        compressed_off_s = self.cycle_off_s / self.simulation_compression
        
        if self.compressor_on:
            # Currently in ON phase
            if self.time_in_current_phase >= compressed_on_s:
                # Switch to OFF phase
                self.compressor_on = False
                self.time_in_current_phase = 0.0
        else:
            # Currently in OFF phase
            if self.time_in_current_phase >= compressed_off_s:
                # Switch to ON phase
                self.compressor_on = True
                self.time_in_current_phase = 0.0


# Factory function to create appropriate device based on power_behavior_type
def create_simulated_device(
    device_id: str,
    device_type: str,
    power_behavior_type: str,
    rated_power_config: Dict[str, Any]
) -> DeviceInterface:
    """
    Factory function to create the appropriate simulation adapter based on power_behavior_type.
    """
    if power_behavior_type == "flat":
        return FlatPowerDevice(device_id, device_type, rated_power_config)
    elif power_behavior_type == "taper":
        return TaperDevice(device_id, device_type, rated_power_config)
    elif power_behavior_type == "duty_cycle":
        return DutyCycleDevice(device_id, device_type, rated_power_config)
    else:
        raise ValueError(f"Unknown power_behavior_type: {power_behavior_type}")
