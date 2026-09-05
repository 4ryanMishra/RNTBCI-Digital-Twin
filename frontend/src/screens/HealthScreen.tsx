import { useEffect, useState } from "react";
import { getHealth } from "../api/client";
import type { HouseholdHealth, DeviceHealthItem } from "../types";
import { formatDuration, formatDateTime } from "../utils/formatters";

const HEALTH_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  healthy: { color: "#81c784", bg: "rgba(76,175,80,0.12)", border: "rgba(76,175,80,0.25)" },
  degraded: { color: "#ffd54f", bg: "rgba(255,193,7,0.12)", border: "rgba(255,193,7,0.25)" },
  fault:    { color: "#ef9a9a", bg: "rgba(244,67,54,0.12)", border: "rgba(244,67,54,0.25)" },
  offline:  { color: "#b0bec5", bg: "rgba(176,190,197,0.08)", border: "rgba(176,190,197,0.15)" },
};

const DEVICE_LABELS: Record<string, string> = {
  evse_01: "EV Charger", light_01: "Smart Light", dishwasher_01: "Dishwasher",
  washing_machine_01: "Washing Machine", water_heater_01: "Water Heater",
  heat_pump_01: "Heat Pump", cctv_01: "CCTV", microwave_01: "Microwave",
  refrigerator_01: "Refrigerator",
};

export default function HealthScreen() {
  const [health, setHealth] = useState<HouseholdHealth | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setHealth(await getHealth());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div style={{
      height: "100%", overflowY: "auto", padding: "1.5rem",
      display: "flex", flexDirection: "column", gap: "1.5rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", fontWeight: 700, color: "#f0ece4" }}>
            Device Health
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--stone-400)", marginTop: "0.2rem" }}>
            System-wide health rollup
          </p>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: "0.78rem" }} onClick={refresh} disabled={loading}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {!health ? (
        <div className="glass" style={{ padding: "2rem", textAlign: "center", color: "var(--stone-500)" }}>
          Loading health data…
        </div>
      ) : (
        <>
          {/* Rollup stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem" }}>
            {[
              { label: "Healthy", count: health.healthyCount, key: "healthy" },
              { label: "Degraded", count: health.degradedCount, key: "degraded" },
              { label: "Fault", count: health.faultCount, key: "fault" },
              { label: "Offline", count: health.offlineCount, key: "offline" },
            ].map(s => {
              const c = HEALTH_COLORS[s.key];
              return (
                <div key={s.key} className="glass" style={{
                  padding: "1.25rem", border: `1px solid ${c.border}`,
                  background: c.bg, textAlign: "center",
                }}>
                  <div style={{
                    fontSize: "2.2rem", fontWeight: 800,
                    fontFamily: "var(--font-mono)", color: c.color,
                    lineHeight: 1,
                  }}>
                    {s.count}
                  </div>
                  <div style={{
                    fontSize: "0.68rem", letterSpacing: "0.12em",
                    color: c.color, marginTop: "0.4rem", opacity: 0.8,
                  }}>
                    {s.label.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 1rem",
              background: HEALTH_COLORS[health.overall]?.bg ?? "rgba(255,255,255,0.05)",
              border: `1px solid ${HEALTH_COLORS[health.overall]?.border ?? "rgba(255,255,255,0.1)"}`,
              borderRadius: "0.5rem",
            }}>
              <span style={{ color: HEALTH_COLORS[health.overall]?.color, fontSize: "0.8rem", fontWeight: 600 }}>
                Overall: {health.overall.toUpperCase()}
              </span>
            </div>
            <span style={{ fontSize: "0.68rem", color: "var(--stone-500)", fontFamily: "var(--font-mono)" }}>
              as of {formatDateTime(health.timestamp)}
            </span>
          </div>

          {/* Per-device list */}
          <div className="glass" style={{ padding: "1.25rem", flex: 1 }}>
            <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)", marginBottom: "1rem" }}>
              DEVICES ({health.devices.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {health.devices.map((d: DeviceHealthItem) => {
                const c = HEALTH_COLORS[d.health] ?? HEALTH_COLORS.offline;
                return (
                  <div key={d.deviceId} style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    padding: "0.75rem 1rem",
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    borderRadius: "0.6rem",
                  }}>
                    {/* Health dot */}
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: c.color, flexShrink: 0,
                      boxShadow: `0 0 6px ${c.color}`,
                    }} />

                    {/* Name */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#e8e8ea" }}>
                        {DEVICE_LABELS[d.deviceId] ?? d.deviceId}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--stone-500)", marginTop: "0.1rem" }}>
                        {d.deviceId} · {d.deviceType}
                      </div>
                      {d.faultMessage && (
                        <div style={{ fontSize: "0.68rem", color: "#ef9a9a", marginTop: "0.2rem" }}>
                          {d.faultMessage}
                        </div>
                      )}
                    </div>

                    {/* State badge */}
                    <span style={{
                      fontSize: "0.65rem", padding: "0.2rem 0.5rem",
                      borderRadius: "9999px", background: c.bg, border: `1px solid ${c.border}`,
                      color: c.color, letterSpacing: "0.06em",
                    }}>
                      {d.operationalState}
                    </span>

                    {/* Health */}
                    <span style={{ color: c.color, fontSize: "0.75rem", fontWeight: 600, minWidth: 60, textAlign: "right" }}>
                      {d.health}
                    </span>

                    {/* Uptime */}
                    <div style={{
                      fontSize: "0.68rem", color: "var(--stone-500)",
                      fontFamily: "var(--font-mono)", minWidth: 60, textAlign: "right",
                    }}>
                      {formatDuration(d.uptimeSeconds)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
