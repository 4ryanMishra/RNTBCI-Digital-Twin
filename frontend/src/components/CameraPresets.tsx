/**
 * CameraPresets — quick jumps to useful viewpoints. Writes a target pose into
 * the camera store; <CameraRig> does the actual tween inside the Canvas.
 */
import { CAMERA_PRESETS, useCameraStore } from '../state/cameraStore';
import { useTwinStore } from '../state/twinStore';

const PRESETS: { key: keyof typeof CAMERA_PRESETS; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'overview', label: 'Overview' },
  { key: 'garage', label: 'Garage / EV' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'rear', label: 'Rear' },
  { key: 'dollhouse', label: 'Dollhouse' },
];

export function CameraPresets() {
  const goTo = useCameraStore((s) => s.goTo);
  const roofVisible = useTwinStore((s) => s.roofVisible);
  const toggleRoof = useTwinStore((s) => s.toggleRoof);
  const timeOfDay = useTwinStore((s) => s.timeOfDay);
  const setTimeOfDay = useTwinStore((s) => s.setTimeOfDay);

  return (
    <div className="camera-presets">
      <div className="cp-row">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              if (p.key === 'dollhouse' && roofVisible) toggleRoof();
              goTo(p.key);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="cp-row">
        <button type="button" onClick={toggleRoof}>
          {roofVisible ? 'Hide roof' : 'Show roof'}
        </button>
        <button
          type="button"
          onClick={() => setTimeOfDay(timeOfDay === 'day' ? 'night' : 'day')}
        >
          {timeOfDay === 'day' ? 'Night' : 'Day'}
        </button>
      </div>
    </div>
  );
}
