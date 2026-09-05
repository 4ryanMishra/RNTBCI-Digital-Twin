import { useState, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useWsStore } from "./stores/wsStore";
import { getLocation } from "./api/client";

import IntroScreen from "./screens/IntroScreen";
import HeroScreen from "./screens/HeroScreen";
import SetupModal from "./screens/SetupModal";
import MainScene from "./screens/MainScene";
import HistoryScreen from "./screens/HistoryScreen";
import EVScreen from "./screens/EVScreen";
import HealthScreen from "./screens/HealthScreen";
import AppShell from "./components/layout/AppShell";

type AppView = "hero" | "app";
type Screen = "scene" | "history" | "ev" | "health";

export default function App() {
  // Start single multiplexed WS connection
  useWebSocket();

  const connected = useWsStore((s) => s.connected);
  const setupComplete = useWsStore((s) => s.setupComplete);
  const tier = useWsStore((s) => s.tier);

  // Check if intro was already seen in this session
  const [showIntro, setShowIntro] = useState<boolean>(
    !sessionStorage.getItem("intro_seen")
  );

  const [view, setView] = useState<AppView>("hero");
  const [activeScreen, setActiveScreen] = useState<Screen>("scene");
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

  // Check setup complete status via REST on boot as well
  useEffect(() => {
    getLocation()
      .then((loc) => {
        if (loc.setupComplete) {
          useWsStore.setState({
            setupComplete: true,
            tier: loc.tier,
            contractedPowerKva: loc.contractedPowerKva,
            currentRatingA: loc.currentRatingA,
          });
        }
      })
      .catch(console.error);
  }, []);

  // If setup is complete, default to the main app view
  useEffect(() => {
    if (setupComplete) {
      setShowSetupModal(false);
      setView("app");
    }
  }, [setupComplete]);

  // Handler to open setup modal from Hero CTA
  const handleOpenSetup = () => {
    if (setupComplete) {
      setView("app");
    } else {
      setShowSetupModal(true);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", display: "flex" }}>
      {/* 1. Cinematic Intro Screen (once per session, skippable) */}
      {showIntro && (
        <IntroScreen onDone={() => setShowIntro(false)} />
      )}

      {/* 2. Hero view (landing page before app entry) */}
      {view === "hero" && (
        <div style={{ width: "100%", height: "100%" }}>
          <HeroScreen onSetup={handleOpenSetup} />
        </div>
      )}

      {/* 3. Setup Modal (triggered by unconfigured state or CTA) */}
      <SetupModal
        visible={showSetupModal || (!setupComplete && view === "app")}
        onDone={() => {
          setShowSetupModal(false);
          setView("app");
        }}
      />

      {/* 4. Main App Shell & Screens (only after setup or navigating to app) */}
      {view === "app" && (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
          <AppShell
            activeScreen={activeScreen}
            onNavigate={setActiveScreen}
            tier={tier}
            connected={connected}
          />
          <main style={{ flex: 1, height: "100%", position: "relative", overflow: "hidden" }}>
            {activeScreen === "scene" && <MainScene />}
            {activeScreen === "history" && <HistoryScreen />}
            {activeScreen === "ev" && <EVScreen />}
            {activeScreen === "health" && <HealthScreen />}
          </main>
        </div>
      )}
    </div>
  );
}
