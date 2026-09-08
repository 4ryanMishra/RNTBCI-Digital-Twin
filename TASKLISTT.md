# Purva's Task List — 3D Environment & House Model

**Role**: 3D Environment Developer (Supporting)  
**Focus**: House, car, EV charger, scene lighting, camera controls  
**Timeline**: 4 weeks  
**Goal**: Make the digital twin look like a real French home

---

## Your Responsibilities

You own all **visual environment** aspects:
- House 3D model (exterior + interior)
- Car parked in driveway
- EV charger station (connected to car)
- Scene lighting (day/night, shadows)
- Camera controls (orbit, zoom)
- Ground, landscaping, sky

Shruti will handle **device controls** and **power monitoring**.

---

## Technical Stack

You'll use:
- **Three.js** (already installed)
- **React Three Fiber** (React + Three.js integration)
- **Blender** (for modeling, if needed)
- **GLTF/GLB** format (preferred for web)

**Already set up**:
```
frontend/
├── src/
│   ├── three/
│   │   ├── Scene.tsx       # Main 3D scene
│   │   ├── models/         # Your models here
│   │   └── components/     # Reusable 3D components
```

---

## Week 1: House Model

### Task 1.1: House Exterior
**File**: `src/three/models/House.tsx` (create)

**What to build**: French home exterior

**Requirements**:
- 2-story house
- Pitched roof (typical French style)
- Windows (at least 6-8 visible)
- Front door
- Garage door
- Realistic scale (15m × 10m footprint approx)

**Modeling options**:

**Option A: Build in Blender**
1. Model house in Blender
2. Export as GLTF/GLB
3. Load in Three.js:
```typescript
import { useGLTF } from '@react-three/drei';

function House() {
  const { scene } = useGLTF('/models/house.glb');
  return <primitive object={scene} />;
}
```

**Option B: Use free model**
- Download from Sketchfab, TurboSquid, or CGTrader
- Search: "French house" or "suburban house"
- License: CC0 or free for commercial use
- Format: GLTF/GLB preferred

**Option C: Build with primitives in Three.js**
```typescript
function House() {
  return (
    <group>
      {/* Walls */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[15, 4, 10]} />
        <meshStandardMaterial color="#E8D5C4" />
      </mesh>
      
      {/* Roof */}
      <mesh position={[0, 5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <coneGeometry args={[7.5, 3, 4]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      
      {/* Windows */}
      <mesh position={[5, 2, -5]}>
        <boxGeometry args={[1, 1.5, 0.1]} />
        <meshStandardMaterial color="#87CEEB" />
      </mesh>
      {/* Add 7 more windows... */}
    </group>
  );
}
```

**Performance target**: < 50k triangles total

**Success**: House renders in scene, looks like a home (not a box).

---

### Task 1.2: Interior Layout (Simplified)
**File**: `src/three/models/Interior.tsx` (create)

**What to build**: Room divisions visible from outside

**Approach**: Cutaway view or glass walls

**Rooms needed**:
- Kitchen (ground floor, back)
- Living room (ground floor, front)
- Bedroom (upper floor)
- Bathroom (upper floor)
- Garage (side)

**Option A: Cutaway** (remove one wall)
```typescript
// In House.tsx, don't render front wall
// Users can see inside
```

**Option B: Semi-transparent walls**
```typescript
<meshStandardMaterial 
  color="#E8D5C4" 
  transparent 
  opacity={0.3} 
/>
```

**Option C: Dollhouse view** (removable roof)
```typescript
// Add button to toggle roof visibility
const [roofVisible, setRoofVisible] = useState(true);
```

**Room markers**: Add floor textures or name labels
```typescript
<Text position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]}>
  Kitchen
</Text>
```

**Success**: Can identify which room is which from camera view.

---

### Task 1.3: Device Placement Zones
**File**: `src/three/models/Interior.tsx` (update)

**What to add**: Markers for where devices should go

**Device locations**:
1. **EVSE**: Garage wall or driveway post
2. **Light**: Ceiling in living room
3. **Dishwasher**: Kitchen counter area
4. **Washing Machine**: Laundry room (basement or utility)
5. **Water Heater**: Basement or utility closet
6. **Heat Pump**: Outside (back of house)
7. **CCTV**: Outside (corner of house, roof level)
8. **Microwave**: Kitchen counter
9. **Refrigerator**: Kitchen (against wall)

