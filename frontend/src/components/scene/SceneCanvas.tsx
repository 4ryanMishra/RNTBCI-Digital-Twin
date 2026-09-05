import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

import EVSEMesh from "./devices/EVSE";
import LightMesh from "./devices/Light";
import DishwasherMesh from "./devices/Dishwasher";
import WashingMachineMesh from "./devices/WashingMachine";
import WaterHeaterMesh from "./devices/WaterHeater";
import HeatPumpMesh from "./devices/HeatPump";
import CCTVMesh from "./devices/CCTV";
import MicrowaveMesh from "./devices/Microwave";
import RefrigeratorMesh from "./devices/Refrigerator";

import { useWsStore } from "../../stores/wsStore";
import type { DeviceState } from "../../types";

interface Props {
  onDeviceClick: (deviceId: string) => void;
}

// Zone positions — frontend's call
const DEVICE_POSITIONS: Record<string, [number, number, number]> = {
  // Kitchen zone
  dishwasher_01:   [-4, 0.5, -1.5],
  microwave_01:    [-2.5, 0.5, -1.5],
  refrigerator_01: [-5.5, 0.7, -1.5],
  // Utility zone
  washing_machine_01: [3, 0.5, -1.5],
  water_heater_01:    [4.8, 0.65, -1.5],
  // Exterior zone
  evse_01:      [0, 0.65, 3.5],
  heat_pump_01: [2, 0.5, 3.5],
  cctv_01:      [-1.8, 1.5, 3.5],
  // Living zone
  light_01:     [-4, 1.8, 2],
};

function ZoneLabel({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.01, 0.01, 0.01]} />
      <meshStandardMaterial visible={false} />
    </mesh>
  );
}

export default function SceneCanvas({ onDeviceClick }: Props) {
  const deviceStates = useWsStore(s => s.deviceStates);
  const lastDutyCycle = useWsStore(s => s.lastDutyCycleToggle);

  const compressorOn = (lastDutyCycle?.data.compressorOn) ??
    (deviceStates["refrigerator_01"]?.metadata?.compressor_on as boolean) ?? true;

  function ds(id: string): DeviceState | undefined {
    return deviceStates[id];
  }

  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 12], fov: 50, near: 0.1, far: 100 }}
      style={{ background: "#0f1117" }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
    >
      {/* Ambient + directional light */}
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        color="#e8e4d0"
      />
      {/* Subtle fill from below */}
      <pointLight position={[0, -2, 0]} intensity={0.15} color="#4d7c4d" />

      {/* Grid floor */}
      <Grid
        args={[30, 30]}
        position={[0, -0.5, 0]}
        cellColor="#1e2535"
        sectionColor="#2d3a52"
        fadeDistance={20}
        fadeStrength={1.5}
        cellSize={1}
        sectionSize={3}
      />

      {/* Zone labels (invisible meshes as anchors) */}
      <ZoneLabel position={[-4, -0.4, -1.5]} />
      <ZoneLabel position={[4, -0.4, -1.5]} />
      <ZoneLabel position={[0, -0.4, 3.5]} />
      <ZoneLabel position={[-4, -0.4, 2]} />

      {/* ── Kitchen zone ── */}
      <DishwasherMesh   state={ds("dishwasher_01")}   onClick={() => onDeviceClick("dishwasher_01")}   position={DEVICE_POSITIONS.dishwasher_01} />
      <MicrowaveMesh    state={ds("microwave_01")}    onClick={() => onDeviceClick("microwave_01")}    position={DEVICE_POSITIONS.microwave_01} />
      <RefrigeratorMesh state={ds("refrigerator_01")} onClick={() => onDeviceClick("refrigerator_01")} position={DEVICE_POSITIONS.refrigerator_01} compressorOn={compressorOn} />

      {/* ── Utility zone ── */}
      <WashingMachineMesh state={ds("washing_machine_01")} onClick={() => onDeviceClick("washing_machine_01")} position={DEVICE_POSITIONS.washing_machine_01} />
      <WaterHeaterMesh    state={ds("water_heater_01")}    onClick={() => onDeviceClick("water_heater_01")}    position={DEVICE_POSITIONS.water_heater_01} />

      {/* ── Exterior zone ── */}
      <EVSEMesh     state={ds("evse_01")}      onClick={() => onDeviceClick("evse_01")}      position={DEVICE_POSITIONS.evse_01} />
      <HeatPumpMesh state={ds("heat_pump_01")} onClick={() => onDeviceClick("heat_pump_01")} position={DEVICE_POSITIONS.heat_pump_01} />
      <CCTVMesh     state={ds("cctv_01")}      onClick={() => onDeviceClick("cctv_01")}      position={DEVICE_POSITIONS.cctv_01} />

      {/* ── Living zone ── */}
      <LightMesh state={ds("light_01")} onClick={() => onDeviceClick("light_01")} position={DEVICE_POSITIONS.light_01} />

      {/* Camera controls */}
      <OrbitControls
        target={[0, 0, 0]}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.4}
        minDistance={5}
        maxDistance={22}
        enablePan={true}
      />
    </Canvas>
  );
}
