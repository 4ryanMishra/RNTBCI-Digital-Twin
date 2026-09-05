import { AnimatePresence, motion } from "framer-motion";
import { useWsStore } from "../../stores/wsStore";
import { formatWatts } from "../../utils/formatters";

export default function AlertToast() {
  const alert = useWsStore(s => s.lastAlert);
  const dismiss = useWsStore(s => s.dismissAlert);

  const isCritical = alert?.alertType === "overload_trip";

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="glass"
          style={{
            position: "absolute",
            top: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 80,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "0.9rem 1.25rem",
            maxWidth: 420,
            width: "calc(100% - 2rem)",
            border: `1px solid ${isCritical ? "rgba(244,67,54,0.45)" : "rgba(255,193,7,0.4)"}`,
            boxShadow: isCritical
              ? "0 0 32px rgba(244,67,54,0.25)"
              : "0 0 24px rgba(255,193,7,0.20)",
          }}
        >
          {/* Icon */}
          <div style={{
            fontSize: "1.25rem",
            lineHeight: 1,
            paddingTop: "0.1rem",
            flexShrink: 0,
          }}>
            {isCritical ? "🔴" : "⚠️"}
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: isCritical ? "#ef9a9a" : "#ffd54f",
              letterSpacing: "0.04em",
              marginBottom: "0.2rem",
            }}>
              {isCritical ? "OVERLOAD CRITICAL" : "OVERLOAD WARNING"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#c8c8ca", lineHeight: 1.45 }}>
              {alert.message}
            </div>
            <div style={{
              fontSize: "0.7rem",
              color: "var(--stone-500)",
              marginTop: "0.3rem",
              fontFamily: "var(--font-mono)",
            }}>
              {formatWatts(alert.totalLoadWatts)} / {formatWatts(alert.limitWatts)}
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            style={{
              background: "none", border: "none",
              color: "var(--stone-500)", cursor: "pointer",
              fontSize: "1rem", lineHeight: 1, padding: "0.1rem",
              flexShrink: 0,
            }}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
