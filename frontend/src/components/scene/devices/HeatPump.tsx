import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEVICE_COLORS } from "../../../utils/colors";
import type { DeviceState } from "../../../types";

interface Props {
  state: DeviceState | undefined;
  onClick: () => void;
  position: [number, number, number];
}

export default function HeatPumpMesh({ state, onClick, position }: Props) {
  const fanRef = useRef<THREE.Mesh>(null!);

  const isOn = state?.operationalState === "running" || state?.operationalState === "on";
  const mode = (state?.metadata?.mode as string)?.toLowerCase() ?? "cool";
  const glowColor = mode === "heat" ? DEVICE_COLORS.heat_pump.heat : DEVICE_COLORS.heat_pump.cool;

  useFrame((_, delta) => {
    if (fanRef.current && isOn) {
      fanRef.current.rotation.z += delta * 3.5;
    }
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Outdoor unit box */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.75, 0.45]} />
        <meshStandardMaterial color="#263238" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Grille */}
      <mesh position={[0, 0, 0.23]}>
        <boxGeometry args={[0.8, 0.65, 0.02]} />
        <meshStandardMaterial color="#1c282e" metalness={0.4} roughness={0.7} wireframe />
      </mesh>
      {/* Fan ring */}
      <mesh position={[0, 0, 0.24]}>
        <torusGeometry args={[0.28, 0.03, 8, 24]} />
        <meshStandardMaterial color="#37474f" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Fan blades */}
      <mesh ref={fanRef} position={[0, 0, 0.24]}>
        <torusGeometry args={[0.18, 0.06, 3, 4]} />
        <meshStandardMaterial
          color={isOn ? glowColor : "#263238"}
          emissive={glowColor}
          emissiveIntensity={isOn ? 0.5 : 0}
          metalness={0.5} roughness={0.4}
        />
      </mesh>
      {/* Status indicator */}
      <mesh position={[0.35, 0.3, 0.24]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color={isOn ? glowColor : "#333"}
          emissive={glowColor}
          emissiveIntensity={isOn ? 1.0 : 0}
        />
      </mesh>
      {isOn && <pointLight color={glowColor} intensity={1.2} distance={3} />}
    </group>
  );
}
