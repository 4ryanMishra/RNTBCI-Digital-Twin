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

export default function CCTVMesh({ state, onClick, position }: Props) {
  const recRef = useRef<THREE.Mesh>(null!);
  const isRecording = (state?.metadata?.recording as boolean) ?? true;
  const isStreaming = (state?.metadata?.streaming as boolean) ?? true;
  const glowColor = DEVICE_COLORS.cctv.active;
  const dimColor = DEVICE_COLORS.cctv.dim;

  useFrame(() => {
    if (recRef.current && isRecording) {
      const mat = recRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.004) * 0.5;
    }
  });

  // CCTV is always on — no off state
  return (
    <group position={position} onClick={onClick}>
      {/* Wall bracket */}
      <mesh position={[0, 0.3, -0.1]}>
        <boxGeometry args={[0.12, 0.25, 0.08]} />
        <meshStandardMaterial color="#546e7a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Camera body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.08, 0.10, 0.4, 12]} />
        <meshStandardMaterial
          color={isStreaming ? glowColor : dimColor}
          emissive={isStreaming ? glowColor : dimColor}
          emissiveIntensity={0.25}
          metalness={0.6} roughness={0.4}
        />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.04, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Lens glass */}
      <mesh position={[0, 0.25, 0]}>
        <circleGeometry args={[0.04, 16]} />
        <meshStandardMaterial color="#0d1117" transparent opacity={0.8}
          emissive="#263238" emissiveIntensity={0.3} />
      </mesh>
      {/* REC indicator dot */}
      <mesh ref={recRef} position={[0.1, 0.15, 0.07]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial
          color={DEVICE_COLORS.cctv.recDot}
          emissive={DEVICE_COLORS.cctv.recDot}
          emissiveIntensity={isRecording ? 1.0 : 0.2}
        />
      </mesh>
      {/* Always-on dim light */}
      <pointLight color={glowColor} intensity={0.4} distance={2} />
    </group>
  );
}
