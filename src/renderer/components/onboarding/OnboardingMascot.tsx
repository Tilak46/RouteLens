import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Terminal, Search, HelpCircle, Rocket } from "lucide-react";
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
          phase === "wave" && "bg-blue-500/20",
          phase === "wonder" && "bg-purple-500/20",
          phase === "scan" && "bg-cyan-500/25",
          phase === "cheer" && "bg-amber-500/30"
        )}
      />

      {/* Floating Story Speech / Thought Cloud Bubble */}
      <div className="h-18 flex items-end justify-center mb-1 z-20">
        <AnimatePresence mode="wait">
          {phase === "wave" && (
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

          {phase === "wonder" && (
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

          {phase === "scan" && (
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
                  Point me to your backend folder!
                  <Sparkles size={12} className="text-cyan-400 animate-spin" style={{ animationDuration: "3s" }} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  I&apos;ll scan and discover all your endpoints in seconds!
                </div>
              </div>
              {/* Pointy speech arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/95 border-r border-b border-cyan-500/50 rotate-45" />
            </motion.div>
          )}

          {phase === "cheer" && (
            <motion.div
              key="bubble-cheer"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative px-4 py-2.5 rounded-2xl bg-card/95 border border-amber-500/50 backdrop-blur-md shadow-[0_8px_30px_rgba(245,158,11,0.3)] text-center flex items-center gap-3"
            >
              <span className="text-2xl animate-bounce">🚀</span>
              <div className="text-left">
                <div className="text-xs font-bold text-amber-300">
                  Ready to launch!
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Click &ldquo;Open Project Folder&rdquo; below to ignite!
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
          width="230"
          height="195"
          viewBox="0 0 240 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          {/* Defs for gradients & radar filters */}
          <defs>
            {/* Visor Glass Gradient */}
            <linearGradient id="visorGradMain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1329" />
              <stop offset="65%" stopColor="#111c3a" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.5" />
            </linearGradient>

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
            cy="186"
            rx="54"
            ry="7.5"
            fill="currentColor"
            className="text-black/60"
            animate={{
              rx: phase === "cheer" ? [54, 40, 54] : [54, 48, 54],
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
            cy="186"
            rx="36"
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
              rx: [36, 30, 36],
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
            {/* Backpack (behind suit) */}
            <rect
              x="74"
              y="102"
              width="72"
              height="60"
              rx="15"
              fill="#1e293b"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-zinc-700"
            />
            {/* Backpack Thruster Vents */}
            <rect x="85" y="158" width="16" height="8" rx="3" fill="#334155" />
            <rect x="119" y="158" width="16" height="8" rx="3" fill="#334155" />
            {/* Status LEDs on Backpack */}
            <circle cx="84" cy="114" r="2.5" fill="#10b981" />
            <circle cx="92" cy="114" r="2.5" fill="#06b6d4" />
            <circle cx="100" cy="114" r="2.5" fill="#f59e0b" />

            {/* Astronaut Legs & Boots */}
            <rect x="87" y="152" width="18" height="26" rx="8" fill="#334155" stroke="#475569" strokeWidth="2" />
            <rect x="115" y="152" width="18" height="26" rx="8" fill="#334155" stroke="#475569" strokeWidth="2" />
            {/* Boot Soles with Grip */}
            <path d="M84 176 Q96 174 108 176 L106 181 Q96 183 84 181 Z" fill="#1e293b" stroke="#475569" strokeWidth="1" />
            <path d="M112 176 Q124 174 136 176 L134 181 Q124 183 112 181 Z" fill="#1e293b" stroke="#475569" strokeWidth="1" />

            {/* Astronaut Suit Body */}
            <rect
              x="78"
              y="104"
              width="64"
              height="54"
              rx="16"
              fill="#0f172a"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-zinc-500"
            />
            {/* Chest Plate Detail */}
            <rect
              x="88"
              y="114"
              width="44"
              height="26"
              rx="7"
              fill="#1e293b"
              stroke="#334155"
              strokeWidth="1.5"
            />
            {/* Glowing Heartbeat LED on Chest */}
            <circle cx="98" cy="127" r="3.5" fill="#06b6d4" className="animate-pulse" />
            {/* Data Lines on Chest Plate */}
            <line x1="107" y1="124" x2="124" y2="124" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="107" y1="130" x2="119" y2="130" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />

            {/* Left Arm (Relaxed at hip) */}
            <g>
              <path
                d="M78 112 C66 120 65 136 71 146 C74 150 79 148 78 143 C74 134 75 124 83 118 Z"
                fill="#334155"
                stroke="#475569"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="72" cy="146" r="6.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            </g>

            {/* Head & Helmet Group (Expressive Tilting & Eye Animations) */}
            <motion.g
              animate={{
                rotate: phase === "wonder" ? 10 : phase === "wave" ? -3 : 0,
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              style={{ transformOrigin: "110px 72px" }}
            >
              {/* Antenna Rod */}
              <line
                x1="110"
                y1="40"
                x2="110"
                y2="20"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="text-zinc-400"
              />
              <rect x="105" y="38" width="10" height="4" rx="2" fill="#475569" />

              {/* Antenna Beacon Tip with Mathematically Anchored SVG Pulse */}
              <circle cx="110" cy="16" r="4.5" fill="#f97316" className="animate-pulse" />
              <circle cx="110" cy="16" r="5" fill="#f97316" fillOpacity="0.35">
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

              {/* Outer Helmet Shell */}
              <circle
                cx="110"
                cy="72"
                r="37"
                fill="#0f172a"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-zinc-400"
              />

              {/* Left & Right Earmuffs with Cyber Rivets */}
              <rect
                x="70"
                y="62"
                width="7"
                height="20"
                rx="3.5"
                fill="#1e293b"
                stroke="currentColor"
                strokeWidth="2"
                className="text-zinc-400"
              />
              <rect
                x="143"
                y="62"
                width="7"
                height="20"
                rx="3.5"
                fill="#1e293b"
                stroke="currentColor"
                strokeWidth="2"
                className="text-zinc-400"
              />

              {/* Visor Glass Window */}
              <rect
                x="82"
                y="53"
                width="56"
                height="40"
                rx="18"
                fill="url(#visorGradMain)"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeOpacity="0.65"
              />

              {/* Visor Top Curved Glint */}
              <path
                d="M88 61 Q102 55 124 58 Q114 63 92 65 Z"
                fill="url(#glintGradMain)"
              />

              {/* Soulful Rosy Cheeks (Gives character warmth & cuteness) */}
              <ellipse cx="91" cy="79" rx="4" ry="2.2" fill="#fb7185" fillOpacity="0.45" />
              <ellipse cx="129" cy="79" rx="4" ry="2.2" fill="#fb7185" fillOpacity="0.45" />

              {/* Expressive Visor Eyes */}
              {phase === "wave" && (
                <g>
                  {/* Happy inverted smiling arc eyes */}
                  <path
                    d="M94 73 Q100 66 106 73"
                    stroke="#38bdf8"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M114 73 Q120 66 126 73"
                    stroke="#38bdf8"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>
              )}

              {phase === "wonder" && (
                <motion.g
                  animate={{ x: [-3, 3, -3] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Curious wide searching eyes looking around */}
                  <circle cx="99" cy="72" r="4.5" fill="#c084fc" />
                  <circle cx="101" cy="70.5" r="1.6" fill="#ffffff" />
                  <circle cx="121" cy="72" r="4.5" fill="#c084fc" />
                  <circle cx="123" cy="70.5" r="1.6" fill="#ffffff" />
                </motion.g>
              )}

              {phase === "scan" && (
                <g>
                  {/* Focused alert scanner eyes with cyber cyan reticle */}
                  <circle cx="99" cy="72" r="4" fill="#06b6d4" />
                  <circle cx="100.5" cy="70.5" r="1.6" fill="#ffffff" />
                  <circle cx="121" cy="72" r="4" fill="#06b6d4" />
                  <circle cx="122.5" cy="70.5" r="1.6" fill="#ffffff" />
                  {/* Digital scanline across eyes */}
                  <line x1="88" y1="72" x2="132" y2="72" stroke="#06b6d4" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="2 2" />
                </g>
              )}

              {phase === "cheer" && (
                <g>
                  {/* Joyful Starburst Eyes */}
                  <path d="M99 67 L101 71 L105 72 L101 73 L99 77 L97 73 L93 72 L97 71 Z" fill="#f59e0b" />
                  <path d="M121 67 L123 71 L127 72 L123 73 L121 77 L119 73 L115 72 L119 71 Z" fill="#f59e0b" />
                </g>
              )}
            </motion.g>

            {/* 3. Thought Cloud Graphic hovering in Phase: Wonder */}
            {phase === "wonder" && (
              <motion.g
                initial={{ opacity: 0, scale: 0.8, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.35 }}
              >
                {/* Ascending bubbles to cloud */}
                <circle cx="138" cy="38" r="3" fill="#c084fc" fillOpacity="0.6" />
                <circle cx="146" cy="28" r="4.5" fill="#c084fc" fillOpacity="0.75" />
                
                {/* Holographic Thought Cloud */}
                <g transform="translate(136, -2)">
                  <path
                    d="M18 18 C14 18 10 21 10 26 C6 26 2 29 2 34 C2 39 6 43 11 43 C13 46 17 48 21 48 C25 48 29 46 31 43 C35 43 39 39 39 35 C39 30 36 27 32 26 C32 21 27 18 22 18 Z"
                    fill="url(#cloudGrad)"
                    stroke="#e9d5ff"
                    strokeWidth="1.5"
                    className="shadow-md"
                  />
                  {/* Glowing Question Mark & Brackets inside Cloud */}
                  <text x="13" y="37" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    {"{?}"}
                  </text>
                </g>
              </motion.g>
            )}

            {/* 4. Storytelling Right Arm & Gadget Animations */}
            {/* State A: Waving Hello */}
            {(phase === "wave" || phase === "cheer") && (
              <motion.g
                initial={{ rotate: -15 }}
                animate={{
                  rotate: phase === "cheer" ? [-25, 25, -25, 25, -15] : [-15, 22, -15, 20, -15],
                }}
                transition={{
                  duration: phase === "cheer" ? 0.7 : 1.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ transformOrigin: "142px 114px" }}
              >
                {/* Arm raised waving */}
                <path
                  d="M140 114 C150 106 162 94 170 80 C173 75 177 77 176 82 C170 96 157 112 145 120 Z"
                  fill="#334155"
                  stroke="#475569"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {/* Waving Glove & Fingers */}
                <circle cx="173" cy="78" r="7.5" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                <path
                  d="M171 72 L175 66 M174 71 L179 67 M176 73 L182 71"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </motion.g>
            )}

            {/* State B: Thoughtfully Touching Chin */}
            {phase === "wonder" && (
              <motion.g
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <path
                  d="M140 116 C154 122 158 108 148 94 C144 89 139 90 138 94 C144 102 146 110 138 120 Z"
                  fill="#334155"
                  stroke="#475569"
                  strokeWidth="2"
                />
                <circle cx="137" cy="92" r="6.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
              </motion.g>
            )}

            {/* State C: Magnifying Glass & Ground Sonar Radar Search */}
            {phase === "scan" && (
              <motion.g
                initial={{ opacity: 0, x: -10, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: "backOut" }}
              >
                {/* Arm holding magnifying glass handle pointing downward */}
                <path
                  d="M140 116 C154 118 165 114 172 106 C175 102 173 98 168 99 C162 103 154 106 142 120 Z"
                  fill="#334155"
                  stroke="#475569"
                  strokeWidth="2"
                />
                <circle cx="172" cy="104" r="6.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

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
                  style={{ transformOrigin: "172px 104px" }}
                >
                  {/* Metallic Handle */}
                  <line
                    x1="172"
                    y1="104"
                    x2="186"
                    y2="84"
                    stroke="#64748b"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="172"
                    y1="104"
                    x2="186"
                    y2="84"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Downward Conical Radar Searchlight Beam */}
                  <polygon
                    points="192,76 230,140 160,175"
                    fill="url(#radarBeamGrad)"
                    className="animate-pulse"
                    style={{ animationDuration: "1.5s" }}
                  />

                  {/* Magnifying Glass Rim */}
                  <circle
                    cx="192"
                    cy="76"
                    r="19"
                    fill="url(#lensGlassGrad)"
                    stroke="#38bdf8"
                    strokeWidth="3.5"
                    className="shadow-xl"
                  />
                  {/* Internal Holographic Reticle */}
                  <circle
                    cx="192"
                    cy="76"
                    r="11"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.3"
                    strokeDasharray="3 2"
                  />
                  <line x1="183" y1="76" x2="201" y2="76" stroke="#06b6d4" strokeWidth="1.2" />
                  <line x1="192" y1="67" x2="192" y2="85" stroke="#06b6d4" strokeWidth="1.2" />

                  {/* Ground Radar Target on Floor */}
                  <g transform="translate(15, 0)">
                    <ellipse cx="180" cy="170" rx="28" ry="7.5" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 2" />
                    <ellipse cx="180" cy="170" rx="16" ry="4.5" fill="#06b6d4" fillOpacity="0.15" />
                    {/* Discovered API tokens popping up! */}
                    <g className="animate-pulse" style={{ animationDuration: "1.4s" }}>
                      <text x="165" y="166" fill="#34d399" fontSize="8" fontWeight="bold" fontFamily="monospace">
                        GET
                      </text>
                      <text x="186" y="174" fill="#fbbf24" fontSize="8" fontWeight="bold" fontFamily="monospace">
                        {"{ }"}
                      </text>
                    </g>
                  </g>
                </motion.g>
              </motion.g>
            )}

            {/* Sparkles Floating Around */}
            <path
              d="M46 88 L48 92 L52 94 L48 96 L46 100 L44 96 L40 94 L44 92 Z"
              fill="#38bdf8"
              className="animate-pulse"
              style={{ animationDuration: "2.5s" }}
            />
            <path
              d="M190 40 L191.5 43.5 L195 45 L191.5 46.5 L190 50 L188.5 46.5 L185 45 L188.5 43.5 Z"
              fill="#c084fc"
              className="animate-pulse"
              style={{ animationDuration: "3.2s", animationDelay: "0.6s" }}
            />
          </motion.g>
        </svg>
      </div>

      {/* Interactive Phase Indicator & Story Stepper */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => setPhase("wave")}
          className={cn(
            "text-[11px] px-3 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
            phase === "wave"
              ? "bg-primary/25 border-primary/50 text-primary font-semibold shadow-[0_0_12px_rgba(59,130,246,0.25)]"
              : "bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <span>👋</span>
          <span>Wave</span>
        </button>

        <button
          onClick={() => setPhase("wonder")}
          className={cn(
            "text-[11px] px-3 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
            phase === "wonder"
              ? "bg-purple-500/25 border-purple-500/50 text-purple-300 font-semibold shadow-[0_0_12px_rgba(168,85,247,0.25)]"
              : "bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <span>💭</span>
          <span>Where&apos;s API?</span>
        </button>

        <button
          onClick={() => setPhase("scan")}
          className={cn(
            "text-[11px] px-3 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
            phase === "scan"
              ? "bg-cyan-500/25 border-cyan-500/50 text-cyan-300 font-semibold shadow-[0_0_12px_rgba(6,182,212,0.25)]"
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
