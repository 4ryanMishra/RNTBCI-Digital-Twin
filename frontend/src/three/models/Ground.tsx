/**
 * Ground.tsx — the plot: meadow grass, a raked-gravel forecourt (very French —
 * gravel, not a concrete slab), a stone path to the door, and the street.
 */
import { DoubleSide } from 'three';

import { DRIVEWAY, HOUSE, STREET_Z } from '../layout';
import { gravelTexture, stoneTexture } from '../textures';

export function Ground() {
  const gravel = gravelTexture();
  const stone = stoneTexture();

  return (
    <group>
      {/* meadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#7f8f52" roughness={1} />
      </mesh>
      {/* subtle darker grass patch around the house */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[40, 34]} />
        <meshStandardMaterial color="#77873f" roughness={1} />
      </mesh>

      {/* gravel forecourt: apron in front of the garage + car */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[DRIVEWAY.centerX - 0.5, 0.01, (DRIVEWAY.fromZ + DRIVEWAY.toZ) / 2]}
        receiveShadow
      >
        <planeGeometry args={[DRIVEWAY.width + 3, DRIVEWAY.toZ - DRIVEWAY.fromZ]} />
        <meshStandardMaterial map={gravel} roughness={1} />
      </mesh>
      {/* gravel edging stones */}
      {[DRIVEWAY.centerX - 4, DRIVEWAY.centerX + 3] .map((x) => (
        <mesh key={x} position={[x, 0.06, (DRIVEWAY.fromZ + DRIVEWAY.toZ) / 2]}>
          <boxGeometry args={[0.16, 0.12, DRIVEWAY.toZ - DRIVEWAY.fromZ]} />
          <meshStandardMaterial map={stone} />
        </mesh>
      ))}

      {/* stone path to the door */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0.06 * (i % 2 ? 1 : -1)]}
          position={[-1.4, 0.012, HOUSE.frontZ + 0.8 + i * 0.85]}
          receiveShadow
        >
          <planeGeometry args={[1.5, 0.7]} />
          <meshStandardMaterial color="#cabfa4" roughness={0.95} side={DoubleSide} />
        </mesh>
      ))}

      {/* street + kerb */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, STREET_Z + 3]} receiveShadow>
        <planeGeometry args={[160, 8]} />
        <meshStandardMaterial color="#3b3a3d" roughness={1} />
      </mesh>
      <mesh position={[0, 0.08, STREET_Z - 0.6]}>
        <boxGeometry args={[160, 0.16, 0.26]} />
        <meshStandardMaterial map={stone} />
      </mesh>
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-75 + i * 10, 0.009, STREET_Z + 3]}
        >
          <planeGeometry args={[3, 0.16]} />
          <meshStandardMaterial color="#c9b878" />
        </mesh>
      ))}
    </group>
  );
}
