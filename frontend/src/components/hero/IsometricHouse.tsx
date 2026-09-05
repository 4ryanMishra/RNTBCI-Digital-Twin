// Isometric house + circuit panel — pure CSS/SVG, decorative
export default function IsometricHouse() {
  return (
    <div style={{ position: "relative", width: 420, height: 380 }}>
      <svg
        viewBox="0 0 420 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", filter: "drop-shadow(0 0 32px rgba(77,124,77,0.25))" }}
      >
        {/* --- Ground shadow --- */}
        <ellipse cx="210" cy="355" rx="140" ry="18" fill="rgba(0,0,0,0.25)" />

        {/* === House body (isometric box) === */}
        {/* Left face */}
        <polygon points="70,200 70,310 200,365 200,255" fill="#1d2a1d" />
        {/* Right face */}
        <polygon points="200,255 200,365 330,310 330,200" fill="#162216" />
        {/* Top face (roof base) */}
        <polygon points="70,200 200,145 330,200 200,255" fill="#243b24" />

        {/* === Roof === */}
        {/* Left roof slope */}
        <polygon points="70,200 200,100 200,145" fill="#2d4e2d" />
        {/* Right roof slope */}
        <polygon points="200,145 200,100 330,200" fill="#1e3c1e" />
        {/* Ridge */}
        <line x1="200" y1="100" x2="200" y2="145" stroke="#4d7c4d" strokeWidth="1.5" />

        {/* === Windows — left face === */}
        <rect x="100" y="225" width="35" height="30" rx="2" fill="#4fc3f7" opacity="0.35" />
        <rect x="145" y="225" width="35" height="30" rx="2" fill="#4fc3f7" opacity="0.35" />
        {/* window glow */}
        <rect x="100" y="225" width="35" height="30" rx="2" fill="url(#win-glow)" />
        <rect x="145" y="225" width="35" height="30" rx="2" fill="url(#win-glow)" />

        {/* === Door — left face === */}
        <rect x="157" y="280" width="28" height="40" rx="2" fill="#0f1a0f" />
        <circle cx="180" cy="302" r="2.5" fill="#6f9d6f" />

        {/* === Solar panel on roof === */}
        <polygon points="108,175 145,158 165,172 128,189" fill="#1565c0" opacity="0.8" />
        <line x1="126" y1="174" x2="145" y2="166" stroke="#42a5f5" strokeWidth="0.8" opacity="0.7" />
        <line x1="116" y1="180" x2="135" y2="172" stroke="#42a5f5" strokeWidth="0.8" opacity="0.7" />

        {/* === EV charger on right face === */}
        <rect x="255" y="255" width="18" height="28" rx="3" fill="#1a2a3a" />
        <rect x="258" y="258" width="12" height="8" rx="1" fill="#00bfff" opacity="0.6" />
        <line x1="264" y1="283" x2="264" y2="295" stroke="#00bfff" strokeWidth="2" opacity="0.7" />

        {/* === CCTV bracket on right face === */}
        <rect x="305" y="215" width="12" height="9" rx="1" fill="#455a64" />
        <polygon points="317,216 328,212 328,222 317,224" fill="#546e7a" />
        <circle cx="326" cy="217" r="2" fill="#ef5350" opacity="0.9" />

        {/* === Glowing power lines from panel === */}
        <path d="M 200 255 L 180 300" stroke="#4caf50" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        <path d="M 200 255 L 264 285" stroke="#4caf50" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />

        {/* === Circuit panel (right of house) === */}
        <rect x="345" y="190" width="56" height="80" rx="4" fill="#1d2232" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <rect x="350" y="196" width="46" height="14" rx="2" fill="#2d3a52" />
        {/* Breakers */}
        {[0,1,2,3].map(i => (
          <rect key={i} x="352" y={216 + i*14} width="40" height="10" rx="2" fill={i < 2 ? "rgba(76,175,80,0.4)" : "rgba(255,193,7,0.3)"} />
        ))}
        <text x="373" y="204" fill="#80cbc4" fontSize="6" textAnchor="middle" fontFamily="monospace">PANEL</text>

        {/* === Ambient lights === */}
        <circle cx="200" cy="180" r="80" fill="url(#ambient)" />

        <defs>
          <radialGradient id="win-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e1f5fe" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4fc3f7" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ambient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4d7c4d" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#4d7c4d" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* Floating stats */}
      <div style={{
        position: "absolute", top: 10, left: 0,
        display: "flex", flexDirection: "column", gap: "0.5rem",
      }}>
        {[
          { label: "Solar", val: "2.4 kW", color: "#42a5f5" },
          { label: "EVSE", val: "7.0 kW", color: "#00bfff" },
          { label: "Grid", val: "8.8 kW", color: "#4caf50" },
        ].map(s => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.25rem 0.6rem",
            background: "rgba(0,0,0,0.35)",
            borderRadius: "9999px",
            backdropFilter: "blur(8px)",
            border: `1px solid ${s.color}30`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
            <span style={{ fontSize: "0.65rem", color: "#b0bec5", letterSpacing: "0.05em" }}>{s.label}</span>
            <span style={{ fontSize: "0.7rem", color: s.color, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
