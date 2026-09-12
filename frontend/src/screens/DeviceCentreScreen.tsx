/**
 * DeviceCentreScreen — full-page device management view.
 *
 * Lists all devices (including solar_panel_01) with:
 *  - Live operational state + wattage from wsStore (updated by WS power_reading)
 *  - On/Off toggle calling controlDevice() via api/client — real backend, no local faking
 *  - Device type badge + room label
 *  - Solar panel row shows generation (positive kW, green) instead of consumption
 *  - "Simulation" mode flag on every row (no real-device adapter exists yet in this
 *    build; the field is displayed as "Simulation" for all devices — when the real
 *    adapter layer ships this can key off DeviceState.metadata.adapter_type)
 *
 * Decision A: nothing here dims, disables, or auto-controls based on alert state.
 */
import { useState } from "react";
import { controlDevice } from "../api/client";
import { useWsStore } from "../stores/wsStore";
import { formatWatts, stateBadgeClass } from "../utils/formatters";

// ── Static metadata per device ────────────────────────────────────────────
interface DeviceMeta {
  id: string;
  label: string;
  room: string;
  icon: string;
  alwaysOn: boolean;       // cannot be toggled (fridge, cctv)
  isGenerator: boolean;    // solar panel — shows generation, not consumption
  toggleOn: string;        // action sent to start
  toggleOff: string;       // action sent to stop
}

const DEVICES: DeviceMeta[] = [
  { id: "solar_panel_01",      label: "Solar Panels",      room: "Roof",     icon: "☀️",  alwaysOn: false, isGenerator: true,  toggleOn: "start", toggleOff: "stop" },
  { id: "evse_01",             label: "EV Charger",        room: "Garage",   icon: "⚡",  alwaysOn: false, isGenerator: false, toggleOn: "start", toggleOff: "stop" },
  { id: "light_01",            label: "Living-room Light", room: "Living",   icon: "💡",  alwaysOn: false, isGenerator: false, toggleOn: "on",    toggleOff: "off"  },
  { id: "dishwasher_01",       label: "Dishwasher",        room: "Kitchen",  icon: "🍽️", alwaysOn: false, isGenerator: false, toggleOn: "start", toggleOff: "stop" },
  { id: "washing_machine_01",  label: "Washing Machine",   room: "Utility",  icon: "🫧",  alwaysOn: false, isGenerator: false, toggleOn: "start", toggleOff: "stop" },
  { id: "water_heater_01",     label: "Water Heater",      room: "Utility",  icon: "🔥",  alwaysOn: false, isGenerator: false, toggleOn: "start", toggleOff: "stop" },
  { id: "heat_pump_01",        label: "Heat Pump",         room: "Exterior", icon: "❄️",  alwaysOn: false, isGenerator: false, toggleOn: "start", toggleOff: "stop" },
  { id: "cctv_01",             label: "Security Camera",   room: "Exterior", icon: "📷",  alwaysOn: true,  isGenerator: false, toggleOn: "start", toggleOff: "stop" },
  { id: "microwave_01",        label: "Microwave",         room: "Kitchen",  icon: "📡",  alwaysOn: false, isGenerator: false, toggleOn: "start", toggleOff: "stop" },
  { id: "refrigerator_01",     label: "Refrigerator",      room: "Kitchen",  icon: "🧊",  alwaysOn: true,  isGenerator: false, toggleOn: "start", toggleOff: "stop" },
];

