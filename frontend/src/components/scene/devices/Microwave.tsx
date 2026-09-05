import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEVICE_COLORS } from "../../../utils/colors";
import type { DeviceState } from "../../../types";

interface Props {
  state: DeviceState | undefined;
  onClick: () => void;
  position: [number, number, number];
}

export default function MicrowaveMesh({ state, onClick, position }: Props) {
  const plateRef = useRef<THREE.Mesh>(null!);
  const [timeLeft, setTimeLeft] = useState(0);

  const isOn = state?.operationalState === "running" || state?.operationalState === "on";
  const glowColor = DEVICE_COLORS.microwave.active;

  useEffect(() => {
    const remaining = (state?.metadata?.cook_time_seconds_remaining as number) ?? 0;
    setTimeLeft(remaining);
  }, [state?.metadata?.cook_time_seconds_remaining]);

  useFrame((_, delta) => {
    if (plateRef.current && isOn) {
      plateRef.current.rotation.y += delta * 1.5;
    }
    // Count down locally (coarse)
    if (isOn && timeLeft > 0) {
      setTimeLeft(t => Math.max(0, t - delta));
    }
  });

  return (
    <group position={position} onClick={onClick}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.85, 0.55, 0.6]} />
        <meshStandardMaterial color="#1e1426" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Door window */}
      <mesh position={[-0.14, 0, 0.31]}>
        <boxGeometry args={[0.48, 0.44, 0.02]} />
        <meshStandardMaterial
          color={isOn ? glowColor : "#0d0010"}
          transparent opacity={isOn ? 0.55 : 0.9}
          emissive={glowColor}
          emissiveIntensity={isOn ? 0.6 : 0}
        />
      </mesh>
      {/* Door frame */}
      <mesh position={[-0.14, 0, 0.31]}>
        <boxGeometry args={[0.52, 0.48, 0.015]} />
        <meshStandardMaterial color="#2a1a38" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Rotating turntable */}
      <mesh ref={plateRef} position={[-0.14, -0.1, 0.15]}>
        <cylinderGeometry args={[0.17, 0.17, 0.02, 20]} />
        <meshStandardMaterial
          color={isOn ? glowColor : "#2a1a38"}
          emissive={glowColor}
          emissiveIntensity={isOn ? 0.4 : 0}
          transparent opacity={0.8}
        />
      </mesh>
      {/* Control panel */}
      <mesh position={[0.33, 0, 0.31]}>
        <boxGeometry args={[0.14, 0.5, 0.02]} />
        <meshStandardMaterial color="#120a1a" />
      </mesh>
      {isOn && <pointLight color={glowColor} intensity={0.9} distance={2} />}
    </group>
  );
}
