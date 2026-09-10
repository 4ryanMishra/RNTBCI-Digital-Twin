/**
 * HouseEnvironment — the French-home shell the digital twin sits inside.
 *
 * Purva's contribution (3D environment track). It wraps Shruti's device meshes:
 * the house is built with the FRONT WALL OPEN so the default camera looks
 * straight into the rooms, and everything is positioned around the device
 * coordinates already defined in SceneCanvas.
 *
 * Decision A: nothing here is emissive or reacts to alerts — only the device
 * meshes glow. Roof + daylight are view-only toggles (sceneViewStore).
 */
import { useMemo } from "react";

import { ExtrudeGeometry, Shape } from "three";
import { Sky } from "@react-three/drei";

import { useSceneViewStore } from "./sceneViewStore";
import { stuccoTexture, terracottaTexture, gravelTexture } from "./textures";

// ── layout (matches SceneCanvas DEVICE_POSITIONS; grid/floor at y = -0.5) ──
const FLOOR_Y = -0.5;
const H = {
  minX: -8,
  maxX: 6,
  backZ: -4,
  frontZ: 3, // front is OPEN — this is the opening line
  wallH: 3.4,
  wallT: 0.18,
};
const ROOF_RISE = 1.7;
const EAVE = 0.6;

const C = {
  stucco: "#b7ad97",
  trim: "#8a8270",
  shutter: "#4a5d54",
  door: "#2d4e2d",
  glass: "#1a2535",
  glassLit: "#b9d4e6",
  roofRidge: "#5c2c20",
  grass: "#243b24",
  grassEdge: "#1c2f1c",
  bark: "#5a4632",
  cypress: "#243d22",
  lavender: "#6a5f92",
};

function Wall({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  const map = stuccoTexture();
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial map={map} color={C.stucco} roughness={1} />
    </mesh>
  );
}

function Window({
  position,
  rotationY = 0,
  lit,
}: {
  position: [number, number, number];
  rotationY?: number;
  lit: boolean;
}) {
  const w = 0.95;
  const h = 1.35;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.18, h + 0.18, 0.1]} />
        <meshStandardMaterial color={C.trim} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color={lit ? C.glassLit : C.glass}
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.28), 0, -0.03]} castShadow>
          <boxGeometry args={[0.5, h + 0.1, 0.05]} />
          <meshStandardMaterial color={C.shutter} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, -h / 2 - 0.12, 0.05]} castShadow>
        <boxGeometry args={[w + 0.5, 0.1, 0.2]} />
        <meshStandardMaterial color={C.trim} />
      </mesh>
    </group>
  );
}

