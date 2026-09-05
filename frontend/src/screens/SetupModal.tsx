import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setupSystem } from "../api/client";
import type { Tier } from "../types";

const TIERS: { id: Tier; label: string; kva: string; amps: string; phase: string; desc: string }[] = [
  {
    id: "small",
    label: "Small",
    kva: "6 kVA",
    amps: "30 A",
    phase: "Single-phase",
    desc: "Compact villa — covers everyday appliances and a single EV charger.",
  },
  {
    id: "medium",
    label: "Medium",
    kva: "9.2 kVA",
    amps: "40 A",
    phase: "Single-phase",
    desc: "Mid-size home — comfortable headroom for EV + heat pump simultaneously.",
  },
  {
    id: "large",
    label: "Large",
    kva: "18.4 kVA",
    amps: "~26 A × 3",
    phase: "Three-phase",
    desc: "Large villa — full three-phase grid with max EV and HVAC capacity.",
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export default function SetupModal({ visible, onDone }: Props) {
  const [selected, setSelected] = useState<Tier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await setupSystem(selected);
      // WS will fire setup_complete → store updates → parent hides modal
      // But also call onDone as fallback if WS is slow
      setTimeout(onDone, 1200);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="glass-strong"
            style={{ width: "100%", maxWidth: 680, padding: "2.5rem", margin: "1rem" }}
          >
            {/* Header */}
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--sage-400)", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>
                SYSTEM CONFIGURATION REQUIRED
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 700, color: "#f0ece4" }}>
                Select Your Villa Tier
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--stone-400)", marginTop: "0.4rem" }}>
                This determines your contracted power budget. Choose the tier that matches your property's grid connection.
              </p>
            </div>

            {/* Tier cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1.75rem" }}>
              {TIERS.map((tier) => {
                const isSelected = selected === tier.id;
                return (
                  <motion.button
                    key={tier.id}
                    onClick={() => setSelected(tier.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      background: isSelected
                        ? "rgba(77,124,77,0.15)"
                        : "rgba(255,255,255,0.04)",
                      border: isSelected
                        ? "1.5px solid rgba(77,124,77,0.6)"
                        : "1.5px solid rgba(255,255,255,0.10)",
                      borderRadius: "0.75rem",
                      padding: "1.25rem",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      boxShadow: isSelected ? "0 0 24px rgba(77,124,77,0.25)" : "none",
                    }}
                  >
                    <div style={{
                      fontSize: "0.65rem", letterSpacing: "0.15em",
                      color: isSelected ? "var(--sage-400)" : "var(--stone-500)",
                      marginBottom: "0.5rem",
                    }}>
                      {tier.phase.toUpperCase()}
                    </div>
                    <div style={{
                      fontSize: "1.4rem", fontFamily: "var(--font-serif)",
                      fontWeight: 700,
                      color: isSelected ? "#d4edda" : "#e8e8ea",
                      marginBottom: "0.25rem",
                    }}>
                      {tier.label}
                    </div>
                    <div style={{
                      fontSize: "1.1rem", fontFamily: "var(--font-mono)",
                      color: isSelected ? "var(--sage-300)" : "var(--stone-300)",
                      fontWeight: 600, marginBottom: "0.25rem",
                    }}>
                      {tier.kva}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--stone-400)", marginBottom: "0.75rem" }}>
                      {tier.amps}
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--stone-500)", lineHeight: 1.55 }}>
                      {tier.desc}
                    </p>
                    {isSelected && (
                      <div style={{
                        marginTop: "0.75rem",
                        fontSize: "0.68rem",
                        color: "var(--sage-400)",
                        display: "flex", alignItems: "center", gap: "0.3rem",
                      }}>
                        ✓ Selected
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: "1rem", padding: "0.6rem 1rem",
                background: "rgba(244,67,54,0.12)",
                border: "1px solid rgba(244,67,54,0.3)",
                borderRadius: "0.5rem",
                fontSize: "0.8rem", color: "#ef9a9a",
              }}>
                {error}
              </div>
            )}

            {/* Footer */}
            <div style={{
              marginTop: "1.75rem", display: "flex",
              alignItems: "center", justifyContent: "space-between",
            }}>
              <p style={{ fontSize: "0.72rem", color: "var(--stone-600)" }}>
                This cannot be skipped. Configure before accessing the dashboard.
              </p>
              <motion.button
                className="btn btn-primary"
                style={{ minWidth: 140, fontSize: "0.875rem" }}
                onClick={handleConfirm}
                disabled={!selected || loading}
                whileHover={{ scale: selected && !loading ? 1.03 : 1 }}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" className="animate-spin-slow" />
                    </svg>
                    Configuring…
                  </span>
                ) : "Confirm Setup"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
