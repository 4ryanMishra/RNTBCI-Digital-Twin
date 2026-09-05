import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLAT_COUNT = 10;
const SLAT_DELAY = 0.04; // 40ms stagger
const SLAT_DURATION = 0.5;

interface Props {
  onDone: () => void;
}

export default function IntroScreen({ onDone }: Props) {
  const [visible, setVisible] = useState(true);
  const done = useRef(false);

  function finish() {
    if (done.current) return;
    done.current = true;
    sessionStorage.setItem("intro_seen", "1");
    setTimeout(onDone, 60);
  }

  // Auto-finish after all slats open
  useEffect(() => {
    const totalMs = (SLAT_COUNT * SLAT_DELAY + SLAT_DURATION) * 1000 + 400;
    const t = setTimeout(finish, totalMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip on key/click
  useEffect(() => {
    function onKey() { setVisible(false); finish(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <div
          className="fixed inset-0 z-50 select-none cursor-pointer"
          onClick={() => { setVisible(false); finish(); }}
          aria-label="Skip intro"
        >
          {/* Base reveal bg — gradient behind the slats */}
          <div
            style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(160deg,#1b301b 0%,#0f1117 60%,#1c1917 100%)"
            }}
          />

          {/* Slats */}
          {Array.from({ length: SLAT_COUNT }).map((_, i) => (
            <motion.div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: `${(i / SLAT_COUNT) * 100}%`,
                width: `${100 / SLAT_COUNT}%`,
                height: "100%",
                background: "#0f1117",
                transformOrigin: "top center",
              }}
              initial={{ scaleY: 1 }}
              animate={{ scaleY: 0 }}
              transition={{
                delay: i * SLAT_DELAY,
                duration: SLAT_DURATION,
                ease: [0.4, 0, 0.2, 1],
              }}
            />
          ))}

          {/* Logo + tagline centred while loading */}
          <motion.div
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: "1rem", pointerEvents: "none",
              zIndex: 60,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div style={{
              fontSize: "2.8rem", fontFamily: "var(--font-serif)",
              fontWeight: 700, letterSpacing: "-0.02em",
            }}
              className="text-gradient-sage"
            >
              Nestive
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--stone-400)", letterSpacing: "0.15em" }}>
              HOME ENERGY TWIN
            </div>
          </motion.div>

          {/* Skip hint */}
          <div style={{
            position: "absolute", bottom: "2rem", left: 0, right: 0,
            textAlign: "center", fontSize: "0.72rem", color: "var(--stone-500)",
            zIndex: 70, letterSpacing: "0.12em",
          }}>
            CLICK OR PRESS ANY KEY TO SKIP
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
