"""
Device abstraction interface for RNTBCI Digital Twin.
Per MASTER_SPEC.md Part 2, Layer 1: common interface for all devices.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any
from dataclasses import dataclass


@dataclass
class DeviceState:
    """
    Common device state structure.
    operational_state values: off, on, running, idle, fault, setup_incomplete
    """
    device_id: str
    device_type: str
    operational_state: str  # Must be one of: off, on, running, idle, fault, setup_incomplete
    power_watts: float
    metadata: Dict[str, Any]  # Device-specific state (SOC, temperature, etc.)


class DeviceInterface(ABC):
    """
    Abstract interface that all devices (simulated or real) must implement.
    This boundary allows swapping simulation adapter ↔ real device adapter
    with zero change to layers above (per Part 2 rationale).
    """
    
    def __init__(self, device_id: str, device_type: str, rated_power_config: Dict[str, Any]):
        self.device_id = device_id
        self.device_type = device_type
        self.rated_power_config = rated_power_config
    
    @abstractmethod
    def get_state(self) -> DeviceState:
        """
        Returns current device state including operational_state and power draw.
        """
        pass
    
    @abstractmethod
    def get_power_draw(self) -> float:
        """
        Returns instantaneous power draw in watts.
        """
        pass
    
    @abstractmethod
    def apply_command(self, command: Dict[str, Any]) -> DeviceState:
        """
        Apply a control command (start, stop, set mode, etc.).
        Returns updated device state after command is applied.
        
        Common commands:
        - {"action": "start"} or {"action": "stop"}
        - Device-specific commands in metadata
        """
        pass
    
    @abstractmethod
    def tick(self, delta_seconds: float) -> None:
        """
        Advance simulation time by delta_seconds.
        Used by simulation adapters to update internal state (SOC, duty cycle, etc.).
        Real device adapters may no-op this.
        """
        pass
