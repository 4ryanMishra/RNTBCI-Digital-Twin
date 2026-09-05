import { useWsStore } from "../../stores/wsStore";
import { ZONE_COLOR } from "../../utils/colors";
import { formatWatts } from "../../utils/formatters";

export default function CircuitPanelHUD() {
  const reading = useWsStore(s => s.latestPowerReading);
  const tier = useWsStore(s => s.tier);

  const total = reading?.totalDrawWatts ?? 0;
  const limit = reading?.limitWatts ?? 1;
  const pct = Math.min(100, (total / limit) * 100);
  const color = ZONE_COLOR(pct);

  // SVG arc parameters
  const R = 52;
  const cx = 70;
  const cy = 70;
  const startAngle = -220; // degrees
  const endAngle = 40;
  const totalArc = endAngle - startAngle; // 260°
  const fillAngle = (pct / 100) * totalArc;

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + R * Math.cos(rad),
      y: cy + R * Math.sin(rad),
    };
  }

  function arcPath(start: number, end: number) {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const large = Math.abs(end - start) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  return (
    <div
      className="glass"
      style={{
        width: 280,
        padding: "1.25rem 1rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--stone-400)" }}>
          CIRCUIT PANEL
        </span>
        {tier && (
          <span className="badge badge-gray" style={{ fontSize: "0.6rem" }}>
            {tier.toUpperCase()}
          </span>
        )}
      </div>

      {/* Arc gauge */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="140" height="100" viewBox="0 0 140 100">
          {/* Track */}
          <path
            d={arcPath(startAngle, endAngle)}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d={arcPath(startAngle, startAngle + fillAngle)}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            style={{ transition: "all 0.5s ease", filter: `drop-shadow(0 0 4px ${color})` }}
          />
          {/* Center text */}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#e8e8ea" fontSize="16" fontWeight="700" fontFamily="var(--font-mono)">
            {pct.toFixed(0)}%
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--stone-400)" fontSize="7.5" fontFamily="var(--font-sans)">
            {formatWatts(total)}
          </text>
          <text x={cx} y={cy + 22} textAnchor="middle" fill="var(--stone-500)" fontSize="6.5" fontFamily="var(--font-sans)">
            of {formatWatts(limit)}
          </text>
        </svg>
      </div>

      {/* Status badge */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span
          className={`badge ${pct < 80 ? "badge-green" : pct < 95 ? "badge-amber" : "badge-red"}`}
          style={{ fontSize: "0.65rem" }}
        >
          {pct < 80 ? "● NORMAL" : pct < 95 ? "⚠ WARNING" : "🔴 CRITICAL"}
        </span>
      </div>

      {/* Zone legend */}
      <div style={{
        display: "flex", justifyContent: "space-around",
        fontSize: "0.6rem", color: "var(--stone-500)",
        paddingTop: "0.25rem",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#4CAF50", fontWeight: 700, letterSpacing: "0.04em" }}>0–79%</div>
          <div>Normal</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#FFC107", fontWeight: 700, letterSpacing: "0.04em" }}>80–94%</div>
          <div>Warning</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#F44336", fontWeight: 700, letterSpacing: "0.04em" }}>95–100%</div>
          <div>Critical</div>
        </div>
      </div>

      {/* Per-device list */}
      {reading?.perDevice && reading.perDevice.length > 0 && (
        <div style={{
          display: "flex", flexDirection: "column", gap: "0.3rem",
          maxHeight: 180, overflowY: "auto",
          paddingTop: "0.5rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div style={{ fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--stone-500)", marginBottom: "0.15rem" }}>
            PER DEVICE
          </div>
          {reading.perDevice
            .slice()
            .sort((a, b) => b.watts - a.watts)
            .map(d => {
              const dPct = Math.min(100, (d.watts / limit) * 100);
              return (
                <div key={d.deviceId} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: "rgba(255,255,255,0.06)",
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${dPct}%`,
                      background: ZONE_COLOR(pct),
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: "0.58rem", color: "var(--stone-400)", minWidth: 42, fontFamily: "var(--font-mono)" }}>
                    {d.deviceId.split("_")[0]}
                  </span>
                  <span style={{ fontSize: "0.58rem", color: "#e8e8ea", fontFamily: "var(--font-mono)", minWidth: 38, textAlign: "right" }}>
                    {formatWatts(d.watts)}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
