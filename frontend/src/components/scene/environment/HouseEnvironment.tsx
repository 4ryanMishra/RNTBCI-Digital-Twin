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
import type { LightingMode } from "./sceneViewStore";
import { stuccoTexture, terracottaTexture, gravelTexture, solarPanelTexture } from "./textures";

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

/**
 * SolarPanelArray — roof-mounted PV panels.
 *
 * Geometry notes:
 *  - House roof is a gable: ridge runs along X axis, pitched toward +Z and -Z.
 *  - Roof rise = ROOF_RISE (1.7 m), eave = EAVE (0.6 m)
 *  - House X: minX (-8) → maxX (6), centre cx = -1
 *  - Panels sit on the south-facing slope (+Z side of ridge) and are tilted to
 *    match the roof pitch angle: atan(ROOF_RISE / half_depth)
 *  - Array origin: slightly above the roof surface, centred on the south slope
 *  - Mounting rails are low-profile aluminium-grey bars at array edges
 *
 * Decision A: no emissive / alert-driven material here.
 *   The subtle specular glint on the panel material responds to the existing
 *   scene lights (meshPhysicalMaterial roughness/metalness) — it is NOT an
 *   emissive effect and does NOT react to alert state.
 *
 * The whole group is rendered only when roofVisible = true so the array hides
 * correctly in Dollhouse / Hide-roof view.
 */
function SolarPanelArray({ lightingMode }: { lightingMode: LightingMode }) {
  const tex = solarPanelTexture();

  // Roof geometry constants (must match Roof() above)
  const cx  = (H.minX + H.maxX) / 2;   // -1
  const cz  = (H.backZ + H.frontZ) / 2; // -0.5
  const halfDepth = (H.frontZ - H.backZ) / 2 + EAVE; // 3.5 + 0.6 = 4.1
  // Pitch angle of the south-facing slope (panels tilt inward to follow it)
  const pitchAngle = Math.atan2(ROOF_RISE, halfDepth); // ≈ 22.5°

  // Array dimensions on the slope surface
  const PANEL_W  = 1.0;   // width of one panel module (along X = ridge direction)
  const PANEL_H  = 1.6;   // height of one panel module (down the slope)
  const GAP      = 0.06;
  const COLS     = 5;
  const ROWS     = 2;
  const ARRAY_W  = COLS * (PANEL_W + GAP) - GAP;
  const ARRAY_H  = ROWS * (PANEL_H + GAP) - GAP;

  // South-slope origin in roof-local space (top of south slope at ridge)
  // In world space the ridge is at (cx, FLOOR_Y + H.wallH + ROOF_RISE, cz)
  const ridgeY  = FLOOR_Y + H.wallH + ROOF_RISE;
  // Place array 1/3 of the way down the south slope from the ridge
  const slopeFrac = 0.35;
  const slopeOffset = halfDepth * slopeFrac; // along Z (outward)
  const heightDrop  = ROOF_RISE  * slopeFrac; // Y drop from ridge

  // Array centre world position (before pitch rotation)
  const arrX  = cx;
  const arrY  = ridgeY - heightDrop + 0.06; // sit 6 cm above roof surface
  const arrZ  = cz + slopeOffset;

  // Daylight-reactive sheen: more metalness at midday, less at night/dark
  const metalness = lightingMode === "daylight" ? 0.45 : lightingMode === "night" ? 0.15 : 0.3;
  const roughness = lightingMode === "daylight" ? 0.25 : 0.45;

  return (
    <group
      position={[arrX, arrY, arrZ]}
      rotation={[-pitchAngle, 0, 0]}  // tilt to match south roof slope
    >
      {/* ── Panel modules ── */}
      {Array.from({ length: ROWS }).map((_, row) =>
        Array.from({ length: COLS }).map((_, col) => {
          const px = (col - (COLS - 1) / 2) * (PANEL_W + GAP);
          const py = -(row * (PANEL_H + GAP));
          return (
            <mesh
              key={`${row}-${col}`}
              position={[px, py, 0.01]}
              castShadow
              receiveShadow
            >
              <planeGeometry args={[PANEL_W, PANEL_H]} />
              {/* meshPhysicalMaterial: clearcoat gives the gloss without emissive */}
              <meshPhysicalMaterial
                map={tex}
                roughness={roughness}
                metalness={metalness}
                clearcoat={0.6}
                clearcoatRoughness={lightingMode === "daylight" ? 0.1 : 0.4}
                color="#0d1830"
              />
            </mesh>
          );
        })
      )}

      {/* ── Mounting rails (horizontal bars at top and bottom of array) ── */}
      {[PANEL_H * 0.1, -(ARRAY_H - PANEL_H * 0.1)].map((ry, i) => (
        <mesh key={`rail-h-${i}`} position={[0, ry, -0.015]} castShadow>
          <boxGeometry args={[ARRAY_W + 0.18, 0.045, 0.06]} />
          <meshStandardMaterial color="#8a9099" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* Vertical side rails */}
      {[-(ARRAY_W / 2 + 0.05), ARRAY_W / 2 + 0.05].map((rx, i) => (
        <mesh key={`rail-v-${i}`} position={[rx, -ARRAY_H / 2 + PANEL_H * 0.1, -0.015]} castShadow>
          <boxGeometry args={[0.045, ARRAY_H + 0.1, 0.06]} />
          <meshStandardMaterial color="#8a9099" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}

      {/* ── Mid-rail between rows ── */}
      <mesh position={[0, -(ROWS === 2 ? (PANEL_H + GAP / 2) : ARRAY_H / 2), -0.015]}>
        <boxGeometry args={[ARRAY_W + 0.18, 0.04, 0.06]} />
        <meshStandardMaterial color="#8a9099" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Nighttime() {
  return (
    <>
      <color attach="background" args={["#07080f"]} />
      {/* deep navy sky */}
      <ambientLight intensity={0.08} color="#1a2040" />
      <hemisphereLight color="#1e2a50" groundColor="#080808" intensity={0.5} />
      {/* cool moonlight from upper-right */}
      <directionalLight position={[-12, 18, 10]} intensity={0.45} color="#b0c4de" castShadow />
      {/* warm street-lamp glow near driveway */}
      <pointLight position={[0, 3.5, 10]} color="#ffcc66" intensity={2.0} distance={14} decay={2} />
      {/* interior warmth through windows */}
      <pointLight position={[-2, 1.5, -1]} color="#ffaa44" intensity={1.2} distance={6} decay={2} />
    </>
  );
}


export default function HouseEnvironment() {
  const roofVisible    = useSceneViewStore((s) => s.roofVisible);
  const lightingMode   = useSceneViewStore((s) => s.lightingMode) as LightingMode;
  const gravel = gravelTexture();

  // Windows are lit (warm glow) in night or dark mode; dark panes during daylight
  const litWindows = lightingMode !== "daylight";
  const wallMidY = FLOOR_Y + H.wallH / 2;

  return (
    <group>
      {lightingMode === "daylight" && <Daylight />}
      {lightingMode === "night"    && <Nighttime />}
      {/* dark mode: minimal warm fill so the house silhouette still reads */}
      {lightingMode === "dark" && (
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
      {/* Solar panel array — on the south-facing slope, hidden with roof */}
      {roofVisible && <SolarPanelArray lightingMode={lightingMode} />}

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
