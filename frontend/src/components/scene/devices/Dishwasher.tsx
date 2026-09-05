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

export default function DishwasherMesh({ state, onClick, position }: Props) {
  const doorRef = useRef<THREE.Mesh>(null!);
  const steamRef = useRef<THREE.Points>(null!);

  const isOn = state?.operationalState === "running";
  const isIdle = state?.operationalState === "idle";
  const glowColor = DEVICE_COLORS.dishwasher.active;

  // Steam particle positions (static for primitives-only)
  const steamPositions = new Float32Array([
    0, 0.6, 0,  0.1, 0.8, 0.05,  -0.1, 0.9, -0.05,
    0.05, 1.0, 0,  -0.05, 1.1, 0.05,
  ]);

  useFrame((_, delta) => {
    if (steamRef.current && isOn) {
      steamRef.current.rotation.y += delta * 0.5;
      steamRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.05;
    }
    if (doorRef.current) {
      const targetIntensity = isOn ? 0.5 : (isIdle ? 0.15 : 0);
      const mat = doorRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * delta * 3;
    }
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.85, 0.7]} />
        <meshStandardMaterial color="#2a3a4a" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Door panel */}
      <mesh ref={doorRef} position={[0, 0, 0.36]}>
        <boxGeometry args={[0.65, 0.78, 0.04]} />
        <meshStandardMaterial
          color={isOn ? glowColor : isIdle ? "#2a5a6a" : "#1a3040"}
          emissive={glowColor}
          emissiveIntensity={isOn ? 0.5 : isIdle ? 0.15 : 0}
          metalness={0.4} roughness={0.5}
        />
      </mesh>
      {/* Handle */}
      <mesh position={[0, 0.3, 0.4]}>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Steam particles when running */}
      {isOn && (
        <points ref={steamRef} position={[0, 0.4, 0]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[steamPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#4FC3F7" size={0.06} transparent opacity={0.6} sizeAttenuation />
        </points>
      )}
      {isOn && <pointLight color={glowColor} intensity={1.2} distance={2.5} />}
    </group>
  );
}
