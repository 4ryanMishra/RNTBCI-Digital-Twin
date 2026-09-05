import { motion } from "framer-motion";
import IsometricHouse from "../components/hero/IsometricHouse";
import FlowTracker from "../components/hero/FlowTracker";
import { useWsStore } from "../stores/wsStore";

interface Props {
  onSetup: () => void;
}

export default function HeroScreen({ onSetup }: Props) {
  const setupComplete = useWsStore(s => s.setupComplete);
  const tier = useWsStore(s => s.tier);

  // Derive completed steps
  let completedSteps = 0;
  if (setupComplete) completedSteps = 1; // tier selected

  return (
    <div style={{
      height: "100%", width: "100%", overflow: "auto",
      background: "linear-gradient(160deg,#0e1a0e 0%,#0f1117 50%,#1c1917 100%)",
    }}>
      {/* Top nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem 2.5rem",
        background: "rgba(15,17,23,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          fontSize: "1.5rem", fontFamily: "var(--font-serif)",
          fontWeight: 700, letterSpacing: "-0.02em",
        }} className="text-gradient-sage">
          Nestive
        </div>
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          {["Dashboard", "Devices", "History", "Health"].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} style={{
              fontSize: "0.8rem", color: "var(--stone-400)",
              textDecoration: "none", letterSpacing: "0.06em",
              transition: "color 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#e8e8ea")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--stone-400)")}
            >
              {link.toUpperCase()}
            </a>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Social proof pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.3rem 0.75rem",
            background: "rgba(77,124,77,0.12)",
            border: "1px solid rgba(77,124,77,0.25)",
            borderRadius: "9999px",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4caf50", boxShadow: "0 0 8px #4caf50" }} />
            <span style={{ fontSize: "0.68rem", color: "#81c784", letterSpacing: "0.08em" }}>
              LIVE SIMULATION
            </span>
          </div>
          {/* Locale / menu hints */}
          <div style={{ fontSize: "0.75rem", color: "var(--stone-500)" }}>EN</div>
          <div style={{ fontSize: "0.75rem", color: "var(--stone-500)", cursor: "pointer" }}>☰</div>
        </div>
      </nav>

      {/* Hero section */}
      <div style={{
        display: "flex", alignItems: "center",
        minHeight: "calc(100vh - 60px)",
        padding: "4rem 2.5rem 2rem",
        gap: "4rem",
        maxWidth: 1280, margin: "0 auto",
      }}>
        {/* Left — copy */}
        <motion.div
          style={{ flex: "1 1 500px", maxWidth: 560 }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Social proof pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            padding: "0.35rem 0.9rem",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "9999px",
            marginBottom: "1.75rem",
          }}>
            <span style={{ fontSize: "0.7rem", color: "var(--stone-300)", letterSpacing: "0.10em" }}>
              ⚡ Physics-accurate household energy twin
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            color: "#f0ece4",
            marginBottom: "1.25rem",
          }}>
            Your home,
            <br />
            <span className="text-gradient-sage">intelligently</span>
            <br />
            managed.
          </h1>

          {/* Subhead */}
          <p style={{
            fontSize: "1.05rem",
            lineHeight: 1.65,
            color: "var(--stone-400)",
            marginBottom: "2.5rem",
            maxWidth: 440,
          }}>
            Monitor every watt in real time, visualise your 9-device ecosystem
            in 3D, and stay ahead of overloads — without a single auto-throttle.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <motion.button
              className="btn btn-primary"
              style={{ fontSize: "1rem", padding: "0.8rem 2rem", borderRadius: "0.6rem" }}
              onClick={onSetup}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              {setupComplete ? `Dashboard (${tier})` : "Connect Your Space"}
            </motion.button>
            {!setupComplete && (
              <span style={{ fontSize: "0.8rem", color: "var(--stone-500)" }}>
                Select your villa tier to begin
              </span>
            )}
          </div>

          {/* Flow tracker */}
          <div style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "0.68rem", color: "var(--stone-500)", letterSpacing: "0.12em", marginBottom: "1rem" }}>
              SETUP PROGRESS
            </div>
            <FlowTracker completedSteps={completedSteps} />
          </div>
        </motion.div>

        {/* Right — isometric house */}
        <motion.div
          style={{ flex: "1 1 400px", display: "flex", justifyContent: "center", alignItems: "center" }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <IsometricHouse />
        </motion.div>
      </div>
    </div>
  );
}