// ── Toggle button ──────────────────────────────────────────────────────────
function ToggleButton({
  deviceId, isOn, alwaysOn, toggleOn, toggleOff,
}: {
  deviceId: string; isOn: boolean; alwaysOn: boolean; toggleOn: string; toggleOff: string;
}) {
  const updateDeviceState = useWsStore((s) => s.updateDeviceState);
  const [busy, setBusy] = useState(false);

  if (alwaysOn) {
    return (
      <span style={{ fontSize: "0.65rem", color: "var(--stone-500)", letterSpacing: "0.06em" }}>
        ALWAYS ON
      </span>
    );
  }

  async function handleToggle() {
    setBusy(true);
    try {
      const action = isOn ? toggleOff : toggleOn;
      const envelope = await controlDevice(deviceId, { action });
      updateDeviceState(deviceId, {
        operationalState: envelope.meta.operational_state,
        metadata: Object.fromEntries(
          Object.values(envelope.clusters).flatMap((c) =>
            Object.entries((c as { attributes: Record<string, unknown> }).attributes)
          )
        ),
      });
    } catch (e) {
      console.error("Toggle failed:", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      style={{
        padding: "0.3rem 0.85rem",
        borderRadius: "0.4rem",
        border: isOn
          ? "1px solid rgba(74,222,128,0.4)"
          : "1px solid rgba(255,255,255,0.1)",
        background: isOn ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
        color: isOn ? "#4ade80" : "var(--stone-400)",
        fontSize: "0.72rem",
        fontWeight: 600,
        cursor: busy ? "wait" : "pointer",
        transition: "all 0.15s",
        minWidth: 52,
        letterSpacing: "0.04em",
      }}
    >
      {busy ? "…" : isOn ? "ON" : "OFF"}
    </button>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function DeviceCentreScreen() {
  const deviceStates = useWsStore((s) => s.deviceStates);

  return (
    <div style={{
      height: "100%", overflowY: "auto", padding: "1.5rem",
      display: "flex", flexDirection: "column", gap: "1.25rem",
    }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", fontWeight: 700, color: "#f0ece4" }}>
          Device Centre
        </h1>
        <p style={{ fontSize: "0.8rem", color: "var(--stone-400)", marginTop: "0.2rem" }}>
          All devices · live state · simulation mode
        </p>
      </div>

      {/* Device table */}
      <div className="glass" style={{ padding: "0.5rem 0", overflow: "hidden" }}>
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2.5rem 1fr 100px 90px 100px 90px 90px",
          gap: "0 1rem",
          padding: "0.5rem 1.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          {["", "Device", "Room", "State", "Power", "Mode", "Control"].map((h) => (
            <div key={h} style={{
              fontSize: "0.6rem", letterSpacing: "0.12em",
              color: "var(--stone-500)", fontWeight: 600,
            }}>
              {h.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Device rows */}
        {DEVICES.map((meta, i) => {
          const s = deviceStates[meta.id];
          const opState  = s?.operationalState ?? "off";
          const isOn     = opState === "on" || opState === "running";
          const rawWatts = s?.powerWatts ?? 0;

          // Solar: show generation (absolute value, shown as positive)
          const displayWatts = meta.isGenerator ? Math.abs(rawWatts) : rawWatts;
          const genWatts     = meta.isGenerator
            ? ((s?.metadata?.generation_watts as number) ?? displayWatts)
            : null;

          return (
            <div
              key={meta.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2.5rem 1fr 100px 90px 100px 90px 90px",
                gap: "0 1rem",
                padding: "0.7rem 1.25rem",
                alignItems: "center",
                borderBottom: i < DEVICES.length - 1
                  ? "1px solid rgba(255,255,255,0.04)"
                  : "none",
                background: isOn ? "rgba(255,255,255,0.015)" : "transparent",
                transition: "background 0.2s",
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: "1.1rem" }}>{meta.icon}</span>

              {/* Label + ID */}
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: isOn ? "#e8e8ea" : "#78716c" }}>
                  {meta.label}
                </div>
                <div style={{ fontSize: "0.62rem", color: "var(--stone-600)", fontFamily: "var(--font-mono)" }}>
                  {meta.id}
                </div>
              </div>

              {/* Room */}
              <div style={{ fontSize: "0.72rem", color: "var(--stone-500)" }}>{meta.room}</div>

              {/* State badge */}
              <span className={stateBadgeClass(opState)} style={{ fontSize: "0.62rem" }}>
                {opState}
              </span>

              {/* Power / Generation */}
              <div style={{
                fontSize: "0.78rem",
                fontFamily: "var(--font-mono)",
                color: meta.isGenerator
                  ? (isOn ? "#4ade80" : "var(--stone-600)")
                  : (isOn ? "#a3e635" : "var(--stone-600)"),
                fontWeight: 600,
              }}>
                {meta.isGenerator
                  ? (isOn && genWatts != null && genWatts > 0
                      ? `+${formatWatts(genWatts)}`
                      : "—")
                  : (isOn ? formatWatts(displayWatts) : "—")
                }
              </div>

              {/* Mode */}
              <div style={{
                fontSize: "0.62rem",
                color: "var(--stone-500)",
                letterSpacing: "0.06em",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0.3rem",
                padding: "0.18rem 0.4rem",
                textAlign: "center",
              }}>
                SIM
              </div>

              {/* Toggle */}
              <ToggleButton
                deviceId={meta.id}
                isOn={isOn}
                alwaysOn={meta.alwaysOn}
                toggleOn={meta.toggleOn}
                toggleOff={meta.toggleOff}
              />
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: "1.5rem", flexWrap: "wrap",
        padding: "0.75rem 1rem",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "0.5rem",
      }}>
        {[
          { color: "#4ade80", label: "Running / On" },
          { color: "#facc15", label: "Idle" },
          { color: "#f87171", label: "Fault" },
          { color: "#52525b", label: "Off" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: "0.7rem", color: "var(--stone-400)" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <div style={{ fontSize: "0.7rem", color: "#4ade80", fontWeight: 600 }}>+kW</div>
          <span style={{ fontSize: "0.7rem", color: "var(--stone-400)" }}>Solar generation</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <div style={{
            fontSize: "0.62rem", color: "var(--stone-500)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "0.3rem",
            padding: "0.18rem 0.4rem",
          }}>SIM</div>
          <span style={{ fontSize: "0.7rem", color: "var(--stone-400)" }}>Simulation adapter (no physical device)</span>
        </div>
      </div>
    </div>
  );
}
