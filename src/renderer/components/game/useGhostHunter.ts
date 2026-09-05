import { useMotionValue } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BASE_MAX_GHOSTS,
  GHOST_DIALOGUES,
  IDLE_ATTACK_THRESHOLD,
  PEAK_MAX_GHOSTS,
  SPOTLIGHT_RADIUS,
} from "./constants";
import { Ghost, GhostState, ScreenEdge } from "./types";

const INSIDE_OFFSET = 50;

const getEdgePosition = (
  edge: ScreenEdge,
  width: number,
  height: number,
) => {
  const margin = 50;
  const safeW = Math.max(100, width);
  const safeH = Math.max(100, height);

  switch (edge) {
    case "top":
      return {
        x: margin + Math.random() * Math.max(10, safeW - margin * 2),
        y: INSIDE_OFFSET,
      };
    case "bottom":
      return {
        x: margin + Math.random() * Math.max(10, safeW - margin * 2),
        y: Math.max(10, safeH - INSIDE_OFFSET - 40),
      };
    case "left":
      return {
        x: INSIDE_OFFSET,
        y: margin + Math.random() * Math.max(10, safeH - margin * 2),
      };
    case "right":
      return {
        x: Math.max(10, safeW - INSIDE_OFFSET - 40),
        y: margin + Math.random() * Math.max(10, safeH - margin * 2),
      };
  }
};