function Roof() {
  const tex = terracottaTexture();
  const geo = useMemo(() => {
    const depth = H.frontZ - H.backZ + EAVE * 2;
    const width = H.maxX - H.minX + EAVE * 2;
    const s = new Shape();
    s.moveTo(-depth / 2, 0);
    s.lineTo(depth / 2, 0);
    s.lineTo(0, ROOF_RISE);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    g.translate(width / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, []);
  const cx = (H.minX + H.maxX) / 2;
  const cz = (H.backZ + H.frontZ) / 2;
  return (
    <group position={[cx, FLOOR_Y + H.wallH, cz]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      <mesh position={[0, ROOF_RISE, 0]} castShadow>
        <boxGeometry args={[H.maxX - H.minX + EAVE * 2 + 0.1, 0.16, 0.28]} />
        <meshStandardMaterial color={C.roofRidge} roughness={0.9} />
      </mesh>
      <mesh position={[H.maxX - cx - 1.3, ROOF_RISE + 0.5, cz - H.frontZ + 1.2]} castShadow>
        <boxGeometry args={[0.7, 1.5, 0.7]} />
        <meshStandardMaterial color={C.trim} roughness={1} />
      </mesh>
    </group>
  );
}

function Cypress({ position, h = 4 }: { position: [number, number, number]; h?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, FLOOR_Y + 0.3, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 0.6, 6]} />
        <meshStandardMaterial color={C.bark} roughness={1} />
      </mesh>
      <mesh position={[0, FLOOR_Y + h / 2 + 0.5, 0]} castShadow>
        <coneGeometry args={[0.5, h, 9]} />
        <meshStandardMaterial color={C.cypress} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

function LavenderRow({
  position,
  count = 5,
  axis = "x",
}: {
  position: [number, number, number];
  count?: number;
  axis?: "x" | "z";
}) {
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const o = (i - (count - 1) / 2) * 0.7;
        const p: [number, number, number] = axis === "x" ? [o, 0, 0] : [0, 0, o];
        return (
          <group key={i} position={p}>
            <mesh position={[0, FLOOR_Y + 0.16, 0]}>
              <sphereGeometry args={[0.24, 7, 5]} />
              <meshStandardMaterial color="#33482f" flatShading roughness={1} />
            </mesh>
            <mesh position={[0, FLOOR_Y + 0.36, 0]}>
              <sphereGeometry args={[0.17, 7, 5]} />
              <meshStandardMaterial color={C.lavender} flatShading roughness={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Car() {
  const body = "#c9ccd2";
  const glass = "#11202b";
  return (
    <group position={[-0.3, FLOOR_Y, 9]}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.55, 4]} />
        <meshStandardMaterial color={body} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.86, 0.22, 3.9]} />
        <meshStandardMaterial color="#2f333a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.08, -0.15]} castShadow>
        <boxGeometry args={[1.55, 0.55, 2]} />
        <meshStandardMaterial color={body} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.09, -0.15]}>
        <boxGeometry args={[1.58, 0.38, 1.8]} />
        <meshStandardMaterial color={glass} metalness={0.2} roughness={0.1} />
      </mesh>
      {[
        [0.9, 1.35],
        [-0.9, 1.35],
        [0.9, -1.35],
        [-0.9, -1.35],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.34, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.33, 0.33, 0.22, 16]} />
          <meshStandardMaterial color="#15151a" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[-0.92, 0.55, 1.4]}>
        <boxGeometry args={[0.05, 0.18, 0.18]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Daylight() {
  return (
    <>
      <color attach="background" args={["#dbe8f2"]} />
      <Sky distance={450000} sunPosition={[28, 22, 24]} turbidity={6} rayleigh={1.6} />
      <ambientLight intensity={0.55} color="#fff3e2" />
      <hemisphereLight color="#e6efff" groundColor="#7a6a48" intensity={1.1} />
      <directionalLight position={[24, 24, 20]} intensity={3.4} color="#ffe9c8" castShadow />
    </>
  );
}

export default function HouseEnvironment() {
  const roofVisible = useSceneViewStore((s) => s.roofVisible);
  const daylight = useSceneViewStore((s) => s.daylight);
  const gravel = gravelTexture();
  const litWindows = !daylight;

  const wallMidY = FLOOR_Y + H.wallH / 2;

  return (
    <group>
      {daylight && <Daylight />}
      {/* warm accent + soft fill even in the dark scene, so the house reads */}
      {!daylight && (
        <>
          <directionalLight position={[6, 9, 14]} intensity={0.75} color="#ffdca8" />
          <hemisphereLight color="#3a4a63" groundColor="#141c14" intensity={0.35} />
        </>
      )}

      {/* ---------- ground ---------- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y - 0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={C.grass} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y - 0.01, 0]} receiveShadow>
        <planeGeometry args={[34, 30]} />
        <meshStandardMaterial color={C.grassEdge} roughness={1} />
      </mesh>

      {/* driveway / patio in front of the opening */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.005, 8]} receiveShadow>
        <planeGeometry args={[6, 12]} />
        <meshStandardMaterial map={gravel} color="#6b6660" roughness={1} />
      </mesh>

      {/* ---------- shell (front wall omitted) ---------- */}
      <Wall position={[0, wallMidY, H.backZ]} size={[H.maxX - H.minX, H.wallH, H.wallT]} />
      <Wall position={[H.minX, wallMidY, (H.backZ + H.frontZ) / 2]} size={[H.wallT, H.wallH, H.frontZ - H.backZ]} />
      <Wall position={[H.maxX, wallMidY, (H.backZ + H.frontZ) / 2]} size={[H.wallT, H.wallH, H.frontZ - H.backZ]} />
      {/* kitchen | utility partition */}
      <Wall position={[1, wallMidY, (H.backZ + -0.2) / 2 + -0.2]} size={[H.wallT, H.wallH, 3.6]} />
      {/* short living-room return */}
      <Wall position={[H.minX + 1.6, wallMidY, 0.3]} size={[3.2, H.wallH, H.wallT]} />

      {/* floor + first-floor band */}
      <mesh position={[(H.minX + H.maxX) / 2, FLOOR_Y + 0.03, (H.backZ + H.frontZ) / 2]} receiveShadow>
        <boxGeometry args={[H.maxX - H.minX, 0.12, H.frontZ - H.backZ]} />
        <meshStandardMaterial color="#8f8672" roughness={1} />
      </mesh>

      {/* quoins on the front corners */}
      {[H.minX, H.maxX].map((x) => (
        <mesh key={x} position={[x, wallMidY, H.frontZ - 0.1]} castShadow>
          <boxGeometry args={[0.34, H.wallH, 0.34]} />
          <meshStandardMaterial color={C.trim} roughness={1} />
        </mesh>
      ))}

      {/* ---------- windows ---------- */}
      <Window position={[-5, wallMidY + 0.3, H.backZ - 0.02]} lit={litWindows} />
      <Window position={[-1.5, wallMidY + 0.3, H.backZ - 0.02]} lit={litWindows} />
      <Window position={[4, wallMidY + 0.3, H.backZ - 0.02]} lit={litWindows} />
      <Window position={[H.minX - 0.02, wallMidY + 0.3, -1.8]} rotationY={Math.PI / 2} lit={litWindows} />
      <Window position={[H.maxX + 0.02, wallMidY + 0.3, -1.8]} rotationY={Math.PI / 2} lit={litWindows} />

      {/* side door on the left wall */}
      <mesh position={[H.minX - 0.02, FLOOR_Y + 1.05, 1.6]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[1.05, 2.1, 0.1]} />
        <meshStandardMaterial color={C.door} roughness={0.6} />
      </mesh>

      {/* ---------- roof ---------- */}
      {roofVisible && <Roof />}

      {/* ---------- exterior planting ---------- */}
      <Cypress position={[-10, 0, 4]} h={4.5} />
      <Cypress position={[-10.5, 0, 7.5]} h={3.6} />
      <Cypress position={[9, 0, 1]} h={4.2} />
      <Cypress position={[9.5, 0, 10]} h={4.8} />
      <LavenderRow position={[-4.5, 0, H.frontZ + 1]} count={6} axis="x" />
      <LavenderRow position={[H.maxX + 1.3, 0, -1]} count={4} axis="z" />

      <Car />

      {/* low kerb along the front of the plot */}
      <mesh position={[0, FLOOR_Y + 0.08, 14]}>
        <boxGeometry args={[30, 0.16, 0.3]} />
        <meshStandardMaterial color={C.trim} roughness={1} />
      </mesh>
    </group>
  );
}
