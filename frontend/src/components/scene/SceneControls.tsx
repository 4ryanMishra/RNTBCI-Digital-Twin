/**
 * SceneControls — overlay for the 3D environment.
 * Camera presets (Front / Overview / Dollhouse / Kitchen / Utility / Garage·EV / Rear),
 * roof toggle (dollhouse mode), and distinct Daylight / Night / Dark lighting buttons.
 * View-only — never touches wsStore or any device state.
 */
import type { CSSProperties } from "react";
import { CAMERA_PRESETS, useSceneViewStore } from "./environment/sceneViewStore";

// ── Camera preset list ─────────────────────────────────────────────────────
const PRESETS: { key: keyof typeof CAMERA_PRESETS; label: string }[] = [
  { key: "front",     label: "Front" },
  { key: "overview",  label: "Overview" },
  { key: "dollhouse", label: "Dollhouse" },
  { key: "kitchen",   label: "Kitchen" },
  { key: "utility",   label: "Utility" },
  { key: "garage",    label: "Garage / EV" },
  { key: "rear",      label: "Rear" },
];

// ── Styles ─────────────────────────────────────────────────────────────────
const base: CSSProperties = {
  padding: "5px 11px",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,17,23,0.72)",
  backdropFilter: "blur(8px)",
  color: "rgba(232,232,234,0.9)",
  fontSize: "0.68rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  cursor: "pointer",
  transition: "border-color 0.15s, box-shadow 0.15s",
  whiteSpace: "nowrap",
};

const active: CSSProperties = {
  ...base,
  border: "1px solid rgba(77,124,77,0.7)",
  boxShadow: "0 0 10px rgba(77,124,77,0.3)",
  color: "#c8e6c9",
};

// ── Component ──────────────────────────────────────────────────────────────
export default function SceneControls() {
  const goTo           = useSceneViewStore((s) => s.goTo);
  const roofVisible    = useSceneViewStore((s) => s.roofVisible);
  const toggleRoof     = useSceneViewStore((s) => s.toggleRoof);
  const lightingMode   = useSceneViewStore((s) => s.lightingMode);
  const toggleDaylight = useSceneViewStore((s) => s.toggleDaylight);
  const toggleNight    = useSceneViewStore((s) => s.toggleNight);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "1.25rem",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "center",
        zIndex: 15,
        pointerEvents: "none",          // let clicks pass through except on buttons
      }}
    >
      {/* Camera preset row */}
      <div style={{
        display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center",
        pointerEvents: "auto",
      }}>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            style={base}
            onClick={() => {
              // Auto-show roof for dollhouse so it makes sense visually
              if (p.key === "dollhouse" && roofVisible) toggleRoof();
              goTo(p.key);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Environment controls row */}
      <div style={{ display: "flex", gap: 5, pointerEvents: "auto" }}>
        <button
          type="button"
          style={roofVisible ? base : active}
          onClick={toggleRoof}
        >
          {roofVisible ? "Hide roof" : "Show roof"}
        </button>

        <button
          type="button"
          style={lightingMode === "daylight" ? active : base}
          onClick={toggleDaylight}
        >
          ☀ Daylight
        </button>

        <button
          type="button"
          style={lightingMode === "night" ? active : base}
          onClick={toggleNight}
        >
          🌙 Night
        </button>
      </div>
    </div>
  );
}
