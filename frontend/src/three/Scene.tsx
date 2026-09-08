/**
 * Scene.tsx — assembles the whole 3D environment: sky, lighting, shadows,
 * camera + orbit controls, and every model. Reads only from the twin store.
 *
 * Lighting is a warm late-afternoon key (Provence golden hour) so the terracotta
 * and stucco read correctly. Day/night is an environment-owned toggle. Decision
 * A is untouched by it — devices glow from their own state in every mode.
 */
import { Suspense } from 'react';

import { OrbitControls, Sky, Stars } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

import { useTwinStore } from '../state/twinStore';
import { useUiStore } from '../state/uiStore';
import { isDeviceActive } from '../types';

import { CameraRig } from './CameraRig';
import { Car } from './models/Car';
import { DeviceLayer } from './models/DeviceLayer';
import { EVCharger } from './models/EVCharger';
import { Ground } from './models/Ground';
import { House } from './models/House';
import { Interior } from './models/Interior';
import { Landscaping } from './models/Landscaping';

const SUN_DAY: [number, number, number] = [34, 20, 30];
const SUN_NIGHT: [number, number, number] = [-30, 16, -25];

function Lighting({ night }: { night: boolean }) {
  const sun = night ? SUN_NIGHT : SUN_DAY;
  return (
    <>
      <ambientLight intensity={night ? 0.4 : 0.5} color={night ? '#93a6cc' : '#fff1dd'} />
      <hemisphereLight
        color={night ? '#33456a' : '#dce8ff'}
        groundColor={night ? '#15151d' : '#9a8560'}
        intensity={night ? 0.6 : 0.85}
      />
      <directionalLight
        position={sun}
        intensity={night ? 0.75 : 2.6}
        color={night ? '#b3c4e6' : '#ffe4b8'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={3}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
      />
      {/* cool bounce fill from the opposite side */}
      <directionalLight
        position={[-24, 12, -18]}
        intensity={night ? 0.1 : 0.5}
        color={night ? '#25406b' : '#bcd0ff'}
      />
      {night && (
        <pointLight position={[-1.4, 3, 8]} color="#ffd9a0" intensity={6} distance={12} decay={2} />
      )}
    </>
  );
}

function SceneContents() {
  const night = useTwinStore((s) => s.timeOfDay === 'night');
  const evse = useTwinStore((s) => s.devices['evse_01']);

  const charging = evse ? isDeviceActive(evse) : false;

  return (
    <>
      <Lighting night={night} />

      {night ? (
        <>
          <color attach="background" args={['#0b1020']} />
          <Stars radius={120} depth={40} count={1800} factor={3} fade speed={0.5} />
          <fog attach="fog" args={['#0b1020', 45, 130]} />
        </>
      ) : (
        <>
          <color attach="background" args={['#cfe0ee']} />
          <Sky distance={450000} sunPosition={SUN_DAY} turbidity={8} rayleigh={2.4} mieCoefficient={0.006} />
          <fog attach="fog" args={['#d7e6f0', 110, 240]} />
        </>
      )}

      <Ground />
      <House />
      <Interior />
      <DeviceLayer />
      <Car isCharging={charging} socPercent={evse?.socPercent} isTapering={evse?.isTapering} />
      <EVCharger connected={charging} charging={charging} tapering={evse?.isTapering} />
      <Landscaping />

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={7}
        maxDistance={110}
        maxPolarAngle={Math.PI / 2 - 0.03}
        target={[0, 3, 0]}
      />
      <CameraRig />
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ position: [27, 15, 34], fov: 48, near: 0.1, far: 600 }}
      gl={{ antialias: true, toneMappingExposure: 1.05 }}
      onPointerMissed={() => useUiStore.getState().select(null)}
    >
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
    </Canvas>
  );
}
