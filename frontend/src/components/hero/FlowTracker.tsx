interface Props {
  completedSteps: number; // 0-4
}

const STEPS = [
  { num: "01", label: "Select Tier" },
  { num: "02", label: "View Devices" },
  { num: "03", label: "Monitor Power" },
  { num: "04", label: "Control & Export" },
];

export default function FlowTracker({ completedSteps }: Props) {
  return (
    <div style={{ display: "flex", gap: "0", position: "relative" }}>
      {STEPS.map((step, i) => {
        const done = i < completedSteps;
        const active = i === completedSteps;
        return (
          <div key={step.num} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "0.35rem", padding: "0 0.75rem",
              opacity: done || active ? 1 : 0.4,
              transition: "opacity 0.4s",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", fontWeight: 700,
                fontFamily: "var(--font-mono)",
                background: done
                  ? "var(--sage-500)"
                  : active
                    ? "rgba(77,124,77,0.25)"
                    : "rgba(255,255,255,0.06)",
                border: active
                  ? "1.5px solid var(--sage-400)"
                  : done
                    ? "1.5px solid var(--sage-500)"
                    : "1.5px solid rgba(255,255,255,0.12)",
                color: done ? "#fff" : active ? "var(--sage-300)" : "var(--stone-400)",
                boxShadow: done ? "0 0 12px rgba(77,124,77,0.5)" : "none",
              }}>
                {done ? "✓" : step.num}
              </div>
              <span style={{
                fontSize: "0.65rem", letterSpacing: "0.06em",
                color: done ? "var(--sage-300)" : active ? "#e8e8ea" : "var(--stone-500)",
                textTransform: "uppercase", textAlign: "center",
                whiteSpace: "nowrap",
              }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                height: 1, width: 24,
                background: i < completedSteps
                  ? "var(--sage-500)"
                  : "rgba(255,255,255,0.08)",
                transition: "background 0.4s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
