/**
 * House.tsx — a Provençal / Lyon-suburb French home, built from primitives with
 * procedural textures (no GLB, instant load, ~9k triangles).
 *
 * Character details that make it read as French, not generic:
 *   • lime-stucco walls in warm cream, limestone quoins
 *   • low-pitch terracotta pantile roof with a génoise (corbelled tile courses)
 *     under the eaves
 *   • tall casement windows with louvered shutters, timber front door + transom
 *   • wrought-iron juliet balcony, geranium window boxes, a wall lantern
 *   • integrated garage on the right bay
 *
 * The roof is a separate group gated by `roofVisible` for the dollhouse view.
 */
import { useMemo } from 'react';

import { ExtrudeGeometry, Shape } from 'three';

import { useTwinStore } from '../../state/twinStore';
import { GARAGE, HOUSE, ROOF } from '../layout';
import { stoneTexture, stuccoTexture, terracottaTexture } from '../textures';

const COLORS = {
  plinth: '#b9a988',
  fascia: '#efe7d4',
  shutter: '#6f8a86', // soft Provence grey-green
  shutterEdge: '#5c746f',
  door: '#3f5c54', // deep green
  doorFrame: '#efe7d4',
  garage: '#c7c1b2',
  frame: '#f7f2e6',
  glassDay: '#a9c6d0',
  glassNight: '#ffdf9e',
  iron: '#26211d',
  chimney: '#a98b72',
  geranium: '#c8342f',
  leaf: '#4a6b3d',
} as const;

const WALL_TOP = HOUSE.floorHeight * HOUSE.floors; // 6
const RISE = HOUSE.roofRidgeHeight;
const EAVE_Z = HOUSE.depth / 2 + ROOF.eaveOverhangZ;

/* ------------------------------------------------------------------ window -- */

interface WindowProps {
  position: [number, number, number];
  facing: 'z' | 'x';
  lit: boolean;
  width?: number;
  height?: number;
  flowerBox?: boolean;
  juliet?: boolean;
}

function Shutter({ x, w, h }: { x: number; w: number; h: number }) {
  const slats = Math.max(4, Math.round(h / 0.22));
  return (
    <group position={[x, 0, -0.03]}>
      <mesh castShadow>
        <boxGeometry args={[w, h + 0.1, 0.04]} />
        <meshStandardMaterial color={COLORS.shutterEdge} />
      </mesh>
      {Array.from({ length: slats }).map((_, i) => (
        <mesh
          key={i}
          position={[0, h / 2 - 0.08 - i * ((h - 0.1) / (slats - 1)), 0.03]}
          rotation={[0.5, 0, 0]}
        >
          <boxGeometry args={[w - 0.08, (h - 0.1) / slats - 0.02, 0.02]} />
          <meshStandardMaterial color={COLORS.shutter} />
        </mesh>
      ))}
    </group>
  );
}

