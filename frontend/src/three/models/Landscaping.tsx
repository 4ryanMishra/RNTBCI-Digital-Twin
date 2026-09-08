/**
 * Landscaping.tsx — Provençal planting: Mediterranean cypresses, an olive tree,
 * lavender rows, clipped bay trees in terracotta pots by the door, and a low
 * rendered-stone boundary wall with pillars and a gate opening.
 */
import { DRIVEWAY, HOUSE } from '../layout';
import { stoneTexture } from '../textures';

const BARK = '#6f5a41';
const CYPRESS = '#33482f';
const OLIVE = '#8a9a76';
const LAVENDER = '#8d7ab8';
const BOX = '#4a6b3d';

function Cypress({ position, h = 5.5 }: { position: [number, number, number]; h?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.6, 6]} />
        <meshStandardMaterial color={BARK} roughness={1} />
      </mesh>
      <mesh position={[0, h / 2 + 0.5, 0]} castShadow>
        <coneGeometry args={[0.55, h, 10]} />
        <meshStandardMaterial color={CYPRESS} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, h * 0.62, 0]}>
        <coneGeometry args={[0.42, h * 0.7, 9]} />
        <meshStandardMaterial color="#3d5636" flatShading roughness={1} />
      </mesh>
    </group>
  );
}

function OliveTree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} rotation={[0, 0, 0.08]} castShadow>
        <cylinderGeometry args={[0.22, 0.34, 1.8, 7]} />
        <meshStandardMaterial color={BARK} flatShading roughness={1} />
      </mesh>
      {[
        [0, 2.5, 0, 1.5],
        [0.9, 2.3, 0.4, 1.0],
        [-0.8, 2.4, -0.3, 1.1],
        [0.2, 3.1, -0.6, 0.9],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color={OLIVE} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function LavenderRow({
  position,
  count = 6,
  spacing = 0.8,
  axis = 'x',
}: {
  position: [number, number, number];
  count?: number;
  spacing?: number;
  axis?: 'x' | 'z';
}) {
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const off = (i - (count - 1) / 2) * spacing;
        const p: [number, number, number] = axis === 'x' ? [off, 0, 0] : [0, 0, off];
        return (
          <group key={i} position={p}>
            <mesh position={[0, 0.18, 0]}>
              <sphereGeometry args={[0.28, 8, 6]} />
              <meshStandardMaterial color={BOX} flatShading roughness={1} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <sphereGeometry args={[0.22, 8, 6]} />
              <meshStandardMaterial color={LAVENDER} flatShading roughness={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function PottedBay({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.2, 0.5, 12]} />
        <meshStandardMaterial color="#b0653f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        <meshStandardMaterial color={BARK} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.34, 10, 10]} />
        <meshStandardMaterial color={BOX} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

function BoundaryWall() {
  const stone = stoneTexture();
  const z = 19;
  // Wall segments with a gap for the gravel entrance and a gap for the path.
  const segments: [number, number][] = [
    [-14, -3.2], // left run
    [1.2, 3.0], // between path and drive
    [DRIVEWAY.centerX + 2.8, 14], // right run
  ];
  const pillarsX = [-14, -3.2, -1.4, 1.2, 3.0, DRIVEWAY.centerX + 2.8, 14];
  return (
    <group>
      {segments.map(([x0, x1], i) => (
        <mesh key={i} position={[(x0 + x1) / 2, 0.55, z]} castShadow receiveShadow>
          <boxGeometry args={[x1 - x0, 1.1, 0.4]} />
          <meshStandardMaterial map={stone} roughness={1} />
        </mesh>
      ))}
      {/* coping */}
      {segments.map(([x0, x1], i) => (
        <mesh key={`c${i}`} position={[(x0 + x1) / 2, 1.15, z]}>
          <boxGeometry args={[x1 - x0 + 0.1, 0.1, 0.5]} />
          <meshStandardMaterial color="#d8ccb0" />
        </mesh>
      ))}
      {pillarsX.map((x) => (
        <group key={x} position={[x, 0.8, z]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 1.6, 0.6]} />
            <meshStandardMaterial map={stone} roughness={1} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.72, 0.16, 0.72]} />
            <meshStandardMaterial color="#d8ccb0" />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.12, 10, 10]} />
            <meshStandardMaterial color="#c9bb9c" />
          </mesh>
        </group>
      ))}
      {/* iron pedestrian gate in the path opening */}
      <group position={[-1.1, 0.6, z]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[-0.5 + i * 0.2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 1.2, 6]} />
            <meshStandardMaterial color="#26211d" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[1.2, 0.05, 0.05]} />
          <meshStandardMaterial color="#26211d" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export function Landscaping() {
  return (
    <group>
      <BoundaryWall />

      {/* cypress sentinels */}
      <Cypress position={[-12, 0, 6]} h={6} />
      <Cypress position={[-12.8, 0, 9]} h={5} />
      <Cypress position={[12.5, 0, 2]} h={5.5} />
      <Cypress position={[13, 0, 16]} h={6.2} />
      <Cypress position={[-10.5, 0, -9]} h={5} />

      {/* olive trees */}
      <OliveTree position={[-9.5, 0, 12]} />
      <OliveTree position={[10.5, 0, -6]} />

      {/* lavender: along the front of the house + edging the forecourt */}
      <LavenderRow position={[-4.5, 0, HOUSE.frontZ + 1.6]} count={7} axis="x" />
      <LavenderRow position={[HOUSE.leftX - 1.4, 0, 0]} count={6} axis="z" />
      <LavenderRow position={[DRIVEWAY.centerX - 4.6, 0, 13]} count={5} axis="z" spacing={1.1} />

      {/* clipped bays flanking the door */}
      <PottedBay position={[-2.7, 0, HOUSE.frontZ + 0.9]} />
      <PottedBay position={[-0.1, 0, HOUSE.frontZ + 0.9]} />
    </group>
  );
}
