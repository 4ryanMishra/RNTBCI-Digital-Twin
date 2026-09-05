type Screen = "scene" | "history" | "ev" | "health";

interface Props {
  activeScreen: Screen;
  onNavigate: (s: Screen) => void;
  tier: string | null;
  connected: boolean;
}

const NAV_ITEMS: { id: Screen; label: string; icon: string }[] = [
  { id: "scene",   label: "3D Scene",  icon: "⬡" },
  { id: "history", label: "History",   icon: "📈" },
  { id: "ev",      label: "EV Session", icon: "🔌" },
  { id: "health",  label: "Health",    icon: "♥" },
];

export default function AppShell({
  activeScreen, onNavigate, tier, connected,
}: Props) {
  return (
    <div style={{
      width: 220, flexShrink: 0,
      height: "100%",
      background: "var(--bg-panel)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column",
      padding: "1.25rem 0",
    }}>
      {/* Logo */}
      <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{
          fontSize: "1.35rem", fontFamily: "var(--font-serif)",
          fontWeight: 700, letterSpacing: "-0.02em",
        }} className="text-gradient-sage">
          Nestive
        </div>
        <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: "var(--stone-500)", marginTop: "0.1rem" }}>
          DIGITAL TWIN
        </div>
      </div>

      {/* Tier info */}
      {tier && (
        <div style={{
          padding: "0.75rem 1.25rem",
          margin: "0.75rem 0.75rem 0",
          background: "rgba(77,124,77,0.08)",
          border: "1px solid rgba(77,124,77,0.2)",
          borderRadius: "0.5rem",
        }}>
          <div style={{ fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--sage-400)" }}>TIER</div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#d4edda", marginTop: "0.1rem" }}>
            {tier.toUpperCase()}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {NAV_ITEMS.map(item => {
          const active = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "none", cursor: "pointer",
                background: active ? "rgba(77,124,77,0.15)" : "transparent",
                color: active ? "#81c784" : "var(--stone-400)",
                fontSize: "0.82rem", fontWeight: active ? 600 : 400,
                fontFamily: "var(--font-sans)",
                textAlign: "left",
                width: "100%",
                transition: "all 0.15s",
                borderLeft: active ? "2px solid var(--sage-400)" : "2px solid transparent",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: "1rem" }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Connection status */}
      <div style={{
        padding: "0.75rem 1.25rem",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: connected ? "#4caf50" : "#ef5350",
          boxShadow: `0 0 6px ${connected ? "#4caf50" : "#ef5350"}`,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: "0.65rem", color: "var(--stone-500)", letterSpacing: "0.06em" }}>
          {connected ? "CONNECTED" : "RECONNECTING…"}
        </span>
      </div>
    </div>
  );
}
