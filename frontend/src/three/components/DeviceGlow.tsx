/**
 * DeviceGlow — the emissive "this device is consuming power" light.
 *
 * ⚠️ Decision A (see PURVA_ONBOARDING.md / DEVICE_VISUALS_MAPPING.md):
 * the glow's on/off and intensity are driven ONLY by the device's own
 * operational state. There is deliberately NO `alertActive` input here.
 * An overload alert must never dim, fade, or extinguish a device — only a
 * human turning the device off (a `state_change` to off/idle) does that.
 *
 * Fade timing follows the mapping doc: ~0.3 s in, ~0.2 s out.
 */
import { useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import { MathUtils, type PointLight } from 'three';

import type { DeviceType } from '../../types';
import { GLOW_COLORS } from '../layout';

interface DeviceGlowProps {
  type: DeviceType;
  /** Device is on/running — the ONLY thing that gates the glow. */
  active: boolean;
  /** Target intensity when fully active. */
  intensity?: number;
  /** Multiplier while active but in a low phase (fridge compressor off = 0.3). Never 0. */
  activeDimFactor?: number;
  /** Override the emissive colour (EVSE shifts blue -> gold while tapering). */
  color?: string;
  distance?: number;
  position?: [number, number, number];
}

const DEFAULT_INTENSITY: Partial<Record<DeviceType, number>> = {
  evse: 6,
  light: 8,
  heat_pump: 5,
  water_heater: 5,
  refrigerator: 3.5,
  cctv: 1.6,
};

export function DeviceGlow({
  type,
  active,
  intensity,
  activeDimFactor = 1,
  color,
  distance = 3.2,
  position = [0, 0, 0],
}: DeviceGlowProps) {
  const lightRef = useRef<PointLight>(null);
  const target = (intensity ?? DEFAULT_INTENSITY[type] ?? 2.2) * (active ? activeDimFactor : 0);
  const glowColor = color ?? GLOW_COLORS[type];

  useFrame((_, dt) => {
    const l = lightRef.current;
    if (!l) return;
    // Frame-rate independent ease. lambda ~10 => ~0.3 s to settle.
    l.intensity = MathUtils.damp(l.intensity, target, 10, dt);
    l.color.set(glowColor);
  });

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        color={glowColor}
        intensity={0}
        distance={distance}
        decay={2}
        castShadow={false}
      />
      {/* Small emissive core so the glow reads even in daylight. */}
      <mesh scale={active ? 1 : 0.001}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color={glowColor} toneMapped={false} />
      </mesh>
    </group>
  );
}