**Visual markers** (temporary, Shruti will replace with real models):
```typescript
// Example: Kitchen appliance zone
<mesh position={[3, 1, -2]}>
  <sphereGeometry args={[0.3]} />
  <meshBasicMaterial color="#FF00FF" wireframe />
</mesh>
<Text position={[3, 1.5, -2]}>Fridge</Text>
```

**Success**: Shruti can see where to place each device model.

---

## Week 2: Car + EV Charger

### Task 2.1: Car Model
**File**: `src/three/models/Car.tsx` (create)

**What to build**: Realistic car parked in driveway

**Requirements**:
- Modern sedan or hatchback (French style: Peugeot, Renault, Citroën)
- Positioned in driveway (in front of garage)
- Facing forward (away from house)
- Realistic scale (4.5m long × 1.8m wide)

**Modeling options**:

**Option A: Free model**
- Sketchfab: Search "car low poly"
- Poly Pizza: Free CC0 models
- License: CC0 or free commercial use

**Option B: Build in Blender**
1. Model simplified car (low poly)
2. Export as GLB
3. Load in Three.js

**Option C: Use primitives** (not recommended, looks bad)

**Position**:
```typescript
function Car() {
  const { scene } = useGLTF('/models/car.glb');
  return (
    <primitive 
      object={scene} 
      position={[10, 0, 5]}  // Driveway coordinates
      rotation={[0, -Math.PI / 2, 0]}  // Facing street
      scale={1.0}
    />
  );
}
```

**Color**: Neutral (silver, white, black)

**Success**: Car looks realistic, positioned correctly relative to house.

---

### Task 2.2: EV Charger Station
**File**: `src/three/models/EVCharger.tsx` (create)

**What to build**: Wall-mounted or standalone EV charger

**Type**: Level 2 charger (common in France)

**Position options**:
- **Option A**: Garage wall (inside or outside)
- **Option B**: Driveway post (standalone)

**Components**:
1. Charger box (rectangular, 0.5m × 0.3m × 0.1m)
2. Cable (coiled when off, extended to car when on)
3. Connector plug (at car charging port)

**Modeling**:
```typescript
function EVCharger({ cableConnected = false }) {
  return (
    <group position={[8, 1.5, 5]}>  // On garage wall
      {/* Charger box */}
      <mesh>
        <boxGeometry args={[0.5, 0.8, 0.15]} />
        <meshStandardMaterial color="#2C3E50" />
      </mesh>
      
      {/* Display screen */}
      <mesh position={[0, 0.2, 0.08]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshBasicMaterial color="#00FF00" />
      </mesh>
      
      {/* Cable */}
      {cableConnected ? (
        <CableTooCar start={[8, 1.5, 5]} end={[9.5, 0.8, 5]} />
      ) : (
        <CoiledCable />
      )}
    </group>
  );
}
```

**Cable animation**: Use `THREE.CatmullRomCurve3` for smooth cable curve

**Success**: Charger looks realistic, cable can connect to car.

---

### Task 2.3: Cable Connection Animation
**File**: `src/three/models/EVCharger.tsx` (update)

**What to add**: Animated cable when EVSE turns on

**States**:
1. **Off**: Cable coiled on charger
2. **On**: Cable extends to car charging port

**Implementation**:
```typescript
import { useSpring, animated } from '@react-spring/three';

function CableTooCar({ start, end, connected }) {
  const { progress } = useSpring({
    progress: connected ? 1 : 0,
    config: { duration: 1000 }
  });
  
  // Generate curve points
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(...start),
    new THREE.Vector3(start[0] + 0.5, start[1] - 0.5, start[2]),
    new THREE.Vector3(end[0], end[1], end[2])
  ]);
  
  return (
    <animated.mesh>
      <tubeGeometry args={[curve, 20, 0.02, 8]} />
      <meshStandardMaterial color="#000000" />
    </animated.mesh>
  );
}
```

