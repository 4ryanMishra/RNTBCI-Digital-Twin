/**
 * AppliancesPanel — overlay listing all devices with live wattage + status dot.
 * Reads exclusively from wsStore; never writes to it.
 * Solar panel row shows generation (positive) with a green ☀ icon, visually
 * distinguished from consumer rows.
 * Decision A: no alert-driven dimming — only wsStore state drives rendering.
 */
import { useWsStore } from "../../stores/wsStore";

const DEVICE_META: {
  id: string; label: string; room: string; icon: string; isGenerator?: boolean;
}[] = [
  { id: "solar_panel_01",     label: "Solar Panels",      room: "Roof",     icon: "☀️", isGenerator: true },
  { id: "evse_01",            label: "EV Charger",        room: "Garage",   icon: "⚡" },
  { id: "light_01",           label: "Living-room Light", room: "Living",   icon: "💡" },
  { id: "dishwasher_01",      label: "Dishwasher",        room: "Kitchen",  icon: "🍽" },
  { id: "washing_machine_01", label: "Washing Machine",   room: "Utility",  icon: "🫧" },
  { id: "water_heater_01",    label: "Water Heater",      room: "Utility",  icon: "🔥" },
  { id: "heat_pump_01",       label: "Heat Pump",         room: "Exterior", icon: "❄" },
  { id: "cctv_01",            label: "Security Camera",   room: "Exterior", icon: "📷" },
  { id: "microwave_01",       label: "Microwave",         room: "Kitchen",  icon: "📡" },
  { id: "refrigerator_01",    label: "Refrigerator",      room: "Kitchen",  icon: "🧊" },
];

function dotColor(state: string | undefined, isGenerator = false): string {
  if (isGenerator) return state === "running" ? "#4ade80" : "#52525b";
  switch (state) {
    case "running": case "on": return "#4ade80";
    case "idle":               return "#facc15";
    case "fault":              return "#f87171";
    default:                   return "#52525b";
  }
}

function formatW(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(1)} kW`;
  return `${Math.round(w)} W`;
}

export default function AppliancesPanel() {
  const deviceStates = useWsStore((s) => s.deviceStates);

  return (
    <div style={{
      position: "absolute", top: "1rem", left: "1rem", zIndex: 20,
      width: 220,
      background: "rgba(10,12,18,0.82)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: "0.75rem",
      padding: "0.85rem 0.9rem",
      display: "flex", flexDirection: "column", gap: 0,
    }}>
      <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: "rgba(120,113,108,1)", marginBottom: "0.65rem", fontWeight: 600 }}>
        APPLIANCES
      </div>

      {DEVICE_META.map((d, i) => {
        const s       = deviceStates[d.id];
        const opState = s?.operationalState ?? "off";
        const isGen   = d.isGenerator === true;
        const active  = opState === "on" || opState === "running";

        // Solar: prefer generation_watts from metadata, fall back to abs(power_watts)
        const genWatts  = isGen
          ? ((s?.metadata?.generation_watts as number) ?? Math.abs(s?.powerWatts ?? 0))
          : 0;
        const showWatts = isGen ? genWatts : (s?.powerWatts ?? 0);
        const isActive  = isGen ? (active && genWatts > 0) : active;
        const rowBg     = isGen && isActive ? "rgba(74,222,128,0.04)" : "transparent";

        return (
          <div
            key={d.id}
            style={{
              display: "flex", alignItems: "center", gap: "0.55rem",
              padding: "0.35rem 0.2rem",
              borderBottom: i < DEVICE_META.length - 1
                ? "1px solid rgba(255,255,255,0.05)" : "none",
              background: rowBg,
              borderRadius: isGen ? "0.3rem" : 0,
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: dotColor(opState, isGen),
              boxShadow: isActive ? `0 0 5px ${dotColor(opState, isGen)}` : "none",
              transition: "background 0.3s, box-shadow 0.3s",
            }} />

            <span style={{ fontSize: "0.8rem", flexShrink: 0 }}>{d.icon}</span>

            <span style={{
              flex: 1, fontSize: "0.72rem",
              color: isGen ? (isActive ? "#86efac" : "#78716c") : (isActive ? "#e8e8ea" : "#78716c"),
              fontWeight: isActive ? 600 : 400,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              transition: "color 0.3s",
            }}>
              {d.label}
            </span>

            <span style={{
              fontSize: "0.65rem", fontFamily: "var(--font-mono, monospace)",
              minWidth: 46, textAlign: "right",
              color: isGen ? (isActive ? "#4ade80" : "#3f3f46") : (isActive ? "#a3e635" : "#3f3f46"),
              transition: "color 0.3s",
            }}>
              {isGen
                ? (isActive && genWatts > 0 ? `+${formatW(genWatts)}` : "—")
                : (isActive ? formatW(showWatts) : "—")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
