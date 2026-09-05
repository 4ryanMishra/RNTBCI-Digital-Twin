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

export default function EVSEMesh({ state, onClick, position }: Props) {
  const ref = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const cableRef = useRef<THREE.Mesh>(null!);

  const isOn = state?.operationalState === "running" || state?.operationalState === "on";
  const isTapering = (state?.metadata?.is_tapering as boolean) ?? false;
  const glowColor = isTapering ? DEVICE_COLORS.evse.tapering : DEVICE_COLORS.evse.active;
  const baseColor = isOn ? glowColor : DEVICE_COLORS.evse.off;

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (isOn) {
      ref.current.rotation.y += delta * 0.3;
      if (lightRef.current) {
        lightRef.current.intensity = 1.5 + Math.sin(Date.now() * 0.002) * 0.3;
      }
    }
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Charger box */}
      <mesh ref={ref} castShadow>
        <boxGeometry args={[0.5, 1.0, 0.3]} />
        <meshStandardMaterial color={baseColor} emissive={isOn ? glowColor : "#000"} emissiveIntensity={isOn ? 0.6 : 0} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Cable */}
      <mesh ref={cableRef} position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
        <meshStandardMaterial color={isOn ? glowColor : "#333"} emissive={isOn ? glowColor : "#000"} emissiveIntensity={isOn ? 0.4 : 0} />
      </mesh>
      {/* Plug tip */}
      <mesh position={[0, -1.05, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color={isOn ? glowColor : "#222"} emissive={isOn ? glowColor : "#000"} emissiveIntensity={0.5} />
      </mesh>
      {/* Point light when active */}
      {isOn && (
        <pointLight ref={lightRef} color={glowColor} intensity={1.5} distance={3} />
      )}
      {/* Label base */}
      <mesh position={[0, -1.3, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.05, 16]} />
        <meshStandardMaterial color="#1a2535" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  );
}
