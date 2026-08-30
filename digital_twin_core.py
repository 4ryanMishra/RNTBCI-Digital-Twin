"""
Digital Twin Core - Layer 2
Orchestrates live state store and history store.
Per MASTER_SPEC.md Part 2: both stores are separate and independently failure-resistant.
"""
from typing import Dict, Optional, List
from datetime import datetime
from device_interface import DeviceInterface, DeviceState
from live_state_store import LiveStateStore
from history_store import HistoryStore
import logging

logger = logging.getLogger(__name__)


class DigitalTwinCore:
    """
    Core orchestrator for the digital twin.
    Manages devices and coordinates live/history stores.
    
    Per MASTER_SPEC.md Part 2 rationale:
    - Live state store: in-memory, for WebSocket
    - History store: database, for REST/export
    - Both are separate - one failure doesn't take down the other
    """
    
    def __init__(
        self,
        live_store: LiveStateStore,
        history_store: Optional[HistoryStore] = None
    ):
        """
        Initialize digital twin core.
        
        Args:
            live_store: Required - in-memory live state
            history_store: Optional - database history (can be None for testing)
        """
        self.live_store = live_store
        self.history_store = history_store
        self.devices: Dict[str, DeviceInterface] = {}
        self.current_time = 0.0
    
    def register_device(self, device: DeviceInterface) -> None:
        """
        Register a device with the digital twin.
        Initializes its live state.
        """
        self.devices[device.device_id] = device
        
        # Initialize live state
        initial_state = device.get_state()
        self.live_store.update_state(device.device_id, initial_state)
        
        logger.info(f"Registered device: {device.device_id}")
    
    def tick(self, delta_seconds: float = 1.0) -> None:
        """
        Advance simulation by delta_seconds.
        Updates all devices and stores.
        
        Per Decision B: row-per-tick history writes for all devices.
        
        Failure handling:
        - Device tick failures: logged, continue with other devices
        - Live store update: should never fail (in-memory)
        - History store write: logged if fails, doesn't block simulation
        """
        self.current_time += delta_seconds
        timestamp = datetime.utcnow()
        
        for device_id, device in self.devices.items():
            try:
                # Advance device simulation
                device.tick(delta_seconds)
                
                # Get updated state
                state = device.get_state()
                
                # Update live store (should never fail - in-memory)
                self.live_store.update_state(device_id, state)
                
                # Update history store (may fail - log but don't crash)
                if self.history_store:
                    success = self.history_store.record_state(state, timestamp)
                    if not success:
                        logger.warning(
                            f"History write failed for {device_id} at t={self.current_time}s "
                            "(live state still available)"
                        )
            
            except Exception as e:
                logger.error(f"Device tick failed for {device_id}: {e} (continuing with other devices)")
                continue
    
    def apply_command(
        self,
        device_id: str,
        command: Dict
    ) -> Optional[DeviceState]:
        """
        Apply a command to a device.
        Updates both stores.
        
        Args:
            device_id: Target device
            command: Command dict (e.g., {"action": "start"})
        
        Returns:
            Updated DeviceState, or None if device not found
        """
        device = self.devices.get(device_id)
        if not device:
            logger.error(f"Device not found: {device_id}")
            return None
        
        try:
            # Apply command to device
            state = device.apply_command(command)
            
            # Update live store
            self.live_store.update_state(device_id, state)
            
            # Update history store
            if self.history_store:
                success = self.history_store.record_state(state)
                if not success:
                    logger.warning(f"History write failed for command on {device_id}")
            
            logger.info(f"Command applied to {device_id}: {command}")
            return state
        
        except Exception as e:
            logger.error(f"Failed to apply command to {device_id}: {e}")
            return None
    
    def get_live_state(self, device_id: str) -> Optional[DeviceState]:
        """Get current live state for a device."""
        return self.live_store.get_state(device_id)
    
    def get_all_live_states(self) -> Dict[str, DeviceState]:
        """Get all current device states."""
        return self.live_store.get_all_states()
    
    def get_total_power(self) -> float:
        """Get total household power draw from live states."""
        return self.live_store.get_total_power()
    
    def get_device_count(self) -> int:
        """Get number of registered devices."""
        return len(self.devices)
    
    def get_history_reading_count(self, device_id: Optional[str] = None) -> int:
        """
        Get count of historical readings.
        Returns 0 if history store not available.
        """
        if not self.history_store:
            return 0
        return self.history_store.get_reading_count(device_id)
