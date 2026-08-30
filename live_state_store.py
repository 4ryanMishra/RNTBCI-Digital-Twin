"""
Live State Store - Layer 2 (Digital Twin Core)
In-memory store for current device states.
Used by WebSocket for real-time updates.
Per MASTER_SPEC.md Part 2: separate from history store for independent failure resistance.
"""
from typing import Dict, Optional
from datetime import datetime
from device_interface import DeviceState
import threading


class LiveStateStore:
    """
    In-memory storage for current device states.
    Thread-safe for concurrent access.
    
    This store is completely independent of the history store.
    If history writes fail, live state remains available for WebSocket clients.
    """
    
    def __init__(self):
        self._states: Dict[str, DeviceState] = {}
        self._lock = threading.Lock()
    
    def update_state(self, device_id: str, state: DeviceState) -> None:
        """
        Update the live state for a device.
        Thread-safe operation.
        """
        with self._lock:
            self._states[device_id] = state
    
    def get_state(self, device_id: str) -> Optional[DeviceState]:
        """
        Get the current live state for a device.
        Returns None if device not found.
        """
        with self._lock:
            return self._states.get(device_id)
    
    def get_all_states(self) -> Dict[str, DeviceState]:
        """
        Get all current device states.
        Returns a copy to prevent external modification.
        """
        with self._lock:
            return self._states.copy()
    
    def get_total_power(self) -> float:
        """
        Calculate total household power draw from live states.
        """
        with self._lock:
            return sum(state.power_watts for state in self._states.values())
    
    def clear(self) -> None:
        """Clear all states (for testing/reset)."""
        with self._lock:
            self._states.clear()
    
    def device_count(self) -> int:
        """Return number of devices in live state."""
        with self._lock:
            return len(self._states)
