/**
 * SetupModal — villa-tier selection. Per DEVICE_VISUALS_MAPPING.md the 3D
 * scene must not render until setup_complete, because there is no power limit
 * to compare against before then.
 */
import { useState } from 'react';

import { VILLA_TIERS } from '../config';

interface SetupModalProps {
  onSelect: (tier: string) => Promise<void>;
  error: string | null;
}

export function SetupModal({ onSelect, error }: SetupModalProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const choose = async (tier: string) => {
    setBusy(tier);
    setFailed(null);
    try {
      await onSelect(tier);
    } catch {
      setFailed('Setup call failed — is mock_server.py running on :8000?');
      setBusy(null);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h1>RNTBCI Digital Twin</h1>
        <p className="modal-sub">Select your villa configuration to begin.</p>

        <div className="tier-grid">
          {VILLA_TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tier-card"
              disabled={busy !== null}
              onClick={() => choose(t.id)}
            >
              <span className="tier-name">{t.label}</span>
              <span className="tier-detail">{t.detail}</span>
              {busy === t.id && <span className="tier-detail">Configuring…</span>}
            </button>
          ))}
        </div>

        {(failed ?? error) && <p className="modal-error">{failed ?? error}</p>}
      </div>
    </div>
  );
}
