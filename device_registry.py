"""
Device registry configuration for all 9 devices.
Values from MASTER_SPEC.md Part 3.
This would eventually come from the devices table, but for Phase 2 standalone testing,
we hardcode the registry here.
"""
from typing import Dict, Any, List


# Device registry: all 9 devices from MASTER_SPEC.md Part 3
DEVICE_REGISTRY: List[Dict[str, Any]] = [
    {
        "device_id": "evse_01",
        "device_type": "evse",
        "power_behavior_type": "taper",
        "rated_power_config": {
            "rated_power_watts": 7000.0,
            "taper_start_soc_pct": 80.0,
            "battery_capacity_kwh": 60.0  # Typical EV battery
        },
        "notes": "Flat until ~80-90% SOC, then genuine BMS taper (Decision D)"
    },
    {
        "device_id": "light_01",
        "device_type": "light",
        "power_behavior_type": "flat",
        "rated_power_config": {
            "rated_power_watts": 15.0
        },
        "notes": "OnOff Plug-in Unit (Decision F)"
    },
    {
        "device_id": "dishwasher_01",
        "device_type": "dishwasher",
        "power_behavior_type": "flat",
        "rated_power_config": {
            "rated_power_watts": 1500.0
        },
        "notes": "Generic Appliance"
    },
    {
        "device_id": "washing_machine_01",
        "device_type": "washing_machine",
        "power_behavior_type": "flat",
        "rated_power_config": {
            "rated_power_watts": 2200.0
        },
        "notes": "Generic Appliance"
    },
    {
        "device_id": "water_heater_01",
        "device_type": "water_heater",
        "power_behavior_type": "flat",
        "rated_power_config": {
            "rated_power_watts": 2200.0
        },
        "notes": "Generic Appliance"
    },
    {
        "device_id": "heat_pump_01",
        "device_type": "heat_pump",
        "power_behavior_type": "flat",
        "rated_power_config": {
            "rated_power_watts": 4000.0
        },
        "notes": "Generic Appliance"
    },
    {
        "device_id": "cctv_01",
        "device_type": "cctv",
        "power_behavior_type": "flat",
        "rated_power_config": {
            "rated_power_watts": 10.0
        },
        "notes": "Always-on in practice"
    },
    {
        "device_id": "microwave_01",
        "device_type": "microwave",
        "power_behavior_type": "flat",
        "rated_power_config": {
            "rated_power_watts": 1200.0
        },
        "notes": "On-full or off, no modes. Schema ours, wattage RNTBCI's"
    },
    {
        "device_id": "refrigerator_01",
        "device_type": "refrigerator",
        "power_behavior_type": "duty_cycle",
        "rated_power_config": {
            "on_power_watts": 150.0,
            "idle_power_watts": 5.0,
            "cycle_on_s": 600.0,   # Real-world timing (source of truth)
            "cycle_off_s": 300.0,  # Real-world timing (source of truth)
            "simulation_compression": 10.0  # For demo: 60s on, 30s off
        },
        "notes": "Duty cycle behavior. Schema ours, wattage RNTBCI's"
    }
]


def get_device_config(device_id: str) -> Dict[str, Any]:
    """Get configuration for a specific device."""
    for device in DEVICE_REGISTRY:
        if device["device_id"] == device_id:
            return device
    raise ValueError(f"Device not found: {device_id}")


def get_all_devices() -> List[Dict[str, Any]]:
    """Get all device configurations."""
    return DEVICE_REGISTRY
