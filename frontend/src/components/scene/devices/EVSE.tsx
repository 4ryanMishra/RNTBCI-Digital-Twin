/**
 * EVSEMesh — wall-mounted EV charger with animated cable.
 *
 * When the EVSE is "running" / "on":
 *   - Charger box glows blue (or gold when tapering)
 *   - A QuadraticBezierLine cable extends from the charger to the car's
 *     charging port, with a slight droop in the middle
 *   - A small plug box renders at the car's port
 *   - A point-light pulses on the cable midpoint
 *
 * When off:
 *   - Cable is coiled (short stub below the charger box)
 *   - No glow, no point-light
 *
 * Car position (from HouseEnvironment.tsx):
 *   group at [-0.3, FLOOR_Y, 9] = [-0.3, -0.5, 9]
 *   Charging port handle mesh: position=[-0.92, 0.55, 1.4] relative to group
 *   → world position ≈ [-0.3 - 0.92, -0.5 + 0.55, 9 + 1.4] = [-1.22, 0.05, 10.4]
 *
 * EVSE world position (DEVICE_POSITIONS in SceneCanvas): [-6.5, 1.0, 2.5]
 * Cable exit point (bottom of charger box): [-6.5, 0.35, 2.5]
 *
 * Decision A: nothing here reacts to alerts. Only device state drives glow.
 */
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import * as THREE from "three";
import { DEVICE_COLORS } from "../../../utils/colors";
import type { DeviceState } from "../../../types";

interface Props {
  state: DeviceState | undefined;
  onClick: () => void;
  position: [number, number, number];
}

// Car charging port in world-space (matches HouseEnvironment Car component)
const CAR_PORT: [number, number, number] = [-1.22, 0.05, 10.4];

export default function EVSEMesh({ state, onClick, position }: Props) {
  const boxRef   = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  const isOn = state?.operationalState === "running" || state?.operationalState === "on";
  const isTapering = (state?.metadata?.is_tapering as boolean) ?? false;
  const glowColor = isTapering ? DEVICE_COLORS.evse.tapering : DEVICE_COLORS.evse.active;
  const baseColor = isOn ? glowColor : DEVICE_COLORS.evse.off;

  // Pulsing light intensity
  useFrame(() => {
    if (lightRef.current && isOn) {
      lightRef.current.intensity = 1.5 + Math.sin(Date.now() * 0.002) * 0.35;
    }
  });

  // ── Cable geometry ─────────────────────────────────────────────────────
  // Cable exits the bottom of the charger box
  const cableStart = useMemo<[number, number, number]>(
    () => [position[0], position[1] - 0.65, position[2]],
    [position]
  );

  // Mid-control point: droop toward ground between charger and car
  const cableMid = useMemo<[number, number, number]>(
    () => [
      (cableStart[0] + CAR_PORT[0]) / 2,
      Math.min(cableStart[1], CAR_PORT[1]) - 0.6, // sag below both endpoints
      (cableStart[2] + CAR_PORT[2]) / 2,
    ],
    [cableStart]
  );

  // Coiled stub (short loop below the box when off)
  const coilPoints = useMemo<[number, number, number][]>(() => {
    const base: [number, number, number] = [position[0], position[1] - 0.65, position[2]];
    return [
      base,
      [base[0] - 0.15, base[1] - 0.2, base[2] + 0.1],
      [base[0] + 0.15, base[1] - 0.35, base[2] + 0.1],
      [base[0],        base[1] - 0.5,  base[2]],
    ];
  }, [position]);

  return (
    <group position={position} onClick={onClick}>
      {/* ── Charger box ─────────────────────────────────────────── */}
      <mesh ref={boxRef} castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 1.0, 0.2]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={isOn ? glowColor : "#000"}
          emissiveIntensity={isOn ? 0.55 : 0}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Display screen on charger face */}
      <mesh position={[0, 0.15, 0.11]}>
        <planeGeometry args={[0.28, 0.16]} />
        <meshBasicMaterial color={isOn ? "#00e5ff" : "#0a1520"} />
      </mesh>

      {/* Status LED row */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[(i - 1) * 0.1, -0.2, 0.11]}>
          <circleGeometry args={[0.025, 8]} />
          <meshBasicMaterial color={isOn ? (isTapering ? "#FFD700" : "#00e676") : "#333"} />
        </mesh>
      ))}

      {/* Wall bracket */}
      <mesh position={[0, 0.55, -0.16]} castShadow>
        <boxGeometry args={[0.6, 0.12, 0.08]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* ── Cable ────────────────────────────────────────────────── */}
      {isOn ? (
        /* Extended cable to car */
        <>
          <QuadraticBezierLine
            start={cableStart}
            end={CAR_PORT}
            mid={cableMid}
            color={glowColor}
            lineWidth={3}
            dashed={false}
          />

          {/* Plug at car charging port */}
          <mesh position={CAR_PORT} castShadow>
            <boxGeometry args={[0.12, 0.08, 0.12]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={0.6}
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>

          {/* Glow at car port */}
          <pointLight
            position={CAR_PORT}
            color={glowColor}
            intensity={0.8}
            distance={1.5}
          />

          {/* Pulsing light mid-cable */}
          <pointLight
            ref={lightRef}
            position={cableMid}
            color={glowColor}
            intensity={1.5}
            distance={3}
          />
        </>
      ) : (
        /* Coiled cable stub when off */
        <QuadraticBezierLine
          start={coilPoints[0]}
          end={coilPoints[3]}
          mid={coilPoints[1]}
          color="#333333"
          lineWidth={2}
          dashed={false}
        />
      )}

      {/* ── Charger glow when on ──────────────────────────────────── */}
      {isOn && (
        <pointLight
          color={glowColor}
          intensity={1.2}
          distance={2.5}
          position={[0, 0, 0.3]}
        />
      )}

      {/* Base plate */}
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.05, 16]} />
        <meshStandardMaterial color="#1a2535" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  );
}
