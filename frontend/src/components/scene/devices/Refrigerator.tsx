import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEVICE_COLORS } from "../../../utils/colors";
import type { DeviceState } from "../../../types";

interface Props {
  state: DeviceState | undefined;
  onClick: () => void;
  position: [number, number, number];
  // duty_cycle_toggle drives glow
  compressorOn?: boolean;
}

export default function RefrigeratorMesh({ state, onClick, position, compressorOn }: Props) {
  const bodyRef = useRef<THREE.Mesh>(null!);

  // Refrigerator is always on — never off
  const compressor = compressorOn ?? (state?.metadata?.compressor_on as boolean) ?? true;

  // Full glow when compressor on, ~30% when idle — must be visibly distinct
  const activeColor = DEVICE_COLORS.refrigerator.full;
  const idleColor = DEVICE_COLORS.refrigerator.idle;
  const currentColor = compressor ? activeColor : idleColor;
  const targetIntensity = compressor ? 0.65 : 0.18;

  useFrame((_, delta) => {
    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * delta * 2;
      // Smoothly transition emissive colour
      const current = mat.emissive;
      const target = new THREE.Color(currentColor);
      current.lerp(target, delta * 2);
    }
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Main fridge body */}
      <mesh ref={bodyRef} castShadow>
        <boxGeometry args={[0.65, 1.3, 0.65]} />
        <meshStandardMaterial
          color="#1d2e2d"
          emissive={new THREE.Color(activeColor)}
          emissiveIntensity={compressor ? 0.65 : 0.18}
          metalness={0.5} roughness={0.45}
        />
      </mesh>
      {/* Freezer compartment (top 30%) */}
      <mesh position={[0, 0.5, 0.33]}>
        <boxGeometry args={[0.6, 0.35, 0.02]} />
        <meshStandardMaterial color="#162525" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Fridge door */}
      <mesh position={[0, -0.2, 0.33]}>
        <boxGeometry args={[0.6, 0.75, 0.02]} />
        <meshStandardMaterial color="#1d2e2d" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Handle */}
      <mesh position={[0.27, 0, 0.36]}>
        <boxGeometry args={[0.04, 0.5, 0.04]} />
        <meshStandardMaterial color="#80cbc4" metalness={0.8} roughness={0.2}
          emissive="#80cbc4" emissiveIntensity={compressor ? 0.4 : 0.1} />
      </mesh>
      {/* Compressor indicator */}
      <mesh position={[0, -0.69, 0]}>
        <boxGeometry args={[0.6, 0.08, 0.6]} />
        <meshStandardMaterial
          color={compressor ? activeColor : idleColor}
          emissive={compressor ? activeColor : idleColor}
          emissiveIntensity={compressor ? 0.8 : 0.2}
        />
      </mesh>
      <pointLight color={currentColor} intensity={compressor ? 1.1 : 0.3} distance={2.5} />
    </group>
  );
}
