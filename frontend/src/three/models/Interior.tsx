/**
 * Interior.tsx — simplified room layout, visible in the dollhouse view.
 *
 * Semi-transparent partition walls divide the shell into the five rooms a
 * typical French home has. Room labels + optional device-zone markers help
 * Shruti place her control models. Device coordinates are the single source
 * of truth in ../layout.ts (DEVICE_PLACEMENTS) — re-exported here for
 * backwards compatibility with anything importing from Interior.
 */
import { Html } from '@react-three/drei';

import { useTwinStore } from '../../state/twinStore';
import { DEVICE_PLACEMENTS, HOUSE } from '../layout';

export { DEVICE_PLACEMENTS, DEVICE_POSITIONS, DEVICE_PLACEMENT_BY_ID } from '../layout';

const PARTITION = '#D8CFBE';

interface RoomLabelProps {
  text: string;
  position: [number, number, number];
}
function RoomLabel({ text, position }: RoomLabelProps) {
  return (
    <Html
      position={position}
      center
      distanceFactor={18}
      style={{
        font: '600 13px/1 system-ui, sans-serif',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#5b5040',
        background: 'rgba(255,255,255,0.55)',
        padding: '2px 8px',
        borderRadius: 4,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </Html>
  );
}

function Partition({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={PARTITION} transparent opacity={0.34} />
    </mesh>
  );
}

export function Interior() {
  const roofVisible = useTwinStore((s) => s.roofVisible);
  const showZones = useTwinStore((s) => s.roofVisible === false); // zones only useful in dollhouse

  const t = HOUSE.wallThickness;
  const gh = HOUSE.floorHeight; // 3
  const uh = HOUSE.floorHeight; // upper storey height

  return (
    <group>
      {/* ---------- Ground floor partitions ---------- */}
      {/* living/kitchen block <-> utility, at x = 0 */}
      <Partition position={[0, gh / 2, 0]} size={[t, gh, HOUSE.depth - t]} />
      {/* utility <-> garage, at x = 3.5 */}
      <Partition position={[3.5, gh / 2, 0]} size={[t, gh, HOUSE.depth - t]} />
      {/* living (front) <-> kitchen (back), at z = 0 for x -7.5..0 */}
      <Partition position={[-3.75, gh / 2, 0]} size={[7.5, gh, t]} />

      {/* ---------- Upper floor partitions ---------- */}
      {/* bedroom (front) <-> bathroom/landing (back), at z = 0 */}
      <Partition position={[-2, gh + uh / 2, 0]} size={[11, uh, t]} />
      {/* bathroom divider at x = 1.5 (back half) */}
      <Partition position={[1.5, gh + uh / 2, -2.5]} size={[t, uh, 5]} />

      {/* ---------- Room labels (dollhouse view only, so they don't punch through
           the roof/walls from outside) ---------- */}
      {!roofVisible && (
        <>
          <RoomLabel text="Living room" position={[-3.8, 0.6, 2.4]} />
          <RoomLabel text="Kitchen" position={[-4, 0.6, -2.6]} />
          <RoomLabel text="Utility" position={[1.9, 0.6, -1]} />
          <RoomLabel text="Garage" position={[5.5, 0.6, -1]} />
          <RoomLabel text="Bedroom" position={[-3, gh + 0.5, 2.4]} />
          <RoomLabel text="Bathroom" position={[2.4, gh + 0.5, -2.6]} />
        </>
      )}

      {/* ---------- Device-zone markers (dollhouse only) ---------- */}
      {showZones && <ZoneMarkers />}
    </group>
  );
}

function ZoneMarkers() {
  return (
    <group>
      {DEVICE_PLACEMENTS.map((p) => (
        <mesh key={p.id} position={p.position}>
          <sphereGeometry args={[0.22, 10, 10]} />
          <meshBasicMaterial color="#FF00FF" wireframe />
        </mesh>
      ))}
    </group>
  );
}