function Window({
  position,
  facing,
  lit,
  width = 1.0,
  height = 1.7,
  flowerBox = false,
  juliet = false,
}: WindowProps) {
  const rotY = facing === 'x' ? Math.PI / 2 : 0;
  const shutterW = width * 0.56;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* reveal / frame */}
      <mesh castShadow>
        <boxGeometry args={[width + 0.2, height + 0.24, 0.12]} />
        <meshStandardMaterial color={COLORS.frame} />
      </mesh>
      {/* glass */}
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={lit ? COLORS.glassNight : COLORS.glassDay}
          emissive={lit ? COLORS.glassNight : '#000'}
          emissiveIntensity={lit ? 1 : 0}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>
      {/* 6-light muntins */}
      {[-width / 4, width / 4].map((mx) => (
        <mesh key={mx} position={[mx, 0, 0.07]}>
          <boxGeometry args={[0.03, height, 0.02]} />
          <meshStandardMaterial color={COLORS.frame} />
        </mesh>
      ))}
      {[-height / 3, 0, height / 3].map((my) => (
        <mesh key={my} position={[0, my, 0.07]}>
          <boxGeometry args={[width, 0.03, 0.02]} />
          <meshStandardMaterial color={COLORS.frame} />
        </mesh>
      ))}
      {/* stone sill + lintel */}
      <mesh position={[0, -height / 2 - 0.16, 0.05]} castShadow>
        <boxGeometry args={[width + 0.5, 0.12, 0.26]} />
        <meshStandardMaterial color="#e3d8bf" />
      </mesh>
      <mesh position={[0, height / 2 + 0.16, 0.03]} castShadow>
        <boxGeometry args={[width + 0.5, 0.14, 0.16]} />
        <meshStandardMaterial color="#e3d8bf" />
      </mesh>
      {/* shutters, folded open flat to the wall */}
      <Shutter x={-(width / 2 + shutterW / 2 + 0.03)} w={shutterW} h={height} />
      <Shutter x={width / 2 + shutterW / 2 + 0.03} w={shutterW} h={height} />

      {juliet && (
        <group position={[0, -height / 2 + 0.1, 0.22]}>
          <mesh castShadow>
            <boxGeometry args={[width + 0.5, 0.05, 0.05]} />
            <meshStandardMaterial color={COLORS.iron} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[width + 0.5, 0.04, 0.04]} />
            <meshStandardMaterial color={COLORS.iron} metalness={0.6} roughness={0.4} />
          </mesh>
          {Array.from({ length: 9 }).map((_, i) => (
            <mesh key={i} position={[-(width + 0.4) / 2 + i * ((width + 0.4) / 8), 0.18, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
              <meshStandardMaterial color={COLORS.iron} metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}

      {flowerBox && (
        <group position={[0, -height / 2 - 0.12, 0.3]}>
          <mesh castShadow>
            <boxGeometry args={[width + 0.2, 0.22, 0.24]} />
            <meshStandardMaterial color="#8a5a3c" roughness={0.9} />
          </mesh>
          {Array.from({ length: 6 }).map((_, i) => (
            <group key={i} position={[-(width) / 2 + 0.12 + i * (width / 5), 0.2, 0]}>
              <mesh>
                <sphereGeometry args={[0.11, 8, 8]} />
                <meshStandardMaterial color={COLORS.leaf} flatShading />
              </mesh>
              <mesh position={[0, 0.08, 0]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color={COLORS.geranium} flatShading />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

/* -------------------------------------------------------------------- roof -- */

const ROOF_OVERHANG_X = ROOF.eaveOverhangX;

function useRoofGeometry() {
  return useMemo(() => {
    const s = new Shape();
    s.moveTo(-EAVE_Z, 0);
    s.lineTo(EAVE_Z, 0);
    s.lineTo(0, RISE);
    s.closePath();
    const geo = new ExtrudeGeometry(s, {
      depth: HOUSE.width + ROOF_OVERHANG_X * 2,
      bevelEnabled: false,
    });
    geo.rotateY(-Math.PI / 2);
    geo.translate(HOUSE.width / 2 + ROOF_OVERHANG_X, WALL_TOP, 0);
    geo.computeVertexNormals();
    return geo;
  }, []);
}

function Genoise() {
  // Two corbelled courses of half-round tiles under each long eave.
  const tiles = 40;
  const span = HOUSE.width + 0.6;
  return (
    <group>
      {[EAVE_Z - 0.05, -(EAVE_Z - 0.05)].map((z) => (
        <group key={z}>
          {[0, 1].map((row) => (
            <group key={row} position={[0, WALL_TOP - 0.12 - row * 0.16, z + (z > 0 ? 1 : -1) * row * 0.14]}>
              {Array.from({ length: tiles }).map((_, i) => (
                <mesh
                  key={i}
                  position={[-span / 2 + i * (span / (tiles - 1)), 0, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.07, 0.07, 0.34, 8, 1, false, 0, Math.PI]} />
                  <meshStandardMaterial color="#b0503a" />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function Roof() {
  const geometry = useRoofGeometry();
  const tile = terracottaTexture();
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial map={tile} roughness={0.95} />
      </mesh>
      <mesh position={[0, WALL_TOP + RISE, 0]} castShadow>
        <boxGeometry args={[HOUSE.width + ROOF_OVERHANG_X * 2 + 0.1, 0.18, 0.34]} />
        <meshStandardMaterial color="#8a3b2c" roughness={0.9} />
      </mesh>
      {/* chimney with clay pots */}
      <group position={[3.4, WALL_TOP + RISE + 0.1, -1.4]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 1.9, 0.8]} />
          <meshStandardMaterial color={COLORS.chimney} roughness={1} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[1.06, 0.16, 0.96]} />
          <meshStandardMaterial color="#7c6353" />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 1.28, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.14, 0.34, 10]} />
            <meshStandardMaterial color="#b0503a" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------- house -- */

export function House() {
  const roofVisible = useTwinStore((s) => s.roofVisible);
  const lit = useTwinStore((s) => s.timeOfDay === 'night');

  const stucco = stuccoTexture();
  const stone = stoneTexture();

  const frontUpperX = [-6, -3.4, -0.8, 1.9];
  const frontLowerX = [-6, -3.4];

  return (
    <group>
      {/* ---- Shell (perimeter walls + slabs) ---- */}
      {[HOUSE.frontZ, HOUSE.backZ].map((z) => (
        <mesh key={`w${z}`} position={[0, WALL_TOP / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[HOUSE.width, WALL_TOP, HOUSE.wallThickness]} />
          <meshStandardMaterial map={stucco} roughness={1} />
        </mesh>
      ))}
      {[HOUSE.leftX, HOUSE.rightX].map((x) => (
        <mesh key={`w${x}`} position={[x, WALL_TOP / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[HOUSE.wallThickness, WALL_TOP, HOUSE.depth]} />
          <meshStandardMaterial map={stucco} roughness={1} />
        </mesh>
      ))}
      {[0.02, HOUSE.floorHeight].map((y) => (
        <mesh key={`f${y}`} position={[0, y, 0]} receiveShadow>
          <boxGeometry args={[HOUSE.width, 0.16, HOUSE.depth]} />
          <meshStandardMaterial color={y > 0 ? '#cbbfa4' : '#c4b79b'} roughness={1} />
        </mesh>
      ))}

      {/* plinth */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[HOUSE.width + 0.35, 0.6, HOUSE.depth + 0.35]} />
        <meshStandardMaterial map={stone} roughness={1} />
      </mesh>

      {/* string course between storeys (front) */}
      <mesh position={[0, HOUSE.floorHeight, HOUSE.frontZ + 0.03]}>
        <boxGeometry args={[HOUSE.width + 0.06, 0.16, 0.12]} />
        <meshStandardMaterial color="#e3d8bf" />
      </mesh>

      {/* limestone quoins */}
      {[HOUSE.leftX, HOUSE.rightX].map((x) =>
        [HOUSE.frontZ, HOUSE.backZ].map((z) => (
          <mesh key={`${x}:${z}`} position={[x, WALL_TOP / 2, z]} castShadow>
            <boxGeometry args={[0.4, WALL_TOP, 0.4]} />
            <meshStandardMaterial map={stone} roughness={1} />
          </mesh>
        )),
      )}

      {/* ---- Front windows ---- */}
      {frontUpperX.map((x, i) => (
        <Window
          key={`fu${x}`}
          position={[x, 4.35, HOUSE.frontZ + 0.06]}
          facing="z"
          lit={lit}
          juliet={i === 1}
          flowerBox={i === 2}
        />
      ))}
      {frontLowerX.map((x) => (
        <Window key={`fl${x}`} position={[x, 1.7, HOUSE.frontZ + 0.06]} facing="z" lit={lit} />
      ))}

      {/* ---- Side + back windows ---- */}
      {[-2.5, 2.5].map((z) => (
        <Window key={`lu${z}`} position={[HOUSE.leftX - 0.06, 4.35, z]} facing="x" lit={lit} />
      ))}
      {[-2.5, 2.5].map((z) => (
        <Window key={`ll${z}`} position={[HOUSE.leftX - 0.06, 1.7, z]} facing="x" lit={lit} />
      ))}
      <Window position={[HOUSE.rightX + 0.06, 4.35, -2]} facing="x" lit={lit} />
      {[-5, -1.5, 5].map((x) => (
        <Window key={`bu${x}`} position={[x, 4.35, HOUSE.backZ - 0.06]} facing="z" lit={lit} />
      ))}
      {[-5, 5].map((x) => (
        <Window key={`bl${x}`} position={[x, 1.7, HOUSE.backZ - 0.06]} facing="z" lit={lit} />
      ))}

      {/* ---- Front door + surround ---- */}
      <group position={[-1.4, 0, HOUSE.frontZ + 0.04]}>
        {/* stone surround */}
        <mesh position={[0, 1.35, -0.02]} castShadow>
          <boxGeometry args={[1.7, 2.9, 0.14]} />
          <meshStandardMaterial color="#e3d8bf" />
        </mesh>
        {/* transom */}
        <mesh position={[0, 2.5, 0.02]}>
          <planeGeometry args={[1.2, 0.4]} />
          <meshStandardMaterial
            color={lit ? COLORS.glassNight : COLORS.glassDay}
            emissive={lit ? COLORS.glassNight : '#000'}
            emissiveIntensity={lit ? 0.8 : 0}
          />
        </mesh>
        {/* leaf */}
        <mesh position={[0, 1.1, 0.05]} castShadow>
          <boxGeometry args={[1.2, 2.2, 0.1]} />
          <meshStandardMaterial color={COLORS.door} roughness={0.5} />
        </mesh>
        {/* panels */}
        {[[-0.28, 1.55], [0.28, 1.55], [-0.28, 0.7], [0.28, 0.7]].map(([px, py], i) => (
          <mesh key={i} position={[px, py, 0.11]}>
            <boxGeometry args={[0.42, 0.62, 0.03]} />
            <meshStandardMaterial color="#35504a" />
          </mesh>
        ))}
        <mesh position={[0.42, 1.1, 0.12]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#b9962f" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* wall lantern */}
        <group position={[1.15, 2.0, 0.15]}>
          <mesh castShadow>
            <boxGeometry args={[0.14, 0.24, 0.14]} />
            <meshStandardMaterial color={COLORS.iron} metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial
              color="#ffd98a"
              emissive="#ffd98a"
              emissiveIntensity={lit ? 2 : 0.3}
              toneMapped={false}
            />
          </mesh>
          {lit && <pointLight position={[0, 0, 0.3]} color="#ffcf87" intensity={4} distance={5} decay={2} />}
        </group>
        {/* step */}
        <mesh position={[0, 0.06, 0.55]} receiveShadow>
          <boxGeometry args={[2, 0.12, 1]} />
          <meshStandardMaterial map={stone} />
        </mesh>
      </group>

      {/* ---- Garage door ---- */}
      <group position={[(GARAGE.minX + GARAGE.maxX) / 2, GARAGE.doorHeight / 2, HOUSE.frontZ + 0.05]}>
        <mesh castShadow>
          <boxGeometry args={[GARAGE.doorWidth, GARAGE.doorHeight, 0.1]} />
          <meshStandardMaterial color={COLORS.garage} metalness={0.2} roughness={0.7} />
        </mesh>
        {[-0.85, -0.3, 0.25, 0.8].map((y) => (
          <mesh key={y} position={[0, y, 0.06]}>
            <boxGeometry args={[GARAGE.doorWidth - 0.12, 0.035, 0.02]} />
            <meshStandardMaterial color="#a7a196" />
          </mesh>
        ))}
        <mesh position={[0, GARAGE.doorHeight / 2 + 0.18, 0]}>
          <boxGeometry args={[GARAGE.doorWidth + 0.6, 0.32, 0.2]} />
          <meshStandardMaterial color="#e3d8bf" />
        </mesh>
      </group>

      {/* ---- Roof ---- */}
      {roofVisible && (
        <>
          <Roof />
          <Genoise />
        </>
      )}
    </group>
  );
}
