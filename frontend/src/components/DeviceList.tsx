/**
 * DeviceList — a slim index of the 9 appliances so they're discoverable without
 * hunting in the 3D view. Click a row to select the device (opens its card) and
 * fly the camera to it. Also holds the Decision-A overload test.
 */
import { useState } from 'react';

import { controlDevice } from '../api/client';
import { useCameraStore } from '../state/cameraStore';
import { useTwinStore } from '../state/twinStore';
import { useUiStore } from '../state/uiStore';
import { DEVICE_PLACEMENTS, GLOW_COLORS, type DevicePlacement } from '../three/layout';
import { isDeviceActive } from '../types';

const isOutdoor = (p: DevicePlacement) =>
  /outside|exterior|roof/i.test(p.room);

export function DeviceList() {
  const devices = useTwinStore((s) => s.devices);
  const roofVisible = useTwinStore((s) => s.roofVisible);
  const toggleRoof = useTwinStore((s) => s.toggleRoof);
  const selectedId = useUiStore((s) => s.selectedDeviceId);
  const select = useUiStore((s) => s.select);
  const goToDevice = useCameraStore((s) => s.goToDevice);
  const setTarget = useCameraStore((s) => s.setTarget);
  const [open, setOpen] = useState(true);

  const focus = (p: DevicePlacement) => {
    select(p.id);
    const [x, y, z] = p.position;
    if (isOutdoor(p)) {
      goToDevice(p.position);
    } else {
      // indoor: lift the roof and view from a high dollhouse angle that always
      // clears the walls; the pulse ring + label pick the device out.
      if (roofVisible) toggleRoof();
      setTarget({ position: [x * 0.3 + 8, 15, 20], lookAt: [x, y + 0.5, z] });
    }
  };

  if (!open) {
    return (
      <button type="button" className="dl-fab" onClick={() => setOpen(true)}>
        Appliances
      </button>
    );
  }

  return (
    <div className="device-list">
      <div className="dl-head">
        <strong>Appliances</strong>
        <button type="button" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      <ul>
        {DEVICE_PLACEMENTS.map((p) => {
          const d = devices[p.id];
          const on = p.type === 'solar_panel' ? (d?.generationWatts ?? 0) > 5 : d ? isDeviceActive(d) : false;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={selectedId === p.id ? 'dl-row active' : 'dl-row'}
                onClick={() => focus(p)}
              >
                <span
                  className="dl-dot"
                  style={{
                    background: on ? GLOW_COLORS[p.type] : 'transparent',
                    borderColor: GLOW_COLORS[p.type],
                  }}
                />
                <span className="dl-name">{p.label}</span>
                <span className="dl-state">
                  {p.type === 'solar_panel'
                    ? `+${Math.round(d?.generationWatts ?? 0)} W`
                    : `${d ? Math.round(d.powerWatts) : 0} W`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="dl-overload"
        onClick={async () => {
          await controlDevice('evse_01', 'start', { targetPowerWatts: 7400 }).catch(() => {});
          await controlDevice('heat_pump_01', 'start').catch(() => {});
          await controlDevice('water_heater_01', 'start').catch(() => {});
        }}
      >
        ⚡ Overload test (Decision A)
      </button>
    </div>
  );
}
