/**
 * DeviceCard — appears when an appliance is clicked in the 3D scene. Shows live
 * state and the controls for that device type, calling the mock-server control
 * endpoint. The WebSocket then updates the store and the 3D glow.
 *
 * This is a working stand-in for Shruti's HUD control cards — same API surface,
 * safe to restyle/replace.
 */
import { useState, type ReactNode } from 'react';

import { controlDevice } from '../api/client';
import { DEVICE_PLACEMENT_BY_ID, GLOW_COLORS } from '../three/layout';
import { useUiStore } from '../state/uiStore';
import { useDevice } from '../state/twinStore';
import { isDeviceActive, type DeviceState, type DeviceType } from '../types';

const MODES: Partial<Record<DeviceType, string[]>> = {
  dishwasher: ['Normal', 'Eco', 'Intensive', 'Quick'],
  washing_machine: ['Normal', 'Eco', 'Quick', 'Delicate'],
  water_heater: ['Normal', 'Eco', 'Boost'],
  heat_pump: ['Heat', 'Cool', 'Auto'],
  microwave: ['Cook', 'Defrost', 'Reheat'],
  refrigerator: ['Normal', 'Eco', 'Rapid Cool'],
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="dc-field">
      <span>{label}</span>
      <div className="dc-control">{children}</div>
    </div>
  );
}

