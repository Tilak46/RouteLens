import { AnimatePresence, motion, useTransform } from "framer-motion";
import { useEffect } from "react";
import CombatHUD from "./CombatHUD";
import GhostComponent from "./GhostComponent";
import { SPOTLIGHT_RADIUS } from "./constants";
import { useGhostHunter } from "./useGhostHunter";

interface GhostHunterProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
  isScanning?: boolean;
  scanningProjectName?: string;
  onDismiss?: () => void;
}

const GhostHunter = ({
  containerRef,
  isScanning,
  scanningProjectName,
  onDismiss,
}: GhostHunterProps) => {
  const {
    mouseX,
    mouseY,
    isVisible,
    ghosts,
    isCombat,
    corruptionLevel,
    ghostsKilled,
    isHit,
    killGhost,
    giveUp,
  } = useGhostHunter({ isScanning, containerRef });

  const spotlightBg = useTransform(
    [mouseX, mouseY],
    ([x, y]) =>
      `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at ${x}px ${y}px, transparent 0%, rgba(0,0,0,0.25) 100%)`,
  );

  // Scoped cursor hide style only inside #scan-game-container
  useEffect(() => {
    const styleId = "ghost-hunter-cursor-hide";
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        #scan-game-container,
        #scan-game-container * {
          cursor: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  // Global hit shake on impact
  useEffect(() => {
    const styleId = "ghost-hunter-hit-shake";
    if (isHit) {
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          @keyframes ghost-container-shake {
            0% { transform: translate(2px, 2px); }
            25% { transform: translate(-2px, -2px); }
            50% { transform: translate(-3px, 1px); }
            75% { transform: translate(2px, -1px); }
            100% { transform: translate(0, 0); }
          }
          .ghost-shake-active {
            animation: ghost-container-shake 0.18s ease-in-out both;
          }
        `;
        document.head.appendChild(style);
      }
      containerRef?.current?.classList.add("ghost-shake-active");
    } else {
      containerRef?.current?.classList.remove("ghost-shake-active");
    }

    return () => {
      document.getElementById(styleId)?.remove();
      containerRef?.current?.classList.remove("ghost-shake-active");
    };
  }, [isHit, containerRef]);

  const handleExit = () => {
    giveUp();
    if (onDismiss) onDismiss();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[200] overflow-hidden select-none">
      {/* Red Hit Flash Overlay */}
      <AnimatePresence>
        {isHit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-[9999] bg-rose-600/40 mix-blend-overlay"
          />
        )}
      </AnimatePresence>

      {/* Mouse Spotlight */}
      <motion.div
        style={{ background: spotlightBg }}
        animate={{ opacity: isVisible ? 1 : 0 }}
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
      />

      {/* Active Ghosts */}
      <AnimatePresence>
        {ghosts.map((ghost) => (
          <GhostComponent
            key={ghost.id}
            ghost={ghost}
            mouseX={mouseX}
            mouseY={mouseY}
            isCombat={isCombat}
            onKill={killGhost}
          />
        ))}
      </AnimatePresence>

      {/* Tactical Brackets around cursor in combat */}
      <AnimatePresence>
        {isCombat && isVisible && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              style={{
                x: mouseX as any,
                y: mouseY as any,
                translateX: -SPOTLIGHT_RADIUS - 10,
                translateY: -SPOTLIGHT_RADIUS - 10,
              }}
              className="absolute h-10 w-10 border-t border-l border-cyan-400"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              style={{
                x: mouseX as any,
                y: mouseY as any,
                translateX: SPOTLIGHT_RADIUS - 30,
                translateY: SPOTLIGHT_RADIUS - 30,
              }}
              className="absolute h-10 w-10 border-r border-b border-cyan-400"
            />
          </>
        )}
      </AnimatePresence>

      {/* Combat & Scanning HUD */}
      <CombatHUD
        isCombat={isCombat}
        ghostsKilled={ghostsKilled}
        isScanning={isScanning}
        scanningProjectName={scanningProjectName}
        onDismiss={handleExit}
      />
    </div>
  );
};

export default GhostHunter;
