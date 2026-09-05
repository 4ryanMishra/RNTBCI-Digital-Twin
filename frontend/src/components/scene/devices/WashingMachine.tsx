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

export default function WashingMachineMesh({ state, onClick, position }: Props) {
  const drumRef = useRef<THREE.Mesh>(null!);

  const isOn = state?.operationalState === "running";
  const isIdle = state?.operationalState === "idle";
  const glowColor = DEVICE_COLORS.washing_machine.active;

  useFrame((_, delta) => {
    if (drumRef.current && isOn) {
      drumRef.current.rotation.z += delta * 2.0;
    }
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.85, 0.7]} />
        <meshStandardMaterial color="#2a3550" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Porthole */}
      <mesh ref={drumRef} position={[0, 0, 0.37]}>
        <torusGeometry args={[0.22, 0.04, 12, 36]} />
        <meshStandardMaterial
          color={isOn ? glowColor : isIdle ? "#2a5a6a" : "#1a3040"}
          emissive={glowColor}
          emissiveIntensity={isOn ? 0.7 : isIdle ? 0.2 : 0}
          metalness={0.3} roughness={0.5}
        />
      </mesh>
      {/* Porthole glass */}
      <mesh position={[0, 0, 0.37]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial
          color={isOn ? "#4FC3F7" : "#1a2535"}
          transparent opacity={0.4}
          emissive={glowColor}
          emissiveIntensity={isOn ? 0.4 : 0}
        />
      </mesh>
      {/* Control panel strip */}
      <mesh position={[0, 0.37, 0.36]}>
        <boxGeometry args={[0.6, 0.08, 0.02]} />
        <meshStandardMaterial color="#1a2040" />
      </mesh>
      {isOn && <pointLight color={glowColor} intensity={1.0} distance={2.5} />}
    </group>
  );
}