function Slider({
  min,
  max,
  step,
  value,
  unit,
  onCommit,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const commit = () => {
    if (draft !== null) onCommit(draft);
    setDraft(null);
  };
  return (
    <label className="dc-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onBlur={commit}
        onKeyUp={commit}
      />
      <span className="dc-slider-val">
        {shown}
        {unit}
      </span>
    </label>
  );
}

function Controls({ d }: { d: DeviceState }) {
  const id = d.deviceId;
  const active = isDeviceActive(d);
  const send = (action: string, parameters?: Record<string, unknown>) =>
    controlDevice(id, action, parameters).catch(() => {});
  const modes = MODES[d.deviceType];

  switch (d.deviceType) {
    case 'light':
      return (
        <>
          <Row label="Power">
            <button type="button" className="dc-btn" onClick={() => send(active ? 'off' : 'on')}>
              {active ? 'Turn off' : 'Turn on'}
            </button>
          </Row>
          <Row label="Brightness">
            <Slider
              min={0}
              max={254}
              step={2}
              value={d.level ?? 254}
              onCommit={(v) => send('set_level', { level: v })}
            />
          </Row>
        </>
      );

    case 'evse':
      return (
        <>
          <Row label="Charging">
            <button
              type="button"
              className="dc-btn"
              onClick={() => send(active ? 'stop' : 'start')}
            >
              {active ? 'Unplug / stop' : 'Start charging'}
            </button>
          </Row>
          <Row label="Charge power">
            <Slider
              min={1400}
              max={7400}
              step={100}
              unit=" W"
              value={Math.round(d.powerWatts || 7400)}
              onCommit={(v) => send('start', { targetPowerWatts: v })}
            />
          </Row>
          <Row label="State of charge">
            <span className="dc-readout">
              {(d.socPercent ?? 0).toFixed(0)}% {d.isTapering ? '· tapering' : ''}
            </span>
          </Row>
        </>
      );

    case 'cctv':
      return (
        <>
          <Row label="Streaming">
            <button
              type="button"
              className="dc-btn"
              onClick={() => send('set_streaming', { streaming: !(d.streaming ?? true) })}
            >
              {d.streaming ?? true ? 'Live' : 'Paused'}
            </button>
          </Row>
          <Row label="Recording">
            <button
              type="button"
              className="dc-btn"
              onClick={() => send('set_recording', { recording: !(d.recording ?? true) })}
            >
              {d.recording ?? true ? 'Recording' : 'Off'}
            </button>
          </Row>
          <p className="dc-note">Security camera — always powered, cannot be switched off.</p>
        </>
      );

    case 'refrigerator':
      return (
        <>
          <Row label="Mode">
            <select
              className="dc-select"
              value={d.mode ?? 'Normal'}
              onChange={(e) => send('set_mode', { mode: e.target.value })}
            >
              {modes?.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Row>
          <Row label="Target temp">
            <Slider
              min={1}
              max={8}
              step={1}
              unit=" °C"
              value={Math.round(d.targetTemperatureCelsius ?? 4)}
              onCommit={(v) => send('set_temperature', { targetTemperatureCelsius: v })}
            />
          </Row>
          <Row label="Compressor">
            <span className="dc-readout">{d.compressorOn ? 'running' : 'idle'}</span>
          </Row>
          <p className="dc-note">Always powered — duty-cycles automatically.</p>
        </>
      );

    case 'water_heater':
    case 'heat_pump':
      return (
        <>
          <Row label="Power">
            <button
              type="button"
              className="dc-btn"
              onClick={() => send(active ? 'stop' : 'start', active ? undefined : { mode: d.mode })}
            >
              {active ? 'Turn off' : 'Turn on'}
            </button>
          </Row>
          <Row label="Mode">
            <select
              className="dc-select"
              value={d.mode ?? modes?.[0] ?? 'Normal'}
              onChange={(e) => send('start', { mode: e.target.value })}
            >
              {modes?.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Row>
          <Row label="Target temp">
            <Slider
              min={d.deviceType === 'heat_pump' ? 16 : 40}
              max={d.deviceType === 'heat_pump' ? 30 : 75}
              step={1}
              unit=" °C"
              value={Math.round(
                d.targetTemperatureCelsius ?? (d.deviceType === 'heat_pump' ? 21 : 55),
              )}
              onCommit={(v) => send('start', { mode: d.mode, targetTemperatureCelsius: v })}
            />
          </Row>
        </>
      );

    case 'microwave':
      return (
        <>
          <Row label="Cook">
            <button
              type="button"
              className="dc-btn"
              onClick={() =>
                send(active ? 'stop' : 'start', active ? undefined : { mode: d.mode ?? 'Cook', cookTimeSeconds: 90 })
              }
            >
              {active ? 'Stop' : 'Start 90 s'}
            </button>
          </Row>
          <Row label="Mode">
            <select
              className="dc-select"
              value={d.mode ?? 'Cook'}
              onChange={(e) => send('start', { mode: e.target.value, cookTimeSeconds: 90 })}
            >
              {modes?.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Row>
          {active && (
            <Row label="Time left">
              <span className="dc-readout">{d.cookTimeSecondsRemaining ?? 0} s</span>
            </Row>
          )}
        </>
      );

    // dishwasher, washing_machine
    default:
      return (
        <>
          <Row label="Cycle">
            <div className="dc-btn-group">
              <button type="button" className="dc-btn" onClick={() => send('start', { mode: d.mode })}>
                Start
              </button>
              <button type="button" className="dc-btn" onClick={() => send('pause')}>
                Pause
              </button>
              <button type="button" className="dc-btn" onClick={() => send('stop')}>
                Stop
              </button>
            </div>
          </Row>
          <Row label="Programme">
            <select
              className="dc-select"
              value={d.mode ?? 'Normal'}
              onChange={(e) => send('start', { mode: e.target.value })}
            >
              {modes?.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Row>
        </>
      );
  }
}

export function DeviceCard() {
  const selectedId = useUiStore((s) => s.selectedDeviceId);
  const select = useUiStore((s) => s.select);
  const device = useDevice(selectedId ?? '');
  const placement = selectedId ? DEVICE_PLACEMENT_BY_ID[selectedId] : undefined;

  if (!selectedId || !device || !placement) return null;
  const active = isDeviceActive(device);
  const tone = GLOW_COLORS[device.deviceType];

  return (
    <div className="device-card" style={{ borderTopColor: tone }}>
      <div className="dc-head">
        <div>
          <strong>{placement.label}</strong>
          <span className="dc-room">{placement.room}</span>
        </div>
        <span className={`dc-badge ${active ? 'on' : 'off'}`}>{device.operationalState}</span>
        <button type="button" className="dc-close" onClick={() => select(null)}>
          ×
        </button>
      </div>

      <div className="dc-power">
        {device.powerWatts >= 1000
          ? `${(device.powerWatts / 1000).toFixed(2)} kW`
          : `${Math.round(device.powerWatts)} W`}{' '}
        drawn now
      </div>

      <div className="dc-body">
        <Controls d={device} />
      </div>
    </div>
  );
}
