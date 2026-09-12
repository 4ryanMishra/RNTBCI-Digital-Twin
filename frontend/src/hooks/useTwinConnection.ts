/**
 * Boots the connection to the backend and funnels every WS event into the
 * twin store. App mounts this once. The 3D scene never touches it.
 */
import { useCallback, useEffect, useState } from 'react';

import { getAlerts, getHealth, getPowerSummary, setupSystem } from '../api/client';
import { WS_URL } from '../config';
import { useTwinStore } from '../state/twinStore';
import type { DeviceType, OperationalState } from '../types';

import { useWebSocket } from './useWebSocket';

const KVA_BY_TIER: Record<string, number> = { small: 6, medium: 9.2, large: 18.4 };

/** snake_case metadata from the mock server -> our camelCase DeviceState. */
function mapMetadata(meta: Record<string, unknown> | undefined) {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  if ('level' in meta) out.level = num(meta.level);
  if ('mode' in meta) out.mode = meta.mode;
  if ('target_temperature_celsius' in meta)
    out.targetTemperatureCelsius = num(meta.target_temperature_celsius);
  if ('state_of_charge_percent' in meta) out.socPercent = num(meta.state_of_charge_percent);
  if ('is_tapering' in meta) out.isTapering = Boolean(meta.is_tapering);
  if ('rated_power_watts' in meta) out.ratedPowerWatts = num(meta.rated_power_watts);
  if ('compressor_on' in meta) out.compressorOn = Boolean(meta.compressor_on);
  if ('streaming' in meta) out.streaming = Boolean(meta.streaming);
  if ('recording' in meta) out.recording = Boolean(meta.recording);
  if ('cook_time_seconds_remaining' in meta)
    out.cookTimeSecondsRemaining = num(meta.cook_time_seconds_remaining);
  if ('generation_watts' in meta) out.generationWatts = num(meta.generation_watts);
  return out;
}

/**
 * solar_panel_01 reports power draw as negative (device_registry.py:
 * "get_power_draw() returns negative — generation subtracts from draw").
 * Derive a friendly positive generationWatts for the UI from that sign.
 */
function solarPatch(deviceId: string, watts: number) {
  if (deviceId !== 'solar_panel_01') return {};
  return { generationWatts: Math.max(0, -watts) };
}

export interface TwinConnection {
  ready: boolean;
  setupComplete: boolean;
  error: string | null;
  runSetup: (tier: string) => Promise<void>;
}

