/**
 * CameraRig — smoothly tweens the camera + OrbitControls target toward the
 * pose requested by a camera preset, then hands control back to the user.
 */
import { useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

import { useCameraStore } from '../state/cameraStore';

/** Just the bits of OrbitControls we touch. */
interface ControlsLike {
  target: Vector3;
  update: () => void;
}

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  const target = useCameraStore((s) => s.target);
  const setTarget = useCameraStore((s) => s.setTarget);

  const desiredPos = useRef(new Vector3());
  const desiredLook = useRef(new Vector3());

  useFrame((_, dt) => {
    if (!target) return;
    desiredPos.current.set(...target.position);
    desiredLook.current.set(...target.lookAt);

    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent ease
    camera.position.lerp(desiredPos.current, k);

    if (controls?.target) {
      controls.target.lerp(desiredLook.current, k);
      controls.update();
    } else {
      camera.lookAt(desiredLook.current);
    }

    const posClose = camera.position.distanceTo(desiredPos.current) < 0.15;
    const lookClose = !controls?.target || controls.target.distanceTo(desiredLook.current) < 0.15;
    if (posClose && lookClose) setTarget(null);
  });

  return null;
}
