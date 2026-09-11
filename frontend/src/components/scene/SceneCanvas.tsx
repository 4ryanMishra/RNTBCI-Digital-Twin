import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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

import HouseEnvironment from "./environment/HouseEnvironment";
import CameraRig from "./environment/CameraRig";

import { useWsStore } from "../../stores/wsStore";
import type { DeviceState } from "../../types";

interface Props {
  onDeviceClick: (deviceId: string) => void;
}

// ── Device zone positions aligned to HouseEnvironment.tsx layout ──────────
// House: X -8→+6, Z -4→+3, FLOOR_Y = -0.5, wallH = 3.4
// Kitchen zone: X -8→+1 (left of partition at X=1)
// Utility zone: X +1→+6 (right of partition)
// Exterior/front: Z > 3 (beyond front opening)
// Car parked at [-0.3, FLOOR_Y, 9] — charging port side at X ≈ -0.9, Z ≈ 7
const DEVICE_POSITIONS: Record<string, [number, number, number]> = {
  // Kitchen zone — against back wall (Z ≈ -3.5), counter height (y ≈ 0.5)
  dishwasher_01:   [-5.5, 0.5, -3],
  microwave_01:    [-3.5, 1.2, -3.2],    // microwave sits higher (on shelf)
  refrigerator_01: [-6.5, 0.7, -2],

  // Utility zone — against back wall, right side of partition
  washing_machine_01: [2.5, 0.5, -3],
  water_heater_01:    [4.5, 0.65, -3],

  // Exterior — EVSE on left wall near garage opening (X ≈ -8, Z ≈ 3–4)
  evse_01:      [-6.5, 1.0, 2.5],  // wall-mounted on left wall, near front
  heat_pump_01: [8.0,  0.5, -1.5], // outdoor unit, right side of house
  cctv_01:      [5.5,  3.2, 2.8],  // corner of house, near roof

  // Living zone — light hangs from ceiling centre
  light_01:     [-3.0, 2.8, 0.5],
};

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
      camera={{ position: [0, 9, 18], fov: 50, near: 0.1, far: 200 }}
      style={{ background: "#0f1117" }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
    >
      {/* Ambient + directional light */}
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={0.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        color="#e8e4d0"
      />
      {/* Subtle fill from below */}
      <pointLight position={[0, -2, 0]} intensity={0.12} color="#4d7c4d" />

      {/* ── French-home environment (wraps the devices) ── */}
      <HouseEnvironment />

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

      {/* Camera controls + preset rig */}
      <OrbitControls
        target={[0, 0.5, 0]}
        minPolarAngle={Math.PI / 8}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={5}
        maxDistance={45}
        enablePan={true}
        makeDefault
      />
      <CameraRig />
    </Canvas>
  );
}
