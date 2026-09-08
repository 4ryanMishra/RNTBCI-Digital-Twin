/**
 * EVCharger.tsx — Type-2 wall-box on the house wall left of the garage, with an
 * animated charging cable.
 *
 * Task 2.2 / 2.3: `connected` (the EVSE on/off state Shruti passes) drives a
 * 0..1 progress. Off -> the cable is a loose coil at the box. On -> it grows
 * along a smooth Catmull-Rom curve to the car's charge port over ~1 s. The
 * curve/tube is rebuilt from a throttled progress value, so the geometry is
 * always consistent with the current state (no imperative ref juggling).
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, MathUtils, TubeGeometry, Vector3 } from 'three';

import { CAR, EV_CHARGER, HOUSE } from '../layout';

interface EVChargerProps {
  connected: boolean;
  charging: boolean;
  tapering?: boolean;
}

const ANCHOR = new Vector3(...EV_CHARGER.cableAnchor);
const PORT = new Vector3(CAR.chargePort[0] + 0.02, CAR.chargePort[1], CAR.chargePort[2]);

function cableGeometry(t: number): TubeGeometry {
  const end = new Vector3().lerpVectors(ANCHOR, PORT, t);
  const mid = new Vector3().lerpVectors(ANCHOR, end, 0.5);
  const c1 = new Vector3(ANCHOR.x + 0.1, ANCHOR.y - 0.55, ANCHOR.z + 0.25);
  const c2 = new Vector3(mid.x, mid.y - 0.4 - 0.5 * (1 - t), mid.z);
  const curve = new CatmullRomCurve3([ANCHOR.clone(), c1, c2, end]);
  return new TubeGeometry(curve, 22, 0.028, 6, false);
}

export function EVCharger({ connected, charging, tapering }: EVChargerProps) {
  const [progress, setProgress] = useState(0);
  const target = useRef(0);
  const raw = useRef(0);

  useEffect(() => {
    target.current = connected ? 1 : 0;
  }, [connected]);

  useFrame((_, dt) => {
    raw.current = MathUtils.damp(raw.current, target.current, 6, dt);
    if (Math.abs(raw.current - target.current) < 0.004) raw.current = target.current;
    // throttle React updates to meaningful steps
    if (Math.abs(raw.current - progress) > 0.012) setProgress(raw.current);
  });

  const geo = useMemo(() => cableGeometry(progress), [progress]);
  const plugPos = useMemo(() => new Vector3().lerpVectors(ANCHOR, PORT, progress), [progress]);

  const screenColor = !connected
    ? '#20303a'
    : charging
      ? tapering
        ? '#FFD700'
        : '#00BFFF'
      : '#39d353';
  const coilScale = Math.max(0.001, 1 - progress * 3);

  return (
    <group>
      {/* wall box */}
      <group position={EV_CHARGER.position}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.72, 0.16]} />
          <meshStandardMaterial color="#2C3540" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.14, 0.09]}>
          <planeGeometry args={[0.26, 0.18]} />
          <meshStandardMaterial
            color={screenColor}
            emissive={screenColor}
            emissiveIntensity={connected ? 0.9 : 0.25}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.18, 0.09]}>
          <circleGeometry args={[0.03, 12]} />
          <meshStandardMaterial
            color={connected ? screenColor : '#5a5a5a'}
            emissive={connected ? screenColor : '#000'}
            emissiveIntensity={connected ? 1.5 : 0}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.34, 0.12]} castShadow>
          <boxGeometry args={[0.16, 0.14, 0.16]} />
          <meshStandardMaterial color="#1E252C" />
        </mesh>
        <mesh position={[0, 0, -0.09]}>
          <boxGeometry args={[0.5, 0.8, 0.03]} />
          <meshStandardMaterial color="#3A4028" />
        </mesh>
        {/* loose coil, shown while unplugged */}
        <mesh position={[0, -0.34, 0.2]} rotation={[Math.PI / 2, 0, 0]} scale={coilScale}>
          <torusGeometry args={[0.16, 0.028, 8, 20]} />
          <meshStandardMaterial color="#101012" roughness={0.8} />
        </mesh>
      </group>

      {/* cable + plug (world space) — only while there is a cable run */}
      {progress > 0.01 && (
        <>
          <mesh geometry={geo} castShadow>
            <meshStandardMaterial color="#101012" roughness={0.8} />
          </mesh>
          <mesh position={plugPos} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.2]} />
            <meshStandardMaterial color="#26262A" />
          </mesh>
        </>
      )}

      {/* faint ground guide toward the bay */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(EV_CHARGER.position[0] + PORT.x) / 2, 0.014, (HOUSE.frontZ + PORT.z) / 2]}
      >
        <planeGeometry args={[0.05, PORT.z - HOUSE.frontZ]} />
        <meshStandardMaterial color="#8a8780" />
      </mesh>
    </group>
  );
}
