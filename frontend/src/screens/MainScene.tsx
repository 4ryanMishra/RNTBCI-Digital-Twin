import { useState, useEffect } from "react";
import { listDevices } from "../api/client";
import { useWsStore } from "../stores/wsStore";
import SceneCanvas from "../components/scene/SceneCanvas";
import SceneControls from "../components/scene/SceneControls";
import CircuitPanelHUD from "../components/scene/CircuitPanelHUD";
import AlertToast from "../components/scene/AlertToast";
import DeviceHUDCard from "../components/scene/DeviceHUDCard";
import AppliancesPanel from "../components/scene/AppliancesPanel";
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

      {/* Appliances list panel — top-left */}
      <AppliancesPanel />

      {/* Circuit panel HUD — bottom-left */}
      <div style={{
        position: "absolute",
        bottom: "1.5rem",
        left: "1.5rem",
        zIndex: 20,
      }}>
        <CircuitPanelHUD />
      </div>

      {/* Device HUD card — top-right (slides in on device click) */}
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

      {/* Camera presets + roof / daylight / night toggles */}
      <SceneControls />
    </div>
  );
}
