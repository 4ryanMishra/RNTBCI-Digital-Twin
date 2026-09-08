/**
 * App — top-level shell for the RNTBCI digital-twin frontend.
 *
 * Ownership:
 *   • 3D environment (house, car, EV charger, lighting, camera) — Purva
 *   • device control cards, power gauge, circuit panel — Shruti (not here yet;
 *     the DevPanel + AlertBanner are throwaway stand-ins)
 */
import { AlertBanner } from './components/AlertBanner';
import { CameraPresets } from './components/CameraPresets';
import { DeviceCard } from './components/DeviceCard';
import { DeviceList } from './components/DeviceList';
import { SetupModal } from './components/SetupModal';
import { useTwinConnection } from './hooks/useTwinConnection';
import { useTwinStore } from './state/twinStore';
import { Scene } from './three/Scene';

export default function App() {
  const { ready, setupComplete, error, runSetup } = useTwinConnection();
  const connected = useTwinStore((s) => s.connected);
  const tier = useTwinStore((s) => s.tier);

  return (
    <div className="app">
      {setupComplete && (
        <>
          <Scene />
          <header className="topbar">
            <span className="brand">RNTBCI · Digital Twin</span>
            <span className="tier-badge">{tier ? `villa: ${tier}` : ''}</span>
            <span className={`ws-dot ${connected ? 'on' : 'off'}`} title={connected ? 'live' : 'offline'} />
          </header>
          <CameraPresets />
          <AlertBanner />
          <DeviceList />
          <DeviceCard />
        </>
      )}

      {ready && !setupComplete && <SetupModal onSelect={runSetup} error={error} />}

      {!ready && (
        <div className="modal-backdrop">
          <div className="modal">
            <h1>RNTBCI Digital Twin</h1>
            <p className="modal-sub">Connecting to backend…</p>
          </div>
        </div>
      )}
    </div>
  );
}
