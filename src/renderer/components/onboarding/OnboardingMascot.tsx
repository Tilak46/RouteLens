import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type MascotPhase = "wave" | "wonder" | "scan" | "cheer";

interface OnboardingMascotProps {
  className?: string;
  onExploreClick?: () => void;
}

export const OnboardingMascot: React.FC<OnboardingMascotProps> = ({
  className,
}) => {
  const [phase, setPhase] = useState<MascotPhase>("wave");
  const [isHovered, setIsHovered] = useState(false);

  // Auto-cycle through the 3 storytelling phases every 4.2 seconds
  useEffect(() => {
    if (phase === "cheer") {
      const cheerTimer = setTimeout(() => setPhase("scan"), 3500);
      return () => clearTimeout(cheerTimer);
    }

    const interval = setInterval(() => {
      setPhase((current) => {
        if (current === "wave") return "wonder";
        if (current === "wonder") return "scan";
        return "wave";
      });
    }, 4200);

    return () => clearInterval(interval);
  }, [phase]);

  const handleMascotClick = () => {
    setPhase("cheer");
  };

  return (
    <div className={cn("relative flex flex-col items-center select-none", className)}>
      {/* Ambient Radial Glow behind the mascot */}
      <div
        className={cn(
          "absolute top-12 w-48 h-48 rounded-full blur-3xl pointer-events-none -z-10 transition-all duration-700",
          phase === "wave" && "bg-blue-500/15",
          phase === "wonder" && "bg-purple-500/15",
          phase === "scan" && "bg-cyan-500/20",
          phase === "cheer" && "bg-amber-500/25"
        )}
      />

      {/* Floating Story Speech / Thought Cloud Bubble */}
      <div className="h-16 flex items-end justify-center mb-2 z-20">
        <AnimatePresence mode="wait">
          {phase === "wave" && (
            <motion.div
              key="bubble-wave"
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative px-4 py-2 rounded-2xl bg-card/90 border border-primary/30 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.3)] text-center flex items-center gap-2"
            >
              <span className="text-lg">👋</span>
              <div className="text-left">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  Hey there, dev!
                  <span className="text-[10px] font-normal text-muted-foreground font-mono">RouteLens</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Ready to explore some APIs today?
                </div>
              </div>
              {/* Speech bubble pointy arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/90 border-r border-b border-primary/30 rotate-45" />
            </motion.div>
          )}

          {phase === "wonder" && (
            <motion.div
              key="bubble-wonder"
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative px-4 py-2 rounded-2xl bg-card/90 border border-purple-500/30 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.3)] text-center flex items-center gap-2.5"
            >
              <span className="text-lg animate-bounce" style={{ animationDuration: "1.8s" }}>💭</span>
              <div className="text-left">
                <div className="text-xs font-bold text-purple-300">
                  Wait... where are your APIs?
                </div>
                <div className="text-[11px] text-muted-foreground">
                  I don&apos;t see any backend routes yet...
                </div>
              </div>
              {/* Ascending thought puffs */}
              <div className="absolute -bottom-2 left-[46%] w-2 h-2 rounded-full bg-card border border-purple-500/30" />
              <div className="absolute -bottom-4 left-[44%] w-1.5 h-1.5 rounded-full bg-card border border-purple-500/30" />
            </motion.div>
          )}

          {phase === "scan" && (
            <motion.div
              key="bubble-scan"
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative px-4 py-2 rounded-2xl bg-card/95 border border-cyan-500/40 backdrop-blur-md shadow-[0_8px_24px_rgba(6,182,212,0.25)] text-center flex items-center gap-2.5"
            >
              <span className="text-lg">🔍</span>
              <div className="text-left">
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  Point me to your backend folder!
                  <Sparkles size={11} className="text-cyan-400 animate-pulse" />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  I&apos;ll scan and discover all your endpoints in seconds!
                </div>
              </div>
              {/* Speech bubble pointy arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/95 border-r border-b border-cyan-500/40 rotate-45" />
            </motion.div>
          )}

          {phase === "cheer" && (
            <motion.div
              key="bubble-cheer"
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative px-4 py-2 rounded-2xl bg-card/95 border border-amber-500/40 backdrop-blur-md shadow-[0_8px_24px_rgba(245,158,11,0.25)] text-center flex items-center gap-2.5"
            >
              <span className="text-lg animate-bounce">🚀</span>
              <div className="text-left">
                <div className="text-xs font-bold text-amber-300">
                  Ready when you are!
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Click &ldquo;Open Project Folder&rdquo; below to ignite!
                </div>
              </div>
              {/* Speech bubble pointy arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/95 border-r border-b border-amber-500/40 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Mascot SVG Canvas */}
      <motion.div
        className="relative cursor-pointer group"
        onClick={handleMascotClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{
          y: phase === "cheer" ? [0, -12, 0] : isHovered ? -3 : 0,
        }}
        transition={{
          duration: 0.4,
          ease: "easeInOut",
        }}
        title="Click me for a surprise!"
      >
        <svg
          width="180"
          height="170"
          viewBox="0 0 200 190"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          {/* Defs for gradients & filters */}
          <defs>
            {/* Visor Glass Gradient */}
            <linearGradient id="visorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="60%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
            </linearGradient>

            {/* Visor Glint Gradient */}
            <linearGradient id="glintGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>

            {/* Radar Scanning Beam Cone Gradient */}
            <linearGradient id="scannerBeamGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>

            {/* Magnifying Glass Lens Gradient */}
            <radialGradient id="lensGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.7" />
            </radialGradient>
          </defs>

          {/* 1. Base Floating Ring / Ground Shadow */}
          <ellipse
            cx="100"
            cy="176"
            rx="52"
            ry="7"
            fill="currentColor"
            className="text-zinc-800/80"
          />
          <ellipse
            cx="100"
            cy="176"
            rx="36"
            ry="4.5"
            fill="currentColor"
            className={cn(
              "transition-colors duration-500",
              phase === "wave" && "text-blue-500/20",
              phase === "wonder" && "text-purple-500/20",
              phase === "scan" && "text-cyan-400/30",
              phase === "cheer" && "text-amber-400/30"
            )}
          />

          {/* 2. Backpack (behind body) */}
          <rect
            x="64"
            y="94"
            width="72"
            height="58"
            rx="14"
            fill="#1e293b"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-zinc-700"
          />
          {/* Backpack Thruster / Vents */}
          <rect x="76" y="148" width="16" height="8" rx="3" fill="#334155" />
          <rect x="108" y="148" width="16" height="8" rx="3" fill="#334155" />
          {/* Status LEDs on Backpack */}
          <circle cx="74" cy="106" r="2.5" fill="#10b981" />
          <circle cx="82" cy="106" r="2.5" fill="#06b6d4" />
          <circle cx="90" cy="106" r="2.5" fill="#f59e0b" />

          {/* 3. Astronaut Legs & Boots */}
          <rect x="77" y="144" width="18" height="26" rx="8" fill="#334155" stroke="#475569" strokeWidth="2" />
          <rect x="105" y="144" width="18" height="26" rx="8" fill="#334155" stroke="#475569" strokeWidth="2" />
          {/* Boot Soles */}
          <path d="M74 168 Q86 166 98 168 L96 172 Q86 174 74 172 Z" fill="#1e293b" />
          <path d="M102 168 Q114 166 126 168 L124 172 Q114 174 102 172 Z" fill="#1e293b" />

          {/* 4. Astronaut Suit Body */}
          <rect
            x="68"
            y="96"
            width="64"
            height="52"
            rx="16"
            fill="#0f172a"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-zinc-500"
          />
          {/* Chest Plate Detail */}
          <rect
            x="78"
            y="105"
            width="44"
            height="26"
            rx="7"
            fill="#1e293b"
            stroke="#334155"
            strokeWidth="1.5"
          />
          {/* Glowing Status Light on Chest */}
          <circle cx="88" cy="118" r="3.5" fill="#06b6d4" className="animate-pulse" />
          {/* Data Lines on Chest */}
          <line x1="97" y1="115" x2="114" y2="115" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="97" y1="121" x2="109" y2="121" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />

          {/* 5. Left Arm (resting at side or holding belt) */}
          <g>
            <path
              d="M68 104 C56 112 55 128 61 138 C64 142 69 140 68 135 C64 126 65 116 73 110 Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Left Glove */}
            <circle cx="62" cy="138" r="6.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          </g>

          {/* 6. Head / Helmet Group (With subtle tilt when wondering!) */}
          <motion.g
            animate={{
              rotate: phase === "wonder" ? 9 : phase === "wave" ? -2 : 0,
              y: phase === "cheer" ? -3 : 0,
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{ transformOrigin: "100px 65px" }}
          >
            {/* Antenna Rod */}
            <line
              x1="100"
              y1="32"
              x2="100"
              y2="14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-zinc-400"
            />
            {/* Antenna Base Mount */}
            <rect x="95" y="30" width="10" height="4" rx="2" fill="#475569" />

            {/* Glowing Beacon on Antenna Tip (Anchored native pulse, no CSS scale leakage) */}
            <circle cx="100" cy="10" r="4" fill="#f97316" className="animate-pulse" />
            <circle cx="100" cy="10" r="5" fill="#f97316" fillOpacity="0.35">
              <animate
                attributeName="r"
                values="4;8;4"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.6;0.05;0.6"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Outer Helmet Shell */}
            <circle
              cx="100"
              cy="65"
              r="36"
              fill="#0f172a"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-zinc-400"
            />

            {/* Left Earmuff */}
            <rect
              x="60"
              y="55"
              width="7"
              height="20"
              rx="3.5"
              fill="#1e293b"
              stroke="currentColor"
              strokeWidth="2"
              className="text-zinc-400"
            />
            {/* Right Earmuff */}
            <rect
              x="133"
              y="55"
              width="7"
              height="20"
              rx="3.5"
              fill="#1e293b"
              stroke="currentColor"
              strokeWidth="2"
              className="text-zinc-400"
            />

            {/* Visor Rim */}
            <rect
              x="72"
              y="46"
              width="56"
              height="40"
              rx="18"
              fill="url(#visorGrad)"
              stroke="#38bdf8"
              strokeWidth="1.8"
              strokeOpacity="0.6"
            />

            {/* Visor Glint Reflection (Curved shine) */}
            <path
              d="M78 54 Q92 48 114 51 Q104 56 82 58 Z"
              fill="url(#glintGrad)"
            />

            {/* Expressive Eyes inside Visor based on storytelling phase */}
            {phase === "wave" && (
              <g>
                {/* Friendly smiling happy curved eyes */}
                <path
                  d="M84 66 Q90 60 96 66"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M104 66 Q110 60 116 66"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            )}

            {phase === "wonder" && (
              <motion.g
                animate={{ x: [-2, 3, -2] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Curious wide searching eyes panning around */}
                <circle cx="89" cy="65" r="4" fill="#c084fc" />
                <circle cx="91" cy="64" r="1.5" fill="#ffffff" />
                <circle cx="111" cy="65" r="4.5" fill="#c084fc" />
                <circle cx="113" cy="64" r="1.8" fill="#ffffff" />
              </motion.g>
            )}

            {phase === "scan" && (
              <g>
                {/* Focused scanning eyes with cyan cyber glow */}
                <circle cx="89" cy="65" r="3.5" fill="#06b6d4" />
                <circle cx="90" cy="64" r="1.5" fill="#ffffff" />
                <circle cx="111" cy="65" r="3.5" fill="#06b6d4" />
                <circle cx="112" cy="64" r="1.5" fill="#ffffff" />
                {/* Subtle digital scanning grid line across eyes */}
                <line x1="78" y1="65" x2="122" y2="65" stroke="#06b6d4" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="2 2" />
              </g>
            )}

            {phase === "cheer" && (
              <g>
                {/* Excited star/gleam eyes */}
                <path d="M89 61 L91 65 L95 66 L91 67 L89 71 L87 67 L83 66 L87 65 Z" fill="#f59e0b" />
                <path d="M111 61 L113 65 L117 66 L113 67 L111 71 L109 67 L105 66 L109 65 Z" fill="#f59e0b" />
              </g>
            )}
          </motion.g>

          {/* 7. Right Arm & Props (Storytelling Waving & Magnifying Glass) */}
          {/* Case A: Waving Arm (Phase: Wave or Cheer) */}
          {(phase === "wave" || phase === "cheer") && (
            <motion.g
              initial={{ rotate: -15 }}
              animate={{
                rotate: phase === "cheer" ? [-25, 25, -25, 25, -15] : [-15, 20, -15, 18, -15],
              }}
              transition={{
                duration: phase === "cheer" ? 0.7 : 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ transformOrigin: "132px 105px" }}
            >
              {/* Upper Arm raised up */}
              <path
                d="M130 106 C140 98 152 86 160 72 C163 67 167 69 166 74 C160 88 147 104 135 112 Z"
                fill="#334155"
                stroke="#475569"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Waving Glove */}
              <circle cx="163" cy="70" r="7.5" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              {/* Cute Waving Palm & Fingers */}
              <path
                d="M161 64 L165 58 M164 63 L169 59 M166 65 L172 63"
                stroke="#64748b"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </motion.g>
          )}

          {/* Case B: Scratching Chin Thoughtfully (Phase: Wonder) */}
          {phase === "wonder" && (
            <motion.g
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Arm reaching toward chin */}
              <path
                d="M130 108 C144 114 148 100 138 86 C134 81 129 82 128 86 C134 94 136 102 128 112 Z"
                fill="#334155"
                stroke="#475569"
                strokeWidth="2"
              />
              {/* Glove touching chin */}
              <circle cx="127" cy="84" r="6.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            </motion.g>
          )}

          {/* Case C: Pulling out Magnifying Glass & Radar Scanning (Phase: Scan) */}
          {phase === "scan" && (
            <motion.g
              initial={{ opacity: 0, x: -10, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: "backOut" }}
            >
              {/* Arm holding magnifying glass handle */}
              <path
                d="M130 108 C145 110 156 106 162 98 C165 94 163 90 158 91 C152 95 144 98 132 112 Z"
                fill="#334155"
                stroke="#475569"
                strokeWidth="2"
              />
              {/* Glove gripping handle */}
              <circle cx="162" cy="96" r="6.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

              {/* Magnifying Glass Assembly */}
              <motion.g
                animate={{
                  rotate: [-6, 6, -6],
                  y: [-2, 2, -2],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ transformOrigin: "162px 96px" }}
              >
                {/* Metallic Chrome Handle */}
                <line
                  x1="162"
                  y1="96"
                  x2="175"
                  y2="76"
                  stroke="#64748b"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <line
                  x1="162"
                  y1="96"
                  x2="175"
                  y2="76"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Radar Search Beam Sweeping forward */}
                <polygon
                  points="180,68 215,35 218,105"
                  fill="url(#scannerBeamGrad)"
                  className="animate-pulse"
                  style={{ animationDuration: "1.4s" }}
                />

                {/* Outer Glass Rim */}
                <circle
                  cx="180"
                  cy="68"
                  r="18"
                  fill="url(#lensGrad)"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  className="shadow-lg"
                />
                {/* Inner Crosshair / Scanner Reticle */}
                <circle
                  cx="180"
                  cy="68"
                  r="10"
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
                <line x1="172" y1="68" x2="188" y2="68" stroke="#06b6d4" strokeWidth="1" />
                <line x1="180" y1="60" x2="180" y2="76" stroke="#06b6d4" strokeWidth="1" />

                {/* Little Caught API Glyphs floating near magnifying lens */}
                <g className="animate-pulse" style={{ animationDuration: "1.6s" }}>
                  <text x="194" y="52" fill="#34d399" fontSize="8" fontWeight="bold" fontFamily="monospace">
                    GET
                  </text>
                  <text x="190" y="88" fill="#fbbf24" fontSize="8" fontWeight="bold" fontFamily="monospace">
                    {"{ }"}
                  </text>
                </g>
              </motion.g>
            </motion.g>
          )}

          {/* Twinkling Space Sparkles around Mascot */}
          <path
            d="M36 78 L38 82 L42 84 L38 86 L36 90 L34 86 L30 84 L34 82 Z"
            fill="#38bdf8"
            className="animate-pulse"
            style={{ animationDuration: "2.5s" }}
          />
          <path
            d="M165 140 L166.5 143.5 L170 145 L166.5 146.5 L165 150 L163.5 146.5 L160 145 L163.5 143.5 Z"
            fill="#a855f7"
            className="animate-pulse"
            style={{ animationDuration: "3.2s", animationDelay: "0.5s" }}
          />
        </svg>
      </motion.div>

      {/* Interactive Phase Indicator & Story Stepper */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => setPhase("wave")}
          className={cn(
            "text-[11px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1",
            phase === "wave"
              ? "bg-primary/20 border-primary/40 text-primary font-semibold shadow-sm"
              : "bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <span>👋</span>
          <span>Wave</span>
        </button>

        <button
          onClick={() => setPhase("wonder")}
          className={cn(
            "text-[11px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1",
            phase === "wonder"
              ? "bg-purple-500/20 border-purple-500/40 text-purple-300 font-semibold shadow-sm"
              : "bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <span>💭</span>
          <span>Where&apos;s API?</span>
        </button>

        <button
          onClick={() => setPhase("scan")}
          className={cn(
            "text-[11px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1",
            phase === "scan"
              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-semibold shadow-sm"
              : "bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <span>🔍</span>
          <span>Scan Backend</span>
        </button>
      </div>
    </div>
  );
};
