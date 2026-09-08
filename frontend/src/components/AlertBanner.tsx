/**
 * AlertBanner — minimal placeholder for Shruti's circuit-panel alert visual.
 *
 * Decision A: this banner is the ONLY thing that reacts to an overload. The
 * 3D device glows are wired to device state and do not change here. Keeping
 * this in the environment build lets Purva verify that on her own.
 */
import { useTwinStore } from '../state/twinStore';

export function AlertBanner() {
  const alert = useTwinStore((s) => s.alert);
  const clear = useTwinStore((s) => s.setAlert);
  if (!alert) return null;

  return (
    <div className={`alert-banner ${alert.severity}`} role="status">
      <span>
        {alert.severity === 'critical' ? '🔴' : '⚠️'} {alert.message}
      </span>
      <span className="alert-hint">
        Devices stay on — turn something off manually to reduce load.
      </span>
      <button type="button" onClick={() => clear(null)}>
        Dismiss
      </button>
    </div>
  );
}