**Trigger**: Shruti will pass `connected={evseOn}` prop from device state

**Success**: Cable extends smoothly when EVSE turns on, retracts when off.

---

### Task 2.4: Charging Indicator on Car
**File**: `src/three/models/Car.tsx` (update)

**What to add**: Visual indicator that car is charging

**Options**:
1. **Glow around charging port** (blue/green)
2. **Progress bar above car** (SOC percentage)
3. **Particle effect** (electricity sparkles)

**Example (glow)**:
```typescript
{isCharging && (
  <pointLight 
    position={[9.5, 0.8, 5]}  // Car charging port
    color="#00FF00"
    intensity={2}
    distance={1}
  />
)}
```

**Example (progress bar)**:
```typescript
import { Html } from '@react-three/drei';

{isCharging && (
  <Html position={[10, 2.5, 5]}>
    <div className="charging-indicator">
      <div className="progress-bar" style={{ width: `${socPct}%` }} />
      <span>{socPct.toFixed(0)}%</span>
    </div>
  </Html>
)}
```

**Success**: Can see that car is charging without reading UI text.

---

## Week 3: Scene Lighting + Camera

### Task 3.1: Lighting Setup
**File**: `src/three/Scene.tsx` (update)

**What to add**: Realistic lighting for day scene

**Lights needed**:
1. **Ambient light** (overall brightness)
2. **Directional light** (sun)
3. **Hemisphere light** (sky + ground)

**Implementation**:
```typescript
function SceneLights() {
  return (
    <>
      {/* Ambient - soft overall light */}
      <ambientLight intensity={0.4} />
      
      {/* Sun - main directional light */}
      <directionalLight
        position={[50, 50, 25]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      
      {/* Sky/ground hemisphere */}
      <hemisphereLight
        skyColor="#87CEEB"
        groundColor="#8B7355"
        intensity={0.5}
      />
    </>
  );
}
```

**Shadows**: Enable on all objects
```typescript
<mesh castShadow receiveShadow>
  ...
</mesh>
```

**Success**: Scene looks like daytime, objects cast shadows.

---

### Task 3.2: Camera Controls
**File**: `src/three/Scene.tsx` (update)

**What to add**: Orbit controls for user navigation

**Implementation**:
```typescript
import { OrbitControls } from '@react-three/drei';

function Scene() {
  return (
    <>
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={100}
        maxPolarAngle={Math.PI / 2}  // Don't go below ground
        target={[0, 2, 0]}  // Look at house center
      />
      <PerspectiveCamera 
        makeDefault 
        position={[30, 15, 30]}  // Initial view
        fov={50}
      />
      {/* Your scene objects */}
    </>
  );
}
```

**Controls**:
- **Left mouse drag**: Rotate around house
- **Right mouse drag**: Pan (move camera)
- **Scroll wheel**: Zoom in/out

**Success**: Can orbit around house, zoom to see details.

---

### Task 3.3: Camera Presets (Optional)
**File**: `src/components/CameraPresets.tsx` (create)

**What to add**: Buttons to jump to predefined views

**Presets**:
1. **Front view**: See house front + driveway
2. **Kitchen view**: Zoom to kitchen appliances
3. **Garage view**: See EVSE + car
4. **Overview**: Bird's eye view of entire scene

**Implementation**:
```typescript
import { useThree } from '@react-three/fiber';

function CameraPresets() {
  const { camera } = useThree();
  
  const moveTo = (position: [number, number, number], target: [number, number, number]) => {
    // Animate camera (use gsap or react-spring)
    gsap.to(camera.position, {
      x: position[0],
      y: position[1],
      z: position[2],
      duration: 1.5,
      ease: 'power2.inOut'
    });
  };
  
  return (
    <div className="camera-presets">
      <button onClick={() => moveTo([30, 10, 30], [0, 2, 0])}>
        Front View
      </button>
      <button onClick={() => moveTo([3, 5, -2], [3, 1, -2])}>
        Kitchen
      </button>
      {/* More presets... */}
    </div>
  );
}
```

**Success**: Clicking buttons smoothly moves camera to different angles.

---

### Task 3.4: Ground Plane + Landscaping
**File**: `src/three/models/Ground.tsx` (create)

