import { useState, useEffect } from "react";
import { listDevices } from "../api/client";
import { useWsStore } from "../stores/wsStore";
import SceneCanvas from "../components/scene/SceneCanvas";
import CircuitPanelHUD from "../components/scene/CircuitPanelHUD";
import AlertToast from "../components/scene/AlertToast";
import DeviceHUDCard from "../components/scene/DeviceHUDCard";
import type { DeviceListItem } from "../types";

export default function MainScene() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const setDeviceStates = useWsStore(s => s.setDeviceStates);

  // Bootstrap device states from REST on mount
  useEffect(() => {
    listDevices()
      .then(({ devices }) => {
        const mapped = devices.map((d: DeviceListItem) => ({
          deviceId: d.deviceId,
          deviceType: d.deviceType,
          operationalState: d.operationalState,
          powerWatts: d.powerWatts,
          metadata: {},
        }));
        setDeviceStates(mapped);
      })
      .catch(console.error);
  }, [setDeviceStates]);

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100%",
      background: "#0f1117",
    }}>
      {/* 3D Canvas fills the whole area */}
      <SceneCanvas onDeviceClick={setSelectedDevice} />

      {/* Alert toast — floats top-center */}
      <AlertToast />

      {/* Circuit panel HUD — bottom-left */}
      <div style={{
        position: "absolute",
        bottom: "1.5rem",
        left: "1.5rem",
        zIndex: 20,
      }}>
        <CircuitPanelHUD />
      </div>

      {/* Device HUD card — right panel */}
      <div style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        zIndex: 20,
      }}>
        <DeviceHUDCard
          deviceId={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      </div>

      {/* Zone labels overlay */}
      <div style={{
        position: "absolute",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "2rem",
        pointerEvents: "none",
        zIndex: 10,
      }}>
        {[
          { label: "Kitchen", color: "#4FC3F7" },
          { label: "Utility", color: "#FF7043" },
          { label: "Exterior", color: "#00BFFF" },
          { label: "Living", color: "#FFF5C0" },
        ].map(z => (
          <div key={z.label} style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            fontSize: "0.65rem", color: "var(--stone-400)",
            letterSpacing: "0.1em",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: z.color, boxShadow: `0 0 5px ${z.color}` }} />
            {z.label.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
