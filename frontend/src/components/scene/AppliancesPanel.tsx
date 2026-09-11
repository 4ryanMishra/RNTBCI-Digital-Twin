/**
 * AppliancesPanel — right-side overlay listing all 9 devices with live
 * wattage and a status dot. Reads exclusively from wsStore; never writes to it.
 * Decision A: no alert-driven dimming or disabling here — only state from wsStore.
 */
import { useWsStore } from "../../stores/wsStore";

// ── Device display metadata (static labels + room) ────────────────────────
const DEVICE_META: {
  id: string;
  label: string;
  room: string;
  icon: string;
}[] = [
  { id: "evse_01",            label: "EV Charger",       room: "Garage",   icon: "⚡" },
  { id: "light_01",           label: "Living-room Light", room: "Living",   icon: "💡" },
  { id: "dishwasher_01",      label: "Dishwasher",        room: "Kitchen",  icon: "🍽" },
  { id: "washing_machine_01", label: "Washing Machine",   room: "Utility",  icon: "🫧" },
  { id: "water_heater_01",    label: "Water Heater",      room: "Utility",  icon: "🔥" },
  { id: "heat_pump_01",       label: "Heat Pump",         room: "Exterior", icon: "❄" },
  { id: "cctv_01",            label: "Security Camera",   room: "Exterior", icon: "📷" },
  { id: "microwave_01",       label: "Microwave",         room: "Kitchen",  icon: "📡" },
  { id: "refrigerator_01",    label: "Refrigerator",      room: "Kitchen",  icon: "🧊" },
];

// ── Dot color by operational state ────────────────────────────────────────
function dotColor(state: string | undefined): string {
  switch (state) {
    case "running":
    case "on":      return "#4ade80"; // green
    case "idle":    return "#facc15"; // amber
    case "fault":   return "#f87171"; // red
    case "off":
    default:        return "#52525b"; // zinc-600
  }
}

function formatW(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(1)} kW`;
  return `${Math.round(w)} W`;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AppliancesPanel() {
  const deviceStates = useWsStore((s) => s.deviceStates);

  return (
    <div
      style={{
        position: "absolute",
        top: "1rem",
        left: "1rem",
        zIndex: 20,
        width: 210,
        background: "rgba(10,12,18,0.82)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "0.75rem",
        padding: "0.85rem 0.9rem",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Header */}
      <div style={{
        fontSize: "0.6rem",
        letterSpacing: "0.12em",
        color: "rgba(120,113,108,1)",
        marginBottom: "0.65rem",
        fontWeight: 600,
      }}>
        APPLIANCES
      </div>

      {/* Device rows */}
      {DEVICE_META.map((d, i) => {
        const s = deviceStates[d.id];
        const opState = s?.operationalState ?? "off";
        const watts   = s?.powerWatts ?? 0;
        const active  = opState === "on" || opState === "running";

        return (
          <div
            key={d.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              padding: "0.35rem 0",
              borderBottom: i < DEVICE_META.length - 1
                ? "1px solid rgba(255,255,255,0.05)"
                : "none",
            }}
          >
            {/* Status dot */}
            <span style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: dotColor(opState),
              flexShrink: 0,
              boxShadow: active ? `0 0 5px ${dotColor(opState)}` : "none",
              transition: "background 0.3s, box-shadow 0.3s",
            }} />

            {/* Icon */}
            <span style={{ fontSize: "0.8rem", flexShrink: 0 }}>{d.icon}</span>

            {/* Label */}
            <span style={{
              flex: 1,
              fontSize: "0.72rem",
              color: active ? "#e8e8ea" : "#78716c",
              fontWeight: active ? 600 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              transition: "color 0.3s",
            }}>
              {d.label}
            </span>

            {/* Wattage — only shown when active */}
            <span style={{
              fontSize: "0.65rem",
              fontFamily: "var(--font-mono, monospace)",
              color: active ? "#a3e635" : "#3f3f46",
              minWidth: 42,
              textAlign: "right",
              transition: "color 0.3s",
            }}>
              {active ? formatW(watts) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
