import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { controlDevice } from "../../api/client";
import { useWsStore } from "../../stores/wsStore";
import { formatWatts, formatDuration, stateBadgeClass } from "../../utils/formatters";
import type { DeviceState } from "../../types";

interface Props {
  deviceId: string | null;
  onClose: () => void;
}

const DEVICE_LABELS: Record<string, string> = {
  evse_01: "EV Charger",
  light_01: "Smart Light",
  dishwasher_01: "Dishwasher",
  washing_machine_01: "Washing Machine",
  water_heater_01: "Water Heater",
  heat_pump_01: "Heat Pump",
  cctv_01: "CCTV Camera",
  microwave_01: "Microwave",
  refrigerator_01: "Refrigerator",
};

export default function DeviceHUDCard({ deviceId, onClose }: Props) {
  const state = useWsStore(s => deviceId ? s.deviceStates[deviceId] : undefined);
  const updateDeviceState = useWsStore(s => s.updateDeviceState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPower, setLocalPower] = useState(3500);
  const [localLevel, setLocalLevel] = useState(128);
  const [localTemp, setLocalTemp] = useState(22);
  const [localMode, setLocalMode] = useState("Normal");
  const [localMwMode, setLocalMwMode] = useState("Cook");
  const [localMwTime, setLocalMwTime] = useState(60);
  const [localMwPower, setLocalMwPower] = useState(100);

  if (!deviceId || !state) return null;

  async function send(action: string, parameters?: Record<string, unknown>) {
    if (!deviceId) return;
    setLoading(true); setError(null);
    try {
      const envelope = await controlDevice(deviceId, { action, parameters });
      updateDeviceState(deviceId, {
        operationalState: envelope.meta.operational_state,
        metadata: Object.fromEntries(
          Object.values(envelope.clusters).flatMap(c => Object.entries(c.attributes))
        ),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }

  const dType = state.deviceType;
  const meta = state.metadata;

  return (
    <AnimatePresence>
      {deviceId && (
        <motion.div
          key={deviceId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25 }}
          className="glass"
          style={{
            width: 300, maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            padding: "1.25rem",
            display: "flex", flexDirection: "column", gap: "0.85rem",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: "var(--stone-500)" }}>
                {deviceId.toUpperCase()}
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e8e8ea", marginTop: "0.15rem" }}>
                {DEVICE_LABELS[deviceId] ?? deviceId}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "var(--stone-500)",
              cursor: "pointer", fontSize: "1.1rem", lineHeight: 1,
            }}>×</button>
          </div>

          {/* State + watts */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className={stateBadgeClass(state.operationalState)}>
              {state.operationalState}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#e8e8ea" }}>
              {formatWatts(state.powerWatts)}
            </span>
          </div>

          {/* Device-specific metadata fields */}
          <MetaSection state={state} />

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.75rem" }}>
            {/* ── EVSE controls ── */}
            {dType === "evse" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.68rem", color: "var(--stone-400)", letterSpacing: "0.08em" }}>
                  CHARGE POWER ({(localPower / 1000).toFixed(1)} kW)
                </label>
                <input type="range" className="slider"
                  min={1400} max={7400} step={100}
                  value={localPower} onChange={e => setLocalPower(+e.target.value)} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("start", { targetPowerWatts: localPower })}>
                    Start ({formatWatts(localPower)})
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("stop")}>
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* ── Light controls ── */}
            {dType === "light" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.68rem", color: "var(--stone-400)", letterSpacing: "0.08em" }}>
                  BRIGHTNESS ({localLevel} / 254)
                </label>
                <input type="range" className="slider" min={0} max={254} step={1}
                  value={localLevel} onChange={e => setLocalLevel(+e.target.value)} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("on")}>On</button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("off")}>Off</button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("set_level", { level: localLevel })}>Set</button>
                </div>
              </div>
            )}

            {/* ── Dishwasher controls ── */}
            {dType === "dishwasher" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <select className="input" value={localMode}
                  onChange={e => setLocalMode(e.target.value)}>
                  {["Normal", "Eco", "Intensive", "Quick"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("start", { mode: localMode })}>Start</button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("pause")}>Pause</button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("stop")}>Stop</button>
                </div>
              </div>
            )}

            {/* ── Washing machine controls ── */}
            {dType === "washing_machine" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <select className="input" value={localMode}
                  onChange={e => setLocalMode(e.target.value)}>
                  {["Normal", "Eco", "Quick", "Delicate"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("start", { mode: localMode })}>Start</button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("pause")}>Pause</button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("stop")}>Stop</button>
                </div>
              </div>
            )}

            {/* ── Water heater controls ── */}
            {dType === "water_heater" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <select className="input" value={localMode}
                  onChange={e => setLocalMode(e.target.value)}>
                  {["Normal", "Eco", "Boost"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <label style={{ fontSize: "0.68rem", color: "var(--stone-400)" }}>
                  TEMP: {localTemp}°C
                </label>
                <input type="range" className="slider" min={40} max={75} step={1}
                  value={localTemp} onChange={e => setLocalTemp(+e.target.value)} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("start", { mode: localMode, targetTemperatureCelsius: localTemp })}>
                    Start
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("stop")}>Stop</button>
                </div>
              </div>
            )}

            {/* ── Heat pump controls ── */}
            {dType === "heat_pump" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <select className="input" value={localMode}
                  onChange={e => setLocalMode(e.target.value)}>
                  {["Heat", "Cool", "Auto"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <label style={{ fontSize: "0.68rem", color: "var(--stone-400)" }}>
                  TARGET: {localTemp}°C
                </label>
                <input type="range" className="slider" min={16} max={30} step={1}
                  value={localTemp} onChange={e => setLocalTemp(+e.target.value)} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("start", { mode: localMode, targetTemperatureCelsius: localTemp })}>
                    Start
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("stop")}>Stop</button>
                </div>
              </div>
            )}

            {/* ── CCTV controls ── */}
            {dType === "cctv" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.72rem" }} disabled={loading}
                    onClick={() => send("set_streaming", { streaming: !(meta?.streaming ?? true) })}>
                    {(meta?.streaming ?? true) ? "Stop Stream" : "Start Stream"}
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.72rem" }} disabled={loading}
                    onClick={() => send("set_recording", { recording: !(meta?.recording ?? true) })}>
                    {(meta?.recording ?? true) ? "Stop Rec" : "Start Rec"}
                  </button>
                </div>
                <p style={{ fontSize: "0.65rem", color: "var(--stone-600)" }}>
                  CCTV cannot be powered off.
                </p>
              </div>
            )}

            {/* ── Microwave controls ── */}
            {dType === "microwave" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <select className="input" value={localMwMode}
                  onChange={e => setLocalMwMode(e.target.value)}>
                  {["Cook", "Defrost", "Reheat"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <label style={{ fontSize: "0.68rem", color: "var(--stone-400)" }}>
                  TIME: {localMwTime}s
                </label>
                <input type="range" className="slider" min={1} max={3600} step={1}
                  value={localMwTime} onChange={e => setLocalMwTime(+e.target.value)} />
                <label style={{ fontSize: "0.68rem", color: "var(--stone-400)" }}>
                  POWER: {localMwPower}%
                </label>
                <input type="range" className="slider" min={10} max={100} step={10}
                  value={localMwPower} onChange={e => setLocalMwPower(+e.target.value)} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("start", {
                      mode: localMwMode,
                      cookTimeSeconds: localMwTime,
                      powerLevelPercent: localMwPower,
                    })}>Start</button>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("stop")}>Stop</button>
                </div>
              </div>
            )}

            {/* ── Refrigerator controls ── */}
            {dType === "refrigerator" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.68rem", color: "var(--stone-400)" }}>
                  TEMP: {localTemp}°C (1–8°C)
                </label>
                <input type="range" className="slider" min={1} max={8} step={1}
                  value={localTemp} onChange={e => setLocalTemp(+e.target.value)} />
                <select className="input" value={localMode}
                  onChange={e => setLocalMode(e.target.value)}>
                  {["Normal", "EcoSaver", "MaxCool"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("set_temperature", { targetTemperatureCelsius: localTemp })}>
                    Set Temp
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.78rem" }} disabled={loading}
                    onClick={() => send("set_mode", { mode: localMode })}>
                    Set Mode
                  </button>
                </div>
                <p style={{ fontSize: "0.65rem", color: "var(--stone-600)" }}>
                  Refrigerator cannot be powered off.
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "0.5rem 0.75rem",
              background: "rgba(244,67,54,0.12)",
              border: "1px solid rgba(244,67,54,0.25)",
              borderRadius: "0.5rem",
              fontSize: "0.72rem", color: "#ef9a9a",
            }}>
              {error}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MetaSection({ state }: { state: DeviceState }) {
  const meta = state.metadata;
  const dType = state.deviceType;
  if (!meta || Object.keys(meta).length === 0) return null;

  const rows: [string, string][] = [];

  if (dType === "evse") {
    rows.push(["SOC", `${(meta.soc_percent as number ?? 0).toFixed(1)}%`]);
    rows.push(["Tapering", meta.is_tapering ? "Yes" : "No"]);
    rows.push(["Rated", formatWatts(meta.rated_power_watts as number ?? 7000)]);
  }
  if (dType === "refrigerator") {
    rows.push(["Compressor", (meta.compressor_on as boolean) ? "ON" : "OFF"]);
    rows.push(["Cycle On", formatDuration(meta.cycle_on_s as number ?? 600)]);
    rows.push(["Cycle Off", formatDuration(meta.cycle_off_s as number ?? 300)]);
  }
  if (dType === "microwave") {
    rows.push(["Time Left", formatDuration(meta.cook_time_seconds_remaining as number ?? 0)]);
    rows.push(["Power", `${meta.power_level_percent ?? 100}%`]);
  }
  if (dType === "cctv") {
    rows.push(["Streaming", (meta.streaming as boolean) ? "Yes" : "No"]);
    rows.push(["Recording", (meta.recording as boolean) ? "Yes" : "No"]);
  }

  if (rows.length === 0) return null;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr",
      gap: "0.3rem 0.75rem",
      fontSize: "0.72rem",
    }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between",
          padding: "0.25rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span style={{ color: "var(--stone-500)" }}>{k}</span>
          <span style={{ color: "#e8e8ea", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