export const useGhostHunter = (options?: {
  isScanning?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isVisible, setIsVisible] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [isCombat, setIsCombat] = useState(true);
  const [corruptionLevel, setCorruptionLevel] = useState(0);
  const [ghostsKilled, setGhostsKilled] = useState(0);
  const [isHit, setIsHit] = useState(false);
  const [isGameActive, setIsGameActive] = useState(true);
  const attackCount = useRef(0);
  const lastMoveTime = useRef(0);
  const pendingImpacts = useRef<Set<number>>(new Set());
  const timeouts = useRef<number[]>([]);
  const dialogueInterval = useRef<number | null>(null);

  const getBounds = useCallback(() => {
    if (options?.containerRef?.current) {
      const rect = options.containerRef.current.getBoundingClientRect();
      return {
        width: rect.width || 800,
        height: rect.height || 600,
        left: rect.left,
        top: rect.top,
      };
    }
    return {
      width: typeof window !== "undefined" ? window.innerWidth * 0.7 : 800,
      height: typeof window !== "undefined" ? window.innerHeight : 600,
      left: 0,
      top: 0,
    };
  }, [options?.containerRef]);

  const clearAllTimeouts = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  }, []);

  useEffect(() => {
    lastMoveTime.current = Date.now();
    return () => {
      clearAllTimeouts();
      if (dialogueInterval.current) clearInterval(dialogueInterval.current);
    };
  }, [clearAllTimeouts]);

  const spawnGhost = useCallback(
    (edge?: ScreenEdge) => {
      const { width, height } = getBounds();
      const edges: ScreenEdge[] = ["top", "bottom", "left", "right"];
      const selectedEdge = edge || edges[Math.floor(Math.random() * 4)];
      const pos = getEdgePosition(selectedEdge, width, height);
      const id = Date.now() + Math.random();

      const newGhost: Ghost = {
        id,
        ...pos,
        edge: selectedEdge,
        state: "PROWLING",
        revealed: false,
      };

      setGhosts((prev) => [...prev, newGhost]);
      return id;
    },
    [getBounds],
  );

  // Spawn initial active ghosts immediately
  useEffect(() => {
    for (let i = 0; i < BASE_MAX_GHOSTS; i++) {
      spawnGhost();
    }
    return () => {
      setGhosts([]);
    };
  }, [spawnGhost]);

  // Track mouse movement strictly relative to container
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const bounds = getBounds();
      const relX = e.clientX - bounds.left;
      const relY = e.clientY - bounds.top;

      // Only visible if mouse is inside the right workspace container
      if (
        relX < 0 ||
        relX > bounds.width ||
        relY < 0 ||
        relY > bounds.height
      ) {
        setIsVisible(false);
        return;
      }

      mouseX.set(relX);
      mouseY.set(relY);
      setIsVisible(true);
      lastMoveTime.current = Date.now();

      setGhosts((prev) =>
        prev.map((g) => {
          const dx = relX - g.x;
          const dy = relY - g.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < SPOTLIGHT_RADIUS * SPOTLIGHT_RADIUS)
            return { ...g, revealed: true };
          return g;
        }),
      );
    };

    const handleMouseLeave = () => setIsVisible(false);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [mouseX, mouseY, getBounds]);

  // Prowl and lunging attack cycle bounded by container width & height
  useEffect(() => {
    const interval = setInterval(() => {
      const isIdle = Date.now() - lastMoveTime.current > IDLE_ATTACK_THRESHOLD;
      const { width, height } = getBounds();

      setGhosts((prev) =>
        prev.map((g) => {
          if (g.state === "DYING" || g.state === "LUNGING") return g;
          const chance = Math.random();

          if (isGameActive && (isIdle || chance < 0.12) && isVisible) {
            return {
              ...g,
              state: "LUNGING",
              targetX: mouseX.get(),
              targetY: mouseY.get(),
              dialogue: undefined,
            };
          }

          if (g.state === "PROWLING" && !isIdle) {
            const move = (Math.random() - 0.5) * 30;
            if (g.edge === "top" || g.edge === "bottom") {
              return {
                ...g,
                x: Math.max(40, Math.min(width - 40, g.x + move)),
              };
            } else {
              return {
                ...g,
                y: Math.max(40, Math.min(height - 40, g.y + move)),
              };
            }
          }
          return g;
        }),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [isVisible, isGameActive, mouseX, mouseY, getBounds]);

  const handleImpact = useCallback(() => {
    if (!isGameActive) return;
    attackCount.current += 1;
    setCorruptionLevel((c) => {
      const next = Math.min(c + 1, 20);
      if (next === 20) {
        setGhosts((prev) => {
          if (prev.length >= PEAK_MAX_GHOSTS) return prev;
          const { width, height } = getBounds();
          const reinforcements: Ghost[] = [];
          const edges: ScreenEdge[] = ["top", "bottom", "left", "right"];
          for (let i = prev.length; i < PEAK_MAX_GHOSTS; i++) {
            const edge = edges[i % 4];
            const pos = getEdgePosition(edge, width, height);
            reinforcements.push({
              id: Date.now() + Math.random() + i,
              ...pos,
              edge,
              state: "PROWLING" as GhostState,
              revealed: false,
            });
          }
          return [...prev, ...reinforcements];
        });
      }
      return next;
    });
    setIsHit(true);
    setTimeout(() => setIsHit(false), 200);
  }, [isGameActive, getBounds]);

  // Handle lunging impact
  useEffect(() => {
    ghosts.forEach((ghost) => {
      if (ghost.state === "LUNGING" && !pendingImpacts.current.has(ghost.id)) {
        pendingImpacts.current.add(ghost.id);
        setTimeout(() => {
          setGhosts((prev) => {
            const g = prev.find((p) => p.id === ghost.id);
            if (!g) {
              pendingImpacts.current.delete(ghost.id);
              return prev;
            }

            if (g.state === "LUNGING") {
              handleImpact();
            }
            pendingImpacts.current.delete(ghost.id);

            const { width, height } = getBounds();
            const pos = getEdgePosition(g.edge, width, height);
            return prev.map((p) =>
              p.id === ghost.id ? { ...p, ...pos, state: "PROWLING" } : p,
            );
          });
        }, 600);
      }
    });
  }, [ghosts, handleImpact, getBounds]);

  const killGhost = (id: number) => {
    let wasDying = false;
    setGhosts((prev) => {
      const ghost = prev.find((g) => g.id === id);
      if (!ghost || ghost.state === "DYING") {
        wasDying = true;
        return prev;
      }
      return prev.map((g) => (g.id === id ? { ...g, state: "DYING" } : g));
    });

    if (wasDying) return;

    setGhostsKilled((k) => k + 1);
    setCorruptionLevel((c) => Math.max(c - 5, 0));

    setTimeout(() => {
      setGhosts((prev) => {
        const remaining = prev.filter((g) => g.id !== id);
        if (remaining.length === 0) {
          // Respawn wave while scanning continues
          const { width, height } = getBounds();
          const edges: ScreenEdge[] = ["top", "bottom", "left", "right"];
          return Array.from({ length: BASE_MAX_GHOSTS }).map((_, i) => ({
            id: Date.now() + i,
            ...getEdgePosition(edges[i % 4], width, height),
            edge: edges[i % 4],
            state: "PROWLING" as GhostState,
            revealed: false,
          }));
        }
        return remaining;
      });
    }, 400);
  };

  // Dialogue bubble random trigger
  useEffect(() => {
    dialogueInterval.current = window.setInterval(() => {
      setGhosts((prev) => {
        const prowlers = prev.filter((g) => g.state === "PROWLING");
        if (prowlers.length === 0) return prev;

        const target = prowlers[Math.floor(Math.random() * prowlers.length)];
        const dialogue =
          GHOST_DIALOGUES[Math.floor(Math.random() * GHOST_DIALOGUES.length)];

        const updated = prev.map((g) =>
          g.id === target.id ? { ...g, dialogue } : g,
        );

        const timer = window.setTimeout(() => {
          setGhosts((current) =>
            current.map((g) =>
              g.id === target.id ? { ...g, dialogue: undefined } : g,
            ),
          );
        }, 3000);
        timeouts.current.push(timer);

        return updated;
      });
    }, 3500);

    return () => {
      if (dialogueInterval.current) clearInterval(dialogueInterval.current);
    };
  }, []);

  const giveUp = useCallback(() => {
    setGhosts([]);
    setIsCombat(false);
    setIsGameActive(false);
  }, []);

  return {
    mouseX,
    mouseY,
    isVisible,
    ghosts,
    isCombat,
    corruptionLevel,
    ghostsKilled,
    isHit,
    isGameActive,
    killGhost,
    giveUp,
  };
};
