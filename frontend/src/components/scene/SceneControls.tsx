/**
 * SceneControls — small overlay for the 3D environment: camera presets, roof
 * toggle (dollhouse), and a daylight toggle. View-only; never touches devices.
 */
import type { CSSProperties } from "react";

import { CAMERA_PRESETS, useSceneViewStore } from "./environment/sceneViewStore";

const PRESETS: { key: keyof typeof CAMERA_PRESETS; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "overview", label: "Overview" },
  { key: "kitchen", label: "Kitchen" },
  { key: "utility", label: "Utility" },
  { key: "driveway", label: "Driveway" },
];

const btn: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 7,
  border: "1px solid var(--glass-border)",
  background: "var(--glass-bg)",
  backdropFilter: "var(--glass-blur)",
  color: "var(--stone-200)",
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.03em",
  cursor: "pointer",
};

export default function SceneControls() {
  const goTo = useSceneViewStore((s) => s.goTo);
  const roofVisible = useSceneViewStore((s) => s.roofVisible);
  const toggleRoof = useSceneViewStore((s) => s.toggleRoof);
  const daylight = useSceneViewStore((s) => s.daylight);
  const toggleDaylight = useSceneViewStore((s) => s.toggleDaylight);

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
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {PRESETS.map((p) => (
          <button key={p.key} type="button" style={btn} onClick={() => goTo(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" style={btn} onClick={toggleRoof}>
          {roofVisible ? "Hide roof" : "Show roof"}
        </button>
        <button type="button" style={btn} onClick={toggleDaylight}>
          {daylight ? "Night" : "Daylight"}
        </button>
      </div>
    </div>
  );
}
