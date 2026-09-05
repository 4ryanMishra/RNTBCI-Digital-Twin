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

export default function LightMesh({ state, onClick, position }: Props) {
  const bulbRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  const isOn = state?.operationalState === "on" || state?.operationalState === "running";
  const level = (state?.metadata?.level as number) ?? 254;
  const intensity = isOn ? (level / 254) : 0;

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.intensity = intensity * 2.5;
    }
    if (bulbRef.current) {
      (bulbRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity * 0.9;
    }
  });

  const glowColor = DEVICE_COLORS.light.active;

  return (
    <group position={position} onClick={onClick}>
      {/* Ceiling mount */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.12, 0.08, 0.12, 8]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.55, 8]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      {/* Bulb */}
      <mesh ref={bulbRef}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial
          color={isOn ? glowColor : DEVICE_COLORS.light.off}
          emissive={glowColor}
          emissiveIntensity={intensity * 0.9}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Shade */}
      <mesh position={[0, 0.12, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.25, 0.2, 16, 1, true]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {isOn && (
        <pointLight ref={lightRef} color={glowColor} intensity={intensity * 2.5} distance={4} decay={2} />
      )}
    </group>
  );
}
