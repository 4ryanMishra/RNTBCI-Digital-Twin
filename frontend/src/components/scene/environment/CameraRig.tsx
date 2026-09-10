/**
 * Tweens the camera + OrbitControls target toward a preset pose, then releases
 * control back to the user. Rendered inside the Canvas.
 */
import { useRef } from "react";

import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { useSceneViewStore } from "./sceneViewStore";

interface ControlsLike {
  target: Vector3;
  update: () => void;
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  const pose = useSceneViewStore((s) => s.cameraTarget);
  const clear = useSceneViewStore((s) => s.clearCameraTarget);

  const wantPos = useRef(new Vector3());
  const wantTgt = useRef(new Vector3());

  useFrame((_, dt) => {
    if (!pose) return;
    wantPos.current.set(...pose.position);
    wantTgt.current.set(...pose.target);

    const k = 1 - Math.pow(0.0016, dt);
    camera.position.lerp(wantPos.current, k);
    if (controls?.target) {
      controls.target.lerp(wantTgt.current, k);
      controls.update();
    } else {
      camera.lookAt(wantTgt.current);
    }

    const done =
      camera.position.distanceTo(wantPos.current) < 0.15 &&
      (!controls?.target || controls.target.distanceTo(wantTgt.current) < 0.15);
    if (done) clear();
  });

  return null;
}