**What to add**: Ground, grass, driveway

**Components**:
1. **Grass** (main ground plane)
2. **Driveway** (paved path from street to garage)
3. **Sidewalk** (optional)

**Implementation**:
```typescript
function Ground() {
  return (
    <group>
      {/* Grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#7CFC00" />
      </mesh>
      
      {/* Driveway (concrete) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, 0.01, 10]} receiveShadow>
        <planeGeometry args={[5, 15]} />
        <meshStandardMaterial color="#D3D3D3" />
      </mesh>
    </group>
  );
}
```

**Optional**: Add texture maps for realism
```typescript
import { useTexture } from '@react-three/drei';

const grassTexture = useTexture('/textures/grass.jpg');
<meshStandardMaterial map={grassTexture} />
```

**Success**: Ground looks realistic, driveway visible from street to garage.

---

## Week 4: Polish + Optimization

### Task 4.1: Sky
**File**: `src/three/Scene.tsx` (update)

**What to add**: Sky gradient or skybox

**Option A: Gradient (simple)**
```typescript
<color attach="background" args={['#87CEEB']} />
<fog attach="fog" args={['#87CEEB', 50, 150]} />
```

**Option B: Sky dome (better)**
```typescript
import { Sky } from '@react-three/drei';

<Sky 
  distance={450000}
  sunPosition={[50, 50, 25]}
  inclination={0.6}
  azimuth={0.25}
/>
```

**Success**: Scene has realistic sky, not just black background.

---

### Task 4.2: Trees / Landscaping (Optional)
**File**: `src/three/models/Landscaping.tsx` (create)

**What to add**: A few trees around house

**Keep it simple**: Low-poly trees (< 5k triangles each)

**Example**:
```typescript
function Tree({ position }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 2, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      
      {/* Foliage */}
      <mesh position={[0, 3, 0]}>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
    </group>
  );
}

// Add 2-3 trees
<Tree position={[-5, 0, -5]} />
<Tree position={[15, 0, 10]} />
```

**Success**: Scene looks less empty, more like a neighborhood.

---

### Task 4.3: Performance Optimization
**File**: All model files (update)

**What to optimize**:

1. **Use instances for repeated objects** (e.g., windows)
```typescript
import { Instances, Instance } from '@react-three/drei';

<Instances>
  <boxGeometry args={[1, 1.5, 0.1]} />
  <meshStandardMaterial color="#87CEEB" />
  <Instance position={[5, 2, -5]} />
  <Instance position={[7, 2, -5]} />
  {/* More windows... */}
</Instances>
```

2. **Use LOD (Level of Detail)** for complex models
```typescript
import { Lod } from '@react-three/drei';

<Lod distances={[0, 10, 20]}>
  <HighDetailModel />
  <MediumDetailModel />
  <LowDetailModel />
</Lod>
```

3. **Frustum culling** (automatic in Three.js, but verify)
4. **Texture compression** (use compressed formats: .ktx2, .basis)

**Target FPS**: 55-60 FPS on Shruti's machine

**Test**: Open DevTools → Performance → record 10 seconds → check FPS

**Success**: No frame drops during camera movement.

---

### Task 4.4: Mobile Responsiveness (Optional)
**File**: `src/three/Scene.tsx` (update)

**What to add**: Touch controls for mobile

**React Three Fiber** already supports touch:
- One finger: Rotate
- Two fingers: Zoom
- Three fingers: Pan

**Additional mobile optimizations**:
1. Lower shadow quality on mobile
```typescript
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

<directionalLight
  castShadow
  shadow-mapSize-width={isMobile ? 512 : 2048}
  shadow-mapSize-height={isMobile ? 512 : 2048}
/>
```

2. Reduce particle effects on mobile
3. Lower texture resolution

**Success**: Works smoothly on phone (if you have one to test).

---

## Integration with Shruti's Work

### Device Model Placement (Week 2-3)
Once you have interior layout:
1. Share device position coordinates with Shruti
2. She'll place device models at those positions
3. You provide `isOn` prop from her device state
4. She'll add glow effects to your models

