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

export default function WaterHeaterMesh({ state, onClick, position }: Props) {
  const bodyRef = useRef<THREE.Mesh>(null!);

  const isOn = state?.operationalState === "running" || state?.operationalState === "on";
  const glowColor = DEVICE_COLORS.water_heater.active;

  useFrame((_, delta) => {
    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshStandardMaterial;
      const target = isOn ? 0.6 + Math.sin(Date.now() * 0.0015) * 0.15 : 0;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * delta * 2;
    }
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Tank body */}
      <mesh ref={bodyRef} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 1.0, 20]} />
        <meshStandardMaterial
          color={isOn ? "#5c2812" : "#2a1a14"}
          emissive={glowColor}
          emissiveIntensity={isOn ? 0.6 : 0}
          metalness={0.55} roughness={0.4}
        />
      </mesh>
      {/* Top dome */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2a1a14" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Bottom dome */}
      <mesh position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2a1a14" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Pipe in */}
      <mesh position={[0.15, 0.65, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.25, 8]} />
        <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Pipe out */}
      <mesh position={[-0.15, 0.65, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.25, 8]} />
        <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
      </mesh>
      {isOn && <pointLight color={glowColor} intensity={1.3} distance={2.5} />}
    </group>
  );
}
