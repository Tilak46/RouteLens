import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface GamingHUDCursorProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

const GamingHUDCursor = ({ containerRef }: GamingHUDCursorProps) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig1 = { damping: 30, stiffness: 400, mass: 0.5 };
  const boxX1 = useSpring(mouseX, springConfig1);
  const boxY1 = useSpring(mouseY, springConfig1);

  const springConfig2 = { damping: 40, stiffness: 200, mass: 0.8 };
  const boxX2 = useSpring(mouseX, springConfig2);
  const boxY2 = useSpring(mouseY, springConfig2);

  const springConfig3 = { damping: 50, stiffness: 100, mass: 1.2 };
  const boxX3 = useSpring(mouseX, springConfig3);
  const boxY3 = useSpring(mouseY, springConfig3);

  const [isVisible, setIsVisible] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [rawCoords, setRawCoords] = useState({ x: 0, y: 0 });
  const [clicks, setClicks] = useState<number[]>([]);
  const timeoutRef = useRef<number | null>(null);

  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      let x = e.clientX;
      let y = e.clientY;

      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;

        // If outside the right workspace, hide gaming reticle
        if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
          setIsVisible(false);
          return;
        }
      }

      mouseX.set(x);
      mouseY.set(y);
      setRawCoords({ x, y });
      setIsVisible(true);
      setIsMoving(true);

      const dx = x - boxX1.get();
      const dy = y - boxY1.get();
      const d = Math.sqrt(dx * dx + dy * dy);
      setDistance(Math.min(d, 100));

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setIsMoving(false);
        setDistance(0);
      }, 150);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
      }
      setClicks((prev) => [...prev, Date.now()]);
      setTimeout(() => setClicks((prev) => prev.slice(1)), 600);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [mouseX, mouseY, boxX1, boxY1, containerRef]);

  const boxSize = 14 + ((distance * distance) / 10000) * 30;
  const rotate = useTransform(boxX1, (v) => v * 0.3);

  const ghostLayers = [
    { x: boxX1, y: boxY1, opacity: 1, scale: 1 },
    { x: boxX2, y: boxY2, opacity: 0.3, scale: 0.9 },
    { x: boxX3, y: boxY3, opacity: 0.1, scale: 0.8 },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-[1000] overflow-hidden"
        >
          <motion.div
            style={{
              x: boxX1,
              y: boxY1,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          >
            {[0, 120, 240].map((angle, i) => (
              <motion.div
                key={i}
                style={{
                  transformOrigin: "center center",
                  rotate: angle,
                }}
                className="absolute top-0 left-1/2 h-full w-px"
              >
                <div className="h-1 w-1 rounded-full bg-cyan-400 opacity-60 shadow-[0_0_5px_cyan]" />
              </motion.div>
            ))}
          </motion.div>

          {ghostLayers.map((layer, i) => (
            <motion.div
              key={i}
              style={{
                x: layer.x,
                y: layer.y,
                width: boxSize * layer.scale,
                height: boxSize * layer.scale,
                opacity: isVisible ? layer.opacity : 0,
              }}
              className="absolute flex items-center justify-center border-cyan-400/80 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              <div className="absolute inset-0 border border-cyan-400/40" />
              {i === 0 && isVisible && (
                <>
                  <div className="absolute top-0 left-0 h-2 w-2 border-t border-l border-cyan-300" />
                  <div className="absolute top-0 right-0 h-2 w-2 border-t border-r border-cyan-300" />
                  <div className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-cyan-300" />
                  <div className="absolute right-0 bottom-0 h-2 w-2 border-r border-b border-cyan-300" />
                </>
              )}
            </motion.div>
          ))}

          <motion.div
            style={{ x: boxX1, y: boxY1 }}
            animate={{ opacity: isVisible && isMoving ? 1 : 0 }}
            className="absolute flex flex-col items-start gap-1 font-mono text-[8px] leading-none tracking-widest text-cyan-300/70 uppercase translate-x-[30px] -translate-y-[30px] pointer-events-none"
          >
            <div className="flex gap-2">
              <span className="text-white/30">LOC_X</span>
              <span>{Math.round(rawCoords.x)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-white/30">LOC_Y</span>
              <span>{Math.round(rawCoords.y)}</span>
            </div>
            <div className="mt-1 animate-pulse text-[6px] text-cyan-400">
              [ TARGET_ENGAGED ]
            </div>
          </motion.div>

          <AnimatePresence>
            {clicks.map((id) => (
              <motion.div
                key={id}
                initial={{
                  x: mouseX.get(),
                  y: mouseY.get(),
                  scale: 0,
                  opacity: 1,
                }}
                animate={{ scale: 3, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400 opacity-60 pointer-events-none"
              />
            ))}
          </AnimatePresence>

          <motion.div
            style={{
              x: mouseX,
              y: mouseY,
            }}
            animate={{ opacity: isVisible ? 1 : 0, scale: isMoving ? 0.6 : 1 }}
            className="absolute h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_cyan] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GamingHUDCursor;
