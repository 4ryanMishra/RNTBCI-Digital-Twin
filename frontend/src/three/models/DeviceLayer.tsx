/**
 * DeviceLayer.tsx — placeholder 3D models for the 9 appliances, each wired to
 * its live state from the store and its Decision-A-compliant glow.
 *
 * These meshes are intentionally simple ("Shruti will replace with real
 * models"). What matters here is that every device is in the right room at
 * the coordinate in ../layout.ts, and that the glow logic is correct:
 *   - glow follows operationalState only (never an alert)
 *   - fridge dims (not off) on the compressor-off phase
 *   - EVSE glow shifts blue -> gold while tapering
 *   - light intensity scales with Matter level
 */
import { useRef } from 'react';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

import { useTwinStore } from '../../state/twinStore';
import { useUiStore } from '../../state/uiStore';
import { isDeviceActive, type DeviceState } from '../../types';
import { DeviceGlow } from '../components/DeviceGlow';
import {
  DEVICE_PLACEMENTS,
  EVSE_TAPER_COLOR,
  GLOW_COLORS,
  type DevicePlacement,
} from '../layout';

const CASING = '#ECEEF0';
const CASING_DARK = '#3b3f45';

function Fridge({ state }: { state: DeviceState }) {
  const active = isDeviceActive(state); // always true — fridge has no off state
  const compressorOn = state.compressorOn ?? true;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 1, 0]}>
        <boxGeometry args={[0.72, 2.0, 0.72]} />
        <meshStandardMaterial color={CASING} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0.3, 1.2, 0.37]}>
        <boxGeometry args={[0.04, 0.5, 0.04]} />
        <meshStandardMaterial color={CASING_DARK} />
      </mesh>
      <mesh position={[0, 0.62, 0.36]}>
        <boxGeometry args={[0.72, 0.03, 0.02]} />
        <meshStandardMaterial color={CASING_DARK} />
      </mesh>
      <DeviceGlow
        type="refrigerator"
        active={active}
        activeDimFactor={compressorOn ? 1 : 0.3}
        position={[0, 1, 0.4]}
      />
    </group>
  );
}

function CeilingLight({ state }: { state: DeviceState }) {
  const active = isDeviceActive(state);
  const level = state.level ?? 254;
  const intensity = 9 * (level / 254);
  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
        <meshStandardMaterial color={CASING_DARK} />
      </mesh>
      <mesh castShadow>
        <coneGeometry args={[0.22, 0.24, 16, 1, true]} />
        <meshStandardMaterial color="#C9CDD2" side={2} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          color="#FFF5C0"
          emissive="#FFF5C0"
          emissiveIntensity={active ? 1.4 : 0}
          toneMapped={false}
        />
      </mesh>
      <DeviceGlow type="light" active={active} intensity={intensity} distance={5} />
    </group>
  );
}

function UnderCounter({ state, round }: { state: DeviceState; round: boolean }) {
  const active = isDeviceActive(state);
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[0.62, 0.82, 0.62]} />
        <meshStandardMaterial color={CASING} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.42, 0.32]}>
        {round ? <circleGeometry args={[0.22, 24]} /> : <planeGeometry args={[0.44, 0.5]} />}
        <meshStandardMaterial
          color={active ? GLOW_COLORS[state.deviceType] : '#5a6b73'}
          emissive={active ? GLOW_COLORS[state.deviceType] : '#000'}
          emissiveIntensity={active ? 0.7 : 0}
          metalness={0.4}
          roughness={0.15}
        />
      </mesh>
      <DeviceGlow type={state.deviceType} active={active} position={[0, 0.42, 0.35]} />
    </group>
  );
}

function WaterHeater({ state }: { state: DeviceState }) {
  const active = isDeviceActive(state);
  return (
    <group>
      <mesh castShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 1.4, 20]} />
        <meshStandardMaterial color="#E4E1D8" metalness={0.2} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.4, 0.32]}>
        <boxGeometry args={[0.18, 0.12, 0.06]} />
        <meshStandardMaterial
          color={active ? '#FF7043' : '#444'}
          emissive={active ? '#FF7043' : '#000'}
          emissiveIntensity={active ? 1.2 : 0}
          toneMapped={false}
        />
      </mesh>
      <DeviceGlow type="water_heater" active={active} position={[0, 0.7, 0]} />
    </group>
  );
}

function HeatPump({ state }: { state: DeviceState }) {
  const active = isDeviceActive(state);
  const heat = (state.mode ?? 'Heat').toLowerCase() === 'heat';
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[1.0, 0.82, 0.4]} />
        <meshStandardMaterial color="#D7DADE" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.42, 0.21]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.03, 8, 20]} />
        <meshStandardMaterial color={CASING_DARK} />
      </mesh>
      <DeviceGlow
        type="heat_pump"
        active={active}
        color={heat ? '#FF7043' : GLOW_COLORS.heat_pump}
        position={[0, 0.42, 0.1]}
      />
    </group>
  );
}

