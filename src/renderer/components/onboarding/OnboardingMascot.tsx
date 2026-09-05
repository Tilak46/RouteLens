import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type MascotPhase = "wave" | "wonder" | "scan" | "cheer";

interface OnboardingMascotProps {
  className?: string;
  onExploreClick?: () => void;
  isDragging?: boolean;
}

const EASTER_EGG_QUOTES = [
  {
    icon: "🚀",
    title: "Ready to launch!",
    sub: "Point me to your backend codebase below!",
  },
  {
    icon: "🥐",
    title: "Fresh APIs daily!",
    sub: "I eat Express, Fastify & Next.js routes for breakfast!",
  },
  {
    icon: "⚡",
    title: "Speed of light!",
    sub: "AST deep-parsing discovers routes in milliseconds!",
  },
  {
    icon: "🎸",
    title: "Rock & Roll!",
    sub: "Say goodbye to outdated Postman collections forever!",
  },
  {
    icon: "🎯",
    title: "Zero setup required!",
    sub: "Just drop your folder and watch your APIs map out!",
  },
];

export const OnboardingMascot: React.FC<OnboardingMascotProps> = ({
  className,
  isDragging = false,
}) => {
  const [phase, setPhase] = useState<MascotPhase>("wave");
  const [, setIsHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Auto-cycle through the 3 storytelling phases every 4.5 seconds
  useEffect(() => {
    if (phase === "cheer") {
      const cheerTimer = setTimeout(() => setPhase("scan"), 3800);
      return () => clearTimeout(cheerTimer);
    }

    const interval = setInterval(() => {
      setPhase((current) => {
        if (current === "wave") return "wonder";
        if (current === "wonder") return "scan";
        return "wave";
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [phase]);

  const handleMascotClick = () => {
    setClickCount((c) => c + 1);
    setPhase("cheer");
  };

  return (
    <div className={cn("relative flex flex-col items-center select-none", className)}>
      {/* Ambient Radial Lighting Aura */}
      <div
        className={cn(
          "absolute top-8 w-64 h-64 rounded-full blur-3xl pointer-events-none -z-10 transition-all duration-700",
          isDragging && "bg-cyan-500/35 scale-125",
          !isDragging && phase === "wave" && "bg-blue-500/20",
          !isDragging && phase === "wonder" && "bg-purple-500/20",
          !isDragging && phase === "scan" && "bg-cyan-500/25",
          !isDragging && phase === "cheer" && "bg-amber-500/30"
        )}
      />

      {/* Floating Story Speech / Thought Cloud Bubble */}
      <div className="h-18 flex items-end justify-center mb-1 z-20">
        <AnimatePresence mode="wait">
          {isDragging && (
            <motion.div
              key="bubble-drag"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1.05 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative px-4 py-2.5 rounded-2xl bg-card/95 border-2 border-cyan-400 backdrop-blur-md shadow-[0_12px_36px_rgba(6,182,212,0.35)] text-center flex items-center gap-3"
            >
              <span className="text-2xl animate-bounce">🤩</span>
              <div className="text-left">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  Ooh, what backend did you bring me?
                </div>
                <div className="text-[11px] text-foreground font-medium">
                  Drop it right here!
                </div>
              </div>
              {/* Pointy speech arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/95 border-r border-b border-cyan-400 rotate-45" />
            </motion.div>
          )}

          {!isDragging && phase === "wave" && (
            <motion.div
              key="bubble-wave"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative px-4 py-2.5 rounded-2xl bg-card/95 border border-primary/40 backdrop-blur-md shadow-[0_8px_30px_rgba(59,130,246,0.25)] text-center flex items-center gap-3"
            >
              <span className="text-2xl animate-pulse">👋</span>
              <div className="text-left">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  Hey there, explorer!
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-mono font-normal">RouteLens</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Welcome to your automated API companion.
                </div>
              </div>
              {/* Pointy speech arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/95 border-r border-b border-primary/40 rotate-45" />
            </motion.div>
          )}

          {!isDragging && phase === "wonder" && (
            <motion.div
              key="bubble-wonder"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative px-4 py-2.5 rounded-2xl bg-card/95 border border-purple-500/40 backdrop-blur-md shadow-[0_8px_30px_rgba(168,85,247,0.25)] text-center flex items-center gap-3"
            >
              <span className="text-2xl animate-bounce" style={{ animationDuration: "1.6s" }}>💭</span>
              <div className="text-left">
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  Wait... where are your APIs?
                  <HelpCircle size={12} className="text-purple-400 animate-pulse" />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  I don&apos;t see any backend routes loaded yet...
                </div>
              </div>
              {/* Ascending thought puffs */}
              <div className="absolute -bottom-2 left-[48%] w-2 h-2 rounded-full bg-card border border-purple-500/40" />
              <div className="absolute -bottom-4 left-[46%] w-1.5 h-1.5 rounded-full bg-card border border-purple-500/40" />
            </motion.div>
          )}

          {!isDragging && phase === "scan" && (
            <motion.div
              key="bubble-scan"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative px-4 py-2.5 rounded-2xl bg-card/95 border border-cyan-500/50 backdrop-blur-md shadow-[0_8px_30px_rgba(6,182,212,0.3)] text-center flex items-center gap-3"
            >
              <span className="text-2xl animate-pulse">🔍</span>
              <div className="text-left">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  Drop your backend folder here!
                  <Sparkles size={12} className="text-cyan-400 animate-spin" style={{ animationDuration: "3s" }} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Drag &amp; drop anywhere or choose folder below to scan!
                </div>
              </div>
              {/* Pointy speech arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/95 border-r border-b border-cyan-500/50 rotate-45" />
            </motion.div>
          )}

          {!isDragging && phase === "cheer" && (
            <motion.div
              key={`bubble-cheer-${clickCount}`}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative px-4 py-2.5 rounded-2xl bg-card/95 border border-amber-500/50 backdrop-blur-md shadow-[0_8px_30px_rgba(245,158,11,0.3)] text-center flex items-center gap-3"
            >
              <span className="text-2xl animate-bounce">
                {EASTER_EGG_QUOTES[clickCount % EASTER_EGG_QUOTES.length].icon}
              </span>
              <div className="text-left">
                <div className="text-xs font-bold text-amber-300">
                  {EASTER_EGG_QUOTES[clickCount % EASTER_EGG_QUOTES.length].title}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {EASTER_EGG_QUOTES[clickCount % EASTER_EGG_QUOTES.length].sub}
                </div>
              </div>
              {/* Pointy speech arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/95 border-r border-b border-amber-500/50 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Mascot Canvas with Natural Breathing / Floating Animation */}
      <div
        className="relative cursor-pointer group"
        onClick={handleMascotClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title="Click me to celebrate!"
      >
        <svg
          width="240"
          height="195"
          viewBox="0 0 240 195"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          {/* Defs for gradients & radar filters */}
          <defs>
            {/* Visor Glint Reflection */}
            <linearGradient id="glintGradMain" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>

            {/* Downward Conical Radar Search Beam */}
            <linearGradient id="radarBeamGrad" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.75" />
              <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
            </linearGradient>

            {/* Holographic Magnifying Lens */}
            <radialGradient id="lensGlassGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
              <stop offset="70%" stopColor="#0284c7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.8" />
            </radialGradient>

            {/* Holographic Thought Cloud Gradient */}
            <linearGradient id="cloudGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.7" />
            </linearGradient>
          </defs>

          {/* 1. Ground Shadow with Dynamic Breathing Scale */}
          <motion.ellipse
            cx="110"
            cy="176"
            rx="52"
            ry="7"
            fill="currentColor"
            className="text-black/60"
            animate={{
              rx: phase === "cheer" ? [52, 38, 52] : [52, 46, 52],
              opacity: phase === "cheer" ? [0.6, 0.3, 0.6] : [0.6, 0.45, 0.6],
            }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.ellipse
            cx="110"
            cy="176"
            rx="34"
            ry="4.5"
            fill="currentColor"
            className={cn(
              "transition-colors duration-500",
              phase === "wave" && "text-blue-500/25",
              phase === "wonder" && "text-purple-500/25",
              phase === "scan" && "text-cyan-400/35",
              phase === "cheer" && "text-amber-400/35"
            )}
            animate={{
              rx: [34, 28, 34],
            }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* 2. Floating Character Group (Gentle bobbing in space) */}
          <motion.g
            animate={{
              y: phase === "cheer" ? [0, -14, 0] : [0, -6, 0],
            }}
            transition={{
              duration: phase === "cheer" ? 0.6 : 3.2,
              repeat: phase === "cheer" ? 2 : Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Background Twinkling Stars (SS2) */}
            <path
              d="M34 38 L36 43 L41 45 L36 47 L34 52 L32 47 L27 45 L32 43 Z"
              fill="currentColor"
              className="text-zinc-500/40 animate-pulse"
              style={{ animationDuration: "3s" }}
            />
            <path
              d="M205 64 L206.5 67.5 L210 69 L206.5 70.5 L205 74 L203.5 70.5 L200 69 L203.5 67.5 Z"
              fill="currentColor"
              className="text-zinc-500/50 animate-pulse"
              style={{ animationDuration: "2.4s", animationDelay: "0.8s" }}
            />
            <path
              d="M28 98 L29.5 101 L33 102.5 L29.5 104 L28 107 L26.5 104 L23 102.5 L26.5 101 Z"
              fill="currentColor"
              className="text-zinc-500/30"
            />

            {/* Mini Rocket Orbiting in Background (SS2) */}
            <g transform="translate(182, 22) rotate(42)">
              {/* Rocket Body */}
              <path
                d="M0 -18 C6 -12 7 8 7 14 L-7 14 C-7 8 -6 -12 0 -18 Z"
                fill="#0f172a"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                className="text-zinc-300"
              />
              {/* Rocket Window */}
              <circle
                cx="0"
                cy="-2"
                r="3.2"
                fill="#38bdf8"
                fillOpacity="0.4"
                stroke="#38bdf8"
                strokeWidth="1.2"
              />
              {/* Left Fin */}
              <path
                d="M-7 8 L-13 15 L-7 14 Z"
                fill="#0f172a"
                stroke="currentColor"
                strokeWidth="1.6"
                className="text-zinc-300"
              />
              {/* Right Fin */}
              <path
                d="M7 8 L13 15 L7 14 Z"
                fill="#0f172a"
                stroke="currentColor"
                strokeWidth="1.6"
                className="text-zinc-300"
              />
              {/* Flame */}
              <path
                d="M-3 15 C-4 21 0 25 0 25 C0 25 4 21 3 15 Z"
                fill="#f97316"
                fillOpacity="0.85"
                className="animate-pulse"
              />
            </g>
            {/* Curved Smoke Trail (SS2) */}
            <path
              d="M185 42 Q172 58 176 75 T170 95"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeDasharray="3 3"
              strokeLinecap="round"
              className="text-zinc-600/60"
            />

            {/* SS2 Spacesuit Collar */}
            <path
              d="M92 98 Q110 106 128 98"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-zinc-200"
            />

            {/* SS2 Half-Body Bust Torso */}
            <path
              d="M86 105 C86 135 134 135 134 105"
              fill="#0f172a"
              stroke="currentColor"
              strokeWidth="2.4"
              className="text-zinc-200"
            />

            {/* SS2 Chest Control Box */}
            <rect
              x="102"
              y="106"
              width="16"
              height="11"
              rx="2.5"
              fill="#1e293b"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-zinc-500"
            />
            <circle cx="107" cy="111" r="1.8" fill="#f97316" />
            <circle cx="113" cy="111" r="1.8" fill="#06b6d4" />

            {/* Left Arm (Holding Smart Radar Watch - SS2 Signature) */}
            <path
              d="M86 105 C75 114 79 127 96 130"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
              className="text-zinc-200"
            />
            {/* Smart Radar Scanner Watch on Left Wrist */}
            <circle
              cx="96"
              cy="130"
              r="7"
              fill="#0f172a"
              stroke="#f97316"
              strokeWidth="1.8"
            />
            <path
              d="M96 130 L100 126"
              stroke="#f97316"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="96" cy="130" r="1.5" fill="#f97316" />

            {/* Head & Helmet Group (Expressive Tilting & Eye Animations) */}
            <motion.g
              animate={{
                rotate: phase === "wonder" ? 8 : phase === "wave" ? -2 : 0,
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              style={{ transformOrigin: "110px 68px" }}
            >
              {/* Antenna Rod */}
              <line
                x1="110"
                y1="36"
                x2="110"
                y2="18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                className="text-zinc-400"
              />
              <rect x="105" y="34" width="10" height="3.5" rx="1.8" fill="#475569" />

              {/* Antenna Beacon Tip with Mathematically Anchored SVG Pulse (SS2) */}
              <circle cx="110" cy="14" r="4.2" fill="#f97316" className="animate-pulse" />
              <circle cx="110" cy="14" r="5" fill="#f97316" fillOpacity="0.4">
                <animate
                  attributeName="r"
                  values="4;8.5;4"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.65;0.05;0.65"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Outer Helmet Shell with SS2 Clean White/Silver Rim */}
              <circle
                cx="110"
                cy="68"
                r="33"
                fill="#0f172a"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-zinc-200"
              />

              {/* Left & Right Earmuffs */}
              <rect
                x="74"
                y="59"
                width="6"
                height="18"
                rx="3"
                fill="#1e293b"
                stroke="currentColor"
                strokeWidth="2"
                className="text-zinc-400"
              />
              <rect
                x="140"
                y="59"
                width="6"
                height="18"
                rx="3"
                fill="#1e293b"
                stroke="currentColor"
                strokeWidth="2"
                className="text-zinc-400"
              />

              {/* Visor Window (SS2 Dark Glass with Cyan Accent) */}
              <rect
                x="86"
                y="50"
                width="48"
                height="35"
                rx="16"
                fill="#090d16"
                stroke="currentColor"
                strokeWidth="2"
                className="text-cyan-400/70"
              />

              {/* Visor Top Curved Glint Reflection */}
              <path
                d="M91 57 Q102 52 121 54 Q112 59 95 61 Z"
                fill="url(#glintGradMain)"
              />

              {/* Sweet Rosy Cheeks (SS2 Warmth) */}
              <ellipse cx="95" cy="72" rx="3" ry="1.6" fill="#fb7185" fillOpacity="0.55" />
              <ellipse cx="125" cy="72" rx="3" ry="1.6" fill="#fb7185" fillOpacity="0.55" />

              {/* Expressive Visor Eyes */}
              {(isDragging || phase === "cheer") && (
                <g>
                  {/* Joyful Starburst Eyes */}
                  <path
                    d="M100 62 L102 65.5 L106 66.5 L102 67.5 L100 71 L98 67.5 L94 66.5 L98 65.5 Z"
                    fill={isDragging ? "#38bdf8" : "#f59e0b"}
                  />
                  <path
                    d="M120 62 L122 65.5 L126 66.5 L122 67.5 L120 71 L118 67.5 L114 66.5 L118 65.5 Z"
                    fill={isDragging ? "#38bdf8" : "#f59e0b"}
                  />
                </g>
              )}

              {!isDragging && phase === "wave" && (
                <g>
                  {/* Cute Glossy Eyes with Smile (SS2 Canonical) */}
                  <ellipse cx="100" cy="64" rx="2.5" ry="3.2" fill="#ffffff" />
                  <circle cx="99.2" cy="63.2" r="1" fill="#09090b" />
                  <ellipse cx="120" cy="64" rx="2.5" ry="3.2" fill="#ffffff" />
                  <circle cx="119.2" cy="63.2" r="1" fill="#09090b" />
                </g>
              )}

              {!isDragging && phase === "wonder" && (
                <motion.g
                  animate={{ x: [-2.5, 2.5, -2.5] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Curious wide searching eyes looking around */}
                  <circle cx="100" cy="64" r="3.8" fill="#c084fc" />
                  <circle cx="101.5" cy="62.5" r="1.4" fill="#ffffff" />
                  <circle cx="120" cy="64" r="3.8" fill="#c084fc" />
                  <circle cx="121.5" cy="62.5" r="1.4" fill="#ffffff" />
                </motion.g>
              )}

              {!isDragging && phase === "scan" && (
                <g>
                  {/* Focused alert scanner eyes with cyber cyan reticle */}
                  <circle cx="100" cy="64" r="3.4" fill="#06b6d4" />
                  <circle cx="101.2" cy="62.8" r="1.3" fill="#ffffff" />
                  <circle cx="120" cy="64" r="3.4" fill="#06b6d4" />
                  <circle cx="121.2" cy="62.8" r="1.3" fill="#ffffff" />
                  {/* Digital scanline across eyes */}
                  <line
                    x1="91"
                    y1="64"
                    x2="129"
                    y2="64"
                    stroke="#06b6d4"
                    strokeWidth="0.8"
                    strokeOpacity="0.5"
                    strokeDasharray="2 2"
                  />
                </g>
              )}

              {/* The Signature SS2 Smile :) */}
              <path
                d={phase === "cheer" || isDragging ? "M105 73 Q110 79 115 73" : "M106 73 Q110 77 114 73"}
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </motion.g>

            {/* 3. Thought Cloud Graphic hovering in Phase: Wonder */}
            {!isDragging && phase === "wonder" && (
              <motion.g
                initial={{ opacity: 0, scale: 0.8, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.35 }}
              >
                {/* Ascending bubbles to cloud */}
                <circle cx="146" cy="34" r="2.8" fill="#c084fc" fillOpacity="0.6" />
                <circle cx="154" cy="24" r="4.2" fill="#c084fc" fillOpacity="0.75" />

                {/* Holographic Thought Cloud */}
                <g transform="translate(144, -6)">
                  <path
                    d="M18 18 C14 18 10 21 10 26 C6 26 2 29 2 34 C2 39 6 43 11 43 C13 46 17 48 21 48 C25 48 29 46 31 43 C35 43 39 39 39 35 C39 30 36 27 32 26 C32 21 27 18 22 18 Z"
                    fill="url(#cloudGrad)"
                    stroke="#e9d5ff"
                    strokeWidth="1.5"
                    className="shadow-md"
                  />
                  {/* Glowing Question Mark & Brackets inside Cloud */}
                  <text
                    x="13"
                    y="37"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {"{?}"}
                  </text>
                </g>
              </motion.g>
            )}

            {/* 4. Storytelling Right Arm & Gadget Animations */}
            {/* State A: Natural Organic Wave (Seamless Shoulder + Wrist Flutter) */}
            {(isDragging || phase === "wave" || phase === "cheer") && (
              <motion.g
                animate={{
                  rotate: isDragging ? [-3.5, 3.5, -3.5] : phase === "cheer" ? [-2.5, 2.5, -2.5] : [-1, 1, -1],
                  y: [0, -1, 0],
                }}
                transition={{
                  duration: isDragging ? 0.3 : phase === "cheer" ? 0.45 : 1.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ transformOrigin: "135px 110px" }}
              >
                {/* Seamless Shoulder Pad */}
                <circle cx="134" cy="110" r="7" fill="#1e293b" stroke="currentColor" strokeWidth="2" className="text-zinc-200" />

                {/* Naturally Curved Space Suit Arm */}
                <path
                  d="M133 108 C141 100 148 88 158 76 C162 78 165 82 161 86 C152 97 143 109 135 117 Z"
                  fill="#0f172a"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  className="text-zinc-200"
                />

                {/* Wrist Cuff Ring */}
                <ellipse
                  cx="160"
                  cy="78"
                  rx="4.2"
                  ry="2.4"
                  fill="#1e293b"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  transform="rotate(-35 160 78)"
                  className="text-zinc-300"
                />

                {/* Natural Waving Hand (Pivoting smoothly from the wrist) */}
                <motion.g
                  animate={{
                    rotate: phase === "cheer" ? [-22, 22, -22] : [-16, 16, -16],
                  }}
                  transition={{
                    duration: phase === "cheer" ? 0.4 : 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ transformOrigin: "160px 78px" }}
                >
                  {/* Space Glove */}
                  <circle cx="166" cy="68" r="7.5" fill="#0f172a" stroke="currentColor" strokeWidth="2" className="text-zinc-200" />
                  {/* Waving Fingers */}
                  <path
                    d="M163 61 L166 54 M167 60 L172 55 M171 63 L177 59"
                    stroke="#94a3b8"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  {/* Thumb */}
                  <path
                    d="M160 68 L156 66"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </motion.g>
              </motion.g>
            )}

            {/* State B: Thoughtfully Touching Chin */}
            {!isDragging && phase === "wonder" && (
              <motion.g
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {/* Curved arm sleeve matching suit style */}
                <path
                  d="M135 106 C146 108 150 100 143 88 C139 83 134 84 133 88 C138 95 141 101 136 118 Z"
                  fill="#0f172a"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  className="text-zinc-200"
                />
                <circle cx="132" cy="88" r="6.5" fill="#1e293b" stroke="currentColor" strokeWidth="1.5" className="text-zinc-300" />
              </motion.g>
            )}

            {/* State C: Magnifying Glass & Ground Sonar Radar Search */}
            {!isDragging && phase === "scan" && (
              <motion.g
                initial={{ opacity: 0, x: -10, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: "backOut" }}
              >
                {/* Arm sleeve holding scanner */}
                <path
                  d="M134 106 C144 104 154 101 164 98 L166 107 C155 111 145 114 134 118 Z"
                  fill="#0f172a"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  className="text-zinc-200"
                />
                {/* Wrist cuff */}
                <ellipse
                  cx="164"
                  cy="102.5"
                  rx="3"
                  ry="5"
                  fill="#1e293b"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  transform="rotate(-15 164 102.5)"
                  className="text-zinc-300"
                />
                {/* Space glove firmly gripping the handle */}
                <circle cx="166" cy="102" r="7" fill="#0f172a" stroke="currentColor" strokeWidth="2" className="text-zinc-200" />
                {/* Thumb gripping handle */}
                <path
                  d="M164 99 C166 97 169 98 170 101"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Magnifying Glass Assembly with Sweeping Motion */}
                <motion.g
                  animate={{
                    rotate: [-8, 8, -8],
                  }}
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ transformOrigin: "166px 102px" }}
                >
                  {/* Metallic Handle */}
                  <line
                    x1="166"
                    y1="102"
                    x2="180"
                    y2="82"
                    stroke="#64748b"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="166"
                    y1="102"
                    x2="180"
                    y2="82"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Downward Conical Radar Searchlight Beam */}
                  <polygon
                    points="186,74 224,138 154,173"
                    fill="url(#radarBeamGrad)"
                    className="animate-pulse"
                    style={{ animationDuration: "1.5s" }}
                  />

                  {/* Magnifying Glass Rim */}
                  <circle
                    cx="186"
                    cy="74"
                    r="19"
                    fill="url(#lensGlassGrad)"
                    stroke="#38bdf8"
                    strokeWidth="3.5"
                    className="shadow-xl"
                  />
                  {/* Internal Holographic Reticle */}
                  <circle
                    cx="186"
                    cy="74"
                    r="11"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.3"
                    strokeDasharray="3 2"
                  />
                  <line x1="177" y1="74" x2="195" y2="74" stroke="#06b6d4" strokeWidth="1.2" />
                  <line x1="186" y1="65" x2="186" y2="83" stroke="#06b6d4" strokeWidth="1.2" />

                  {/* Ground Radar Target on Floor */}
                  <g transform="translate(10, 0)">
                    <ellipse
                      cx="180"
                      cy="168"
                      rx="28"
                      ry="7.5"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                    <ellipse
                      cx="180"
                      cy="168"
                      rx="16"
                      ry="4.5"
                      fill="#06b6d4"
                      fillOpacity="0.15"
                    />
                    {/* Discovered API tokens popping up! */}
                    <g className="animate-pulse" style={{ animationDuration: "1.4s" }}>
                      <text
                        x="165"
                        y="164"
                        fill="#34d399"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        GET
                      </text>
                      <text
                        x="186"
                        y="172"
                        fill="#fbbf24"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {"{ }"}
                      </text>
                    </g>
                  </g>
                </motion.g>
              </motion.g>
            )}
          </motion.g>
        </svg>
      </div>

      {/* Sleek Minimal Story Stepper Dots */}
      <div className="flex items-center gap-1.5 mt-2">
        <button
          onClick={() => setPhase("wave")}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
            phase === "wave"
              ? "w-5 bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)]"
              : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
          )}
          title="Greeting"
        />
        <button
          onClick={() => setPhase("wonder")}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
            phase === "wonder"
              ? "w-5 bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]"
              : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
          )}
          title="Searching for APIs"
        />
        <button
          onClick={() => setPhase("scan")}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
            phase === "scan"
              ? "w-5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
              : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
          )}
          title="Radar Scanner"
        />
      </div>
    </div>
  );
};
