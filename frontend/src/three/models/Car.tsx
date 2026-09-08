/**
 * Car.tsx — compact French hatchback (Peugeot/Renault silhouette), low-poly,
 * parked on the driveway nose-out toward the street.
 *
 * Charging visuals (Task 2.4): when `isCharging` a soft glow sits at the
 * charge flap and a SOC bar floats above the roof. Glow colour follows the
 * EVSE convention — electric blue, shifting to gold while the pack tapers.
 * Decision A: this is the car's own charging state, never touched by alerts.
 */
import { Html } from '@react-three/drei';

import { CAR } from '../layout';

interface CarProps {
  isCharging: boolean;
  socPercent?: number;
  isTapering?: boolean;
}

const BODY = '#D9DCE1';
const BODY_DARK = '#2B2E33';
const GLASS = '#1C2A33';
const TRIM = '#3A3D42';

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.22, 20]} />
        <meshStandardMaterial color="#1A1A1C" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.001, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.24, 16]} />
        <meshStandardMaterial color="#9DA1A6" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function Car({ isCharging, socPercent, isTapering }: CarProps) {
  const glow = isTapering ? '#FFD700' : '#00BFFF';
  const soc = Math.max(0, Math.min(100, socPercent ?? 0));

  return (
    <group position={CAR.position} rotation={[0, CAR.rotationY, 0]}>
      {/* lower body */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.55, 4.0]} />
        <meshStandardMaterial color={BODY} metalness={0.4} roughness={0.35} />
      </mesh>
      {/* sill / lower cladding */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.86, 0.22, 3.9]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>
      {/* hood */}
      <mesh position={[0, 0.74, 1.5]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[1.7, 0.16, 1.2]} />
        <meshStandardMaterial color={BODY} metalness={0.4} roughness={0.35} />
      </mesh>
      {/* boot */}
      <mesh position={[0, 0.82, -1.7]} rotation={[0.16, 0, 0]} castShadow>
        <boxGeometry args={[1.7, 0.16, 0.9]} />
        <meshStandardMaterial color={BODY} metalness={0.4} roughness={0.35} />
      </mesh>
      {/* cabin */}
      <mesh position={[0, 1.12, -0.15]} castShadow>
        <boxGeometry args={[1.6, 0.6, 2.1]} />
        <meshStandardMaterial color={BODY} metalness={0.4} roughness={0.35} />
      </mesh>
      {/* greenhouse glass */}
      <mesh position={[0, 1.13, -0.15]}>
        <boxGeometry args={[1.62, 0.4, 1.9]} />
        <meshStandardMaterial color={GLASS} metalness={0.2} roughness={0.1} />
      </mesh>
      {/* windshield + rear glass wedges */}
      <mesh position={[0, 1.06, 0.95]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[1.5, 0.05, 0.8]} />
        <meshStandardMaterial color={GLASS} metalness={0.2} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.08, -1.2]} rotation={[0.6, 0, 0]}>
        <boxGeometry args={[1.5, 0.05, 0.7]} />
        <meshStandardMaterial color={GLASS} metalness={0.2} roughness={0.1} />
      </mesh>

      {/* headlights */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.62, 2.02]}>
          <boxGeometry args={[0.4, 0.18, 0.06]} />
          <meshStandardMaterial color="#F4F6D6" emissive="#EAEeb0" emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* taillights */}
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 0.72, -1.98]}>
          <boxGeometry args={[0.34, 0.22, 0.06]} />
          <meshStandardMaterial color="#B62A22" emissive="#B62A22" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {/* mirrors */}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 1.02, 0.75]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.1]} />
          <meshStandardMaterial color={BODY_DARK} />
        </mesh>
      ))}

      <Wheel position={[0.9, 0.34, 1.35]} />
      <Wheel position={[-0.9, 0.34, 1.35]} />
      <Wheel position={[0.9, 0.34, -1.35]} />
      <Wheel position={[-0.9, 0.34, -1.35]} />

      {/* charge flap (driver side, front) */}
      <mesh position={[-0.92, 0.7, 1.4]}>
        <boxGeometry args={[0.04, 0.2, 0.2]} />
        <meshStandardMaterial
          color={isCharging ? glow : '#B7BABF'}
          emissive={isCharging ? glow : '#000000'}
          emissiveIntensity={isCharging ? 1.2 : 0}
          toneMapped={false}
        />
      </mesh>

      {isCharging && (
        <>
          <pointLight position={[-1.0, 0.7, 1.4]} color={glow} intensity={2} distance={1.3} decay={2} />
          <Html position={[0, 2.15, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                width: 96,
                font: '600 11px/1.4 system-ui, sans-serif',
                color: '#fff',
                textAlign: 'center',
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ marginBottom: 3 }}>
                {isTapering ? 'Tapering' : 'Charging'} · {soc.toFixed(0)}%
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.25)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${soc}%`,
                    height: '100%',
                    background: glow,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