function Cctv({ state }: { state: DeviceState }) {
  // CCTV is always running; streaming just changes the LED brightness.
  const streaming = state.streaming ?? true;
  return (
    <group rotation={[0, Math.PI * 0.15, -0.25]}>
      <mesh position={[-0.12, 0, 0]}>
        <boxGeometry args={[0.24, 0.06, 0.06]} />
        <meshStandardMaterial color={CASING_DARK} />
      </mesh>
      <mesh castShadow position={[0.08, 0, 0]}>
        <boxGeometry args={[0.34, 0.16, 0.16]} />
        <meshStandardMaterial color="#E9EBED" />
      </mesh>
      <mesh position={[0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.08, 0.1, 16]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.2} />
      </mesh>
      <mesh position={[0.1, 0.12, 0.06]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial
          color="#B0BEC5"
          emissive="#B0BEC5"
          emissiveIntensity={streaming ? 1.6 : 0.2}
          toneMapped={false}
        />
      </mesh>
      <DeviceGlow type="cctv" active intensity={streaming ? 1.6 : 0.7} distance={2} />
    </group>
  );
}

function Microwave({ state }: { state: DeviceState }) {
  const active = isDeviceActive(state);
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.16, 0]}>
        <boxGeometry args={[0.6, 0.34, 0.4]} />
        <meshStandardMaterial color={CASING_DARK} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[-0.06, 0.16, 0.21]}>
        <planeGeometry args={[0.34, 0.24]} />
        <meshStandardMaterial
          color={active ? '#CE93D8' : '#20161f'}
          emissive={active ? '#CE93D8' : '#000'}
          emissiveIntensity={active ? 0.8 : 0}
        />
      </mesh>
      <DeviceGlow type="microwave" active={active} position={[0, 0.16, 0.25]} />
    </group>
  );
}

function EvseGlowOnly({ state }: { state: DeviceState }) {
  const active = isDeviceActive(state);
  return (
    <DeviceGlow
      type="evse"
      active={active}
      color={state.isTapering ? EVSE_TAPER_COLOR : GLOW_COLORS.evse}
      distance={2.6}
    />
  );
}

function DeviceModel({ state }: { state: DeviceState }) {
  switch (state.deviceType) {
    case 'refrigerator':
      return <Fridge state={state} />;
    case 'light':
      return <CeilingLight state={state} />;
    case 'dishwasher':
      return <UnderCounter state={state} round={false} />;
    case 'washing_machine':
      return <UnderCounter state={state} round />;
    case 'water_heater':
      return <WaterHeater state={state} />;
    case 'heat_pump':
      return <HeatPump state={state} />;
    case 'cctv':
      return <Cctv state={state} />;
    case 'microwave':
      return <Microwave state={state} />;
    case 'evse':
      return <EvseGlowOnly state={state} />;
    default:
      return null;
  }
}

/** Pulsing ring on the floor under a selected/hovered device. */
function SelectionRing({ groundY, tone }: { groundY: number; tone: string }) {
  const ref = useRef<Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    const k = 1 + Math.sin(s.clock.elapsedTime * 4) * 0.12;
    ref.current.scale.set(k, k, k);
  });
  return (
    <mesh ref={ref} position={[0, groundY + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.62, 40]} />
      <meshBasicMaterial color={tone} transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

function SelectableDevice({ placement, state }: { placement: DevicePlacement; state: DeviceState }) {
  const selected = useUiStore((s) => s.selectedDeviceId === placement.id);
  const hovered = useUiStore((s) => s.hoveredDeviceId === placement.id);
  const select = useUiStore((s) => s.select);
  const hover = useUiStore((s) => s.hover);

  const tone = GLOW_COLORS[placement.type];
  const groundY = -placement.position[1]; // world floor in local space
  const showRing = selected || hovered;
  // wall/roof-mounted devices read better without a floor ring
  const ringOk = placement.type !== 'cctv' && placement.type !== 'evse';

  return (
    <group
      position={placement.position}
      onPointerOver={(e) => {
        e.stopPropagation();
        hover(placement.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        hover(null);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        select(selected ? null : placement.id);
      }}
    >
      <DeviceModel state={state} />

      {ringOk && showRing && <SelectionRing groundY={groundY} tone={tone} />}

      {(hovered || selected) && (
        <Html position={[0, 0.9, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              font: '600 11px/1 system-ui, sans-serif',
              whiteSpace: 'nowrap',
              padding: '4px 8px',
              borderRadius: 6,
              color: '#fff',
              background: selected ? tone : 'rgba(18,22,32,0.82)',
              border: `1px solid ${tone}`,
              boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            }}
          >
            {placement.label}
            {isDeviceActive(state) ? ' · on' : ' · off'}
          </div>
        </Html>
      )}
    </group>
  );
}

export function DeviceLayer() {
  const devices = useTwinStore((s) => s.devices);
  return (
    <group>
      {DEVICE_PLACEMENTS.map((p) => {
        const state = devices[p.id];
        if (!state) return null;
        return <SelectableDevice key={p.id} placement={p} state={state} />;
      })}
    </group>
  );
}