export function useTwinConnection(): TwinConnection {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupComplete = useTwinStore((s) => s.setupComplete);
  const setSetup = useTwinStore((s) => s.setSetup);
  const setConnected = useTwinStore((s) => s.setConnected);
  const upsertDevice = useTwinStore((s) => s.upsertDevice);
  const setPower = useTwinStore((s) => s.setPower);
  const setAlert = useTwinStore((s) => s.setAlert);

  // Probe backend health + hydrate setup / device / alert state on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await getHealth();
        if (cancelled) return;
        if (health.setupComplete) {
          let liveStatus = 'ok';
          try {
            const sum = await getPowerSummary();
            if (cancelled) return;
            liveStatus = sum.budgetStatus;
            setSetup('unknown', sum.limitWatts);
            for (const dv of sum.perDevice) {
              upsertDevice({
                deviceId: dv.deviceId,
                deviceType: dv.deviceType,
                operationalState: dv.operationalState as OperationalState,
                powerWatts: dv.powerWatts,
                ...solarPatch(dv.deviceId, dv.powerWatts),
              });
            }
          } catch {
            if (!cancelled) setSetup('unknown', 9200);
          }
          // Only surface a historical alert if the household is still over budget.
          if (liveStatus !== 'ok') {
            try {
              const alerts = await getAlerts();
              if (!cancelled && alerts.length > 0) {
                const a = alerts[0];
                setAlert({
                  id: a.id,
                  severity: a.severity,
                  message: a.message,
                  totalDrawWatts: a.total_draw_watts,
                  limitWatts: a.limit_watts,
                  raisedAt: a.raised_at,
                });
              }
            } catch {
              /* alerts are best-effort on load */
            }
          }
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setError('Cannot reach backend at ' + WS_URL + '. Start mock_server.py.');
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSetup, upsertDevice, setAlert]);

  const runSetup = useCallback(
    async (tier: string) => {
      const res = await setupSystem(tier);
      setSetup(res.tier, (res.contractedPowerKva ?? KVA_BY_TIER[tier] ?? 9.2) * 1000);
    },
    [setSetup],
  );

  const handleMessage = useCallback(
    (msg: Record<string, unknown>) => {
      const event = msg.event as string | undefined;
      const data = (msg.data ?? {}) as Record<string, unknown>;
      const deviceId = msg.deviceId as string | undefined;

      switch (event) {
        case 'setup_complete': {
          const kva = (data.contractedPowerKva as number) ?? 9.2;
          setSetup((data.tier as string) ?? 'unknown', kva * 1000);
          break;
        }
        case 'state_change': {
          if (!deviceId) break;
          upsertDevice({
            deviceId,
            operationalState: (data.operationalState as OperationalState) ?? 'off',
            powerWatts: (data.powerWatts as number) ?? 0,
            ...mapMetadata(data.metadata as Record<string, unknown>),
          });
          break;
        }
        case 'duty_cycle_toggle': {
          if (!deviceId) break;
          upsertDevice({
            deviceId,
            compressorOn: Boolean(data.compressorOn),
            powerWatts: (data.powerWatts as number) ?? 0,
          });
          break;
        }
        case 'soc_taper_update': {
          if (!deviceId) break;
          upsertDevice({
            deviceId,
            socPercent: (data.socPercent as number) ?? undefined,
            powerWatts: (data.powerWatts as number) ?? undefined,
            isTapering: Boolean(data.enteredTaper),
          });
          break;
        }
        case 'power_reading': {
          const per = (data.perDevice as { deviceId: string; watts: number }[]) ?? [];
          setPower({
            totalDrawWatts: (data.totalDrawWatts as number) ?? 0,
            solarGenerationWatts: data.solarGenerationWatts as number | undefined,
            netDrawWatts: data.netDrawWatts as number | undefined,
            limitWatts: (data.limitWatts as number) ?? 0,
            status: (data.status as 'ok' | 'warning' | 'critical') ?? 'ok',
            perDevice: per,
          });
          for (const p of per) {
            upsertDevice({ deviceId: p.deviceId, powerWatts: p.watts, ...solarPatch(p.deviceId, p.watts) });
          }
          break;
        }
        case 'alert': {
          setAlert({
            id: String(data.id ?? Date.now()),
            severity: (data.severity as 'warning' | 'critical') ?? 'warning',
            message: (data.message as string) ?? 'Household load high',
            totalDrawWatts: (data.total_draw_watts as number) ?? 0,
            limitWatts: (data.limit_watts as number) ?? 0,
            raisedAt: (data.raised_at as string) ?? new Date().toISOString(),
          });
          break;
        }
        case 'device_added': {
          upsertDevice({
            deviceId: (data.deviceId as string) ?? 'unknown',
            deviceType: (data.deviceType as DeviceType) ?? 'light',
            operationalState: (data.operationalState as OperationalState) ?? 'off',
            powerWatts: (data.powerWatts as number) ?? 0,
          });
          break;
        }
        default:
          break; // keepalive / pong / setup_incomplete -> ignore
      }
    },
    [setAlert, setPower, setSetup, upsertDevice],
  );

  useWebSocket({
    url: WS_URL,
    enabled: ready && setupComplete,
    onMessage: handleMessage,
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false),
  });

  return { ready, setupComplete, error, runSetup };
}
