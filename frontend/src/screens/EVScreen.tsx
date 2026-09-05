import { useEffect, useState } from "react";
import { getEvSession, getEvSessions } from "../api/client";
import { useWsStore } from "../stores/wsStore";
import type { EvSessionSnapshot, EvSessionRecord } from "../types";
import { formatWatts, formatDateTime } from "../utils/formatters";

export default function EVScreen() {
  const [session, setSession] = useState<EvSessionSnapshot | null>(null);
  const [sessions, setSessions] = useState<EvSessionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // React to soc_taper_update event
  const lastTaper = useWsStore(s => s.lastSocTaperUpdate);

  async function refresh() {
    setLoading(true);
    try {
      const [s, hist] = await Promise.all([getEvSession(), getEvSessions(20)]);
      setSession(s);
      setSessions(hist);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  // Refresh when taper update fires
  useEffect(() => {
    if (lastTaper) refresh();
  }, [lastTaper]);

  const soc = session?.socPercent ?? 0;
  const sockR = 54;
  const sockCircumference = 2 * Math.PI * sockR;
  const strokeDash = (soc / 100) * sockCircumference;

  return (
    <div style={{
      height: "100%", overflowY: "auto", padding: "1.5rem",
      display: "flex", flexDirection: "column", gap: "1.5rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", fontWeight: 700, color: "#f0ece4" }}>
            EV Charging
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--stone-400)", marginTop: "0.2rem" }}>
            Live session and charging history
          </p>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: "0.78rem" }} onClick={refresh} disabled={loading}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {/* Current session card */}
      {!session ? (
        <div className="glass" style={{ padding: "2rem", textAlign: "center", color: "var(--stone-500)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔌</div>
          No active charging session. Start the EVSE from the 3D scene.
        </div>
      ) : (
        <div className="glass" style={{ padding: "1.5rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          {/* SOC ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              {/* Track */}
              <circle cx="70" cy="70" r={sockR} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
              {/* SOC fill */}
              <circle
                cx="70" cy="70" r={sockR}
                fill="none"
                stroke={session.isTapering ? "#FFD700" : "#00BFFF"}
                strokeWidth="8"
                strokeDasharray={`${strokeDash} ${sockCircumference - strokeDash}`}
                strokeDashoffset={sockCircumference * 0.25}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s ease", filter: `drop-shadow(0 0 6px ${session.isTapering ? "#FFD700" : "#00BFFF"})` }}
              />
              <text x="70" y="64" textAnchor="middle" fill="#e8e8ea" fontSize="22" fontWeight="700" fontFamily="var(--font-mono)">
                {soc.toFixed(0)}%
              </text>
              <text x="70" y="80" textAnchor="middle" fill="var(--stone-400)" fontSize="9" fontFamily="var(--font-sans)">
                STATE OF CHARGE
              </text>
              {session.isTapering && (
                <text x="70" y="96" textAnchor="middle" fill="#FFD700" fontSize="8" fontFamily="var(--font-sans)">
                  TAPERING
                </text>
              )}
            </svg>
            {session.isTapering && (
              <span className="badge badge-amber">Taper Mode Active</span>
            )}
          </div>

          {/* Stats */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem", alignContent: "start" }}>
            {[
              { label: "State", value: session.operationalState, mono: false },
              { label: "Power Draw", value: formatWatts(session.powerWatts), mono: true },
              { label: "Energy Added", value: `${session.energyAddedKwh.toFixed(2)} kWh`, mono: true },
              { label: "Rated Power", value: formatWatts(session.ratedPowerWatts), mono: true },
              { label: "Min to Full", value: session.minutesToFull != null ? `${Math.ceil(session.minutesToFull)} min` : "—", mono: true },
              { label: "Taper Start", value: `${session.taperStartSocPercent}% SOC`, mono: true },
            ].map(row => (
              <div key={row.label}>
                <div style={{ fontSize: "0.62rem", letterSpacing: "0.1em", color: "var(--stone-500)", marginBottom: "0.2rem" }}>
                  {row.label.toUpperCase()}
                </div>
                <div style={{
                  fontSize: "0.9rem", fontWeight: 600,
                  fontFamily: row.mono ? "var(--font-mono)" : "var(--font-sans)",
                  color: "#e8e8ea",
                }}>
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session history */}
      <div className="glass" style={{ padding: "1.25rem", flex: 1 }}>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)", marginBottom: "1rem" }}>
          CHARGING HISTORY
        </div>
        {sessions.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--stone-500)", padding: "2rem 0" }}>
            No completed sessions yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Session", "Started", "Ended", "Start SOC", "End SOC", "Energy", "Peak Power", "Status"].map(h => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "var(--stone-500)", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.sessionId}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    }}>
                    <td style={{ padding: "0.5rem 0.75rem", color: "var(--stone-400)", fontFamily: "var(--font-mono)" }}>#{s.sessionId}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#e8e8ea", whiteSpace: "nowrap" }}>{formatDateTime(s.startedAt)}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "var(--stone-400)", whiteSpace: "nowrap" }}>{s.endedAt ? formatDateTime(s.endedAt) : "—"}</td>
                    <td style={{ padding: "0.5rem 0.75rem", fontFamily: "var(--font-mono)", color: "#e8e8ea" }}>{s.startSocPct.toFixed(1)}%</td>
                    <td style={{ padding: "0.5rem 0.75rem", fontFamily: "var(--font-mono)", color: "#e8e8ea" }}>{s.endSocPct.toFixed(1)}%</td>
                    <td style={{ padding: "0.5rem 0.75rem", fontFamily: "var(--font-mono)", color: "#e8e8ea" }}>{s.energyAddedKwh.toFixed(2)} kWh</td>
                    <td style={{ padding: "0.5rem 0.75rem", fontFamily: "var(--font-mono)", color: "#e8e8ea" }}>{formatWatts(s.peakPowerWatts)}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <span className={s.completed ? "badge badge-green" : "badge badge-amber"}>
                        {s.completed ? "Done" : "In Progress"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