**Example coordination**:
```typescript
// Your house model exports device positions
export const DEVICE_POSITIONS = {
  fridge: [3, 1, -2],
  light: [0, 4, 0],
  evse: [8, 1.5, 5],
  // ...
};

// Shruti uses these in her device renderer
import { DEVICE_POSITIONS } from './three/models/Interior';
```

---

## Testing Checklist

Before calling it "done", verify:

### Visual Quality:
- [ ] House looks realistic (not just gray boxes)
- [ ] Car looks like a real car
- [ ] EV charger recognizable
- [ ] Shadows render correctly
- [ ] Sky has color (not black)

### Functionality:
- [ ] Can orbit camera around house
- [ ] Can zoom in to see device details
- [ ] Can zoom out to see full property
- [ ] Cable connects to car when EVSE turns on
- [ ] Ground plane visible (not floating objects)

### Performance:
- [ ] 55-60 FPS sustained (check DevTools)
- [ ] No memory leaks (check Memory tab)
- [ ] Smooth camera animations

### Integration:
- [ ] Device positions shared with Shruti
- [ ] Cable animation syncs with Shruti's EVSE state
- [ ] Scene loads without errors

---

## Files You'll Create

By the end, you'll have:
```
src/three/
├── Scene.tsx              # Main 3D scene (Week 3)
├── models/
│   ├── House.tsx          # Week 1
│   ├── Interior.tsx       # Week 1
│   ├── Car.tsx            # Week 2
│   ├── EVCharger.tsx      # Week 2
│   ├── Ground.tsx         # Week 3
│   ├── Landscaping.tsx    # Week 4 (optional)
│   └── index.ts           # Exports
├── components/
│   └── CameraPresets.tsx  # Week 3 (optional)
└── assets/
    ├── models/            # GLB files
    └── textures/          # Texture images
```

---

## Resources

### Free 3D Models:
- **Sketchfab**: https://sketchfab.com (filter by "Downloadable")
- **Poly Pizza**: https://poly.pizza (CC0 models)
- **TurboSquid Free**: https://www.turbosquid.com/Search/3D-Models/free
- **Quaternius**: http://quaternius.com (low-poly models)

### Textures:
- **Poly Haven**: https://polyhaven.com/textures (free PBR)
- **Texture Haven**: https://texturehaven.com
- **CC0 Textures**: https://cc0textures.com

### Tools:
- **Blender**: https://www.blender.org (free 3D modeling)
- **Blender to GLTF**: Built-in export (File → Export → glTF 2.0)
- **GLTF Viewer**: https://gltf-viewer.donmccurdy.com (test models)

### Tutorials:
- **React Three Fiber**: https://docs.pmnd.rs/react-three-fiber
- **Three.js Journey**: https://threejs-journey.com (paid but excellent)
- **Blender fundamentals**: YouTube (Blender Guru channel)

---

## Common Issues + Solutions

### Model not loading:
- Check file path (should be in `/public/models/`)
- Verify GLTF format (not FBX or OBJ)
- Check browser console for 404 errors

### Shadows not showing:
- Enable `castShadow` on light
- Enable `castShadow` and `receiveShadow` on meshes
- Check `shadow-mapSize` is at least 1024

### Low FPS:
- Reduce polygon count (< 50k total)
- Use instances for repeated objects
- Lower shadow quality
- Reduce texture size (max 2048×2048)

### Camera goes through objects:
- Set `OrbitControls` `minDistance` to prevent zoom-in too close
- Set `maxPolarAngle` to prevent going below ground

---

## Success Metrics

### By End of Week 1:
- House model renders in scene
- Can identify rooms

### By End of Week 2:
- Car + EV charger visible
- Cable animation works

### By End of Week 3:
- Lighting looks realistic
- Camera controls smooth

### By End of Week 4:
- Scene looks professional
- Performance at 55+ FPS
- Ready for Shruti's device integration

---

## Questions?

Ask Shruti if:
- Need device state data (isOn, power level, etc.)
- Need help with React/TypeScript
- Want to coordinate camera angles

Ask backend dev if:
- Need 3D coordinate data from API
- Performance issues related to WebSocket traffic

Good luck! Focus on making it look like a real home — that's your main goal. 🏡🚗⚡
