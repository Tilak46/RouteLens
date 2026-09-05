import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, FolderOpen, Sparkles, Zap, ArrowLeft } from "lucide-react";
import { Project } from "@/../types";
import { cn } from "@/lib/utils";

interface ProjectIdleViewProps {
  project: Project;
  totalEndpoints: number;
  isScanning: boolean;
  onNewTab: () => void;
  onRescan: () => void;
  onRevealInExplorer: () => void;
}

const VICTOR_COPILOT_QUOTES = [
  {
    icon: "🚀",
    title: "All systems green!",
    sub: "Ready to test whenever you are, commander!",
  },
  {
    icon: "⚡",
    title: "Speed of light!",
    sub: "Press Ctrl+T to open a fresh scratchpad request in a snap!",
  },
  {
    icon: "📡",
    title: "Radar active!",
    sub: "I'm monitoring your codebase for any new route changes in real-time!",
  },
  {
    icon: "☕",
    title: "Grab your coffee!",
    sub: "Cookies, headers & tokens are automatically synchronized across tabs.",
  },
  {
    icon: "🎯",
    title: "Target acquired!",
    sub: "Click any route in the left sidebar to inspect its full contract!",
  },
];

export const ProjectIdleView: React.FC<ProjectIdleViewProps> = ({
  project,
  totalEndpoints,
  isScanning,
  onNewTab,
  onRescan,
  onRevealInExplorer,
}) => {
  const [clickCount, setClickCount] = useState(0);
  const [isJumping, setIsJumping] = useState(false);

  const handleVictorClick = () => {
    setClickCount((c) => c + 1);
    setIsJumping(true);
    setTimeout(() => setIsJumping(false), 700);
  };

  const activeQuote =
    clickCount === 0
      ? {
          icon: "🚀",
          title: `${project.name} is standing by!`,
          sub:
            totalEndpoints > 0
              ? `${totalEndpoints} endpoints discovered & ready for testing.`
              : "Ready to scan routes and controllers.",
        }
      : VICTOR_COPILOT_QUOTES[(clickCount - 1) % VICTOR_COPILOT_QUOTES.length];

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-10 sm:py-14 px-6 select-none overflow-y-auto w-full animate-in fade-in duration-300">
      <div className="max-w-2xl w-full flex flex-col items-center text-center">
        {/* Floating Story / Dialogue Bubble */}
        <div className="h-20 flex items-end justify-center mb-4 z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={`bubble-${clickCount}`}
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative px-4 py-2.5 rounded-2xl bg-card/95 border border-primary/40 backdrop-blur-md shadow-[0_8px_30px_rgba(59,130,246,0.2)] text-center flex items-center gap-3 cursor-pointer hover:border-primary/70 transition-colors"
              onClick={handleVictorClick}
              title="Click Victor for co-pilot tips!"
            >
              <span className="text-2xl animate-bounce" style={{ animationDuration: "2s" }}>
                {activeQuote.icon}
              </span>
              <div className="text-left">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  {activeQuote.title}
                  <Sparkles size={11} className="text-cyan-400 animate-spin" style={{ animationDuration: "3s" }} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {activeQuote.sub}
                </div>
              </div>
              {/* Pointy speech arrow */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card/95 border-r border-b border-primary/40 rotate-45" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Central Visual: Animated Victor Mascot */}
        <div className="relative flex flex-col items-center my-3 select-none">
          {/* Ambient Cosmic Lighting Aura */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-blue-500/10 via-cyan-500/15 to-indigo-500/10 blur-3xl rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: "4s" }} />

          {/* Floating Orbiting Cyber Glyphs - Positioned safely away from Victor & speech bubble */}
          <motion.div
            animate={{ y: [0, -8, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-12 -left-16 text-cyan-400/60 font-mono text-sm pointer-events-none"
          >
            {"{ }"}
          </motion.div>
          <motion.div
            animate={{ y: [0, 8, 0], rotate: [0, -10, 0] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute top-8 -right-16 text-amber-400/60 font-mono text-sm pointer-events-none"
          >
            <Zap size={15} />
          </motion.div>
          <motion.div
            animate={{ y: [0, -6, 0], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-10 -left-14 text-indigo-400/50 text-xs pointer-events-none"
          >
            ✦
          </motion.div>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
            className="absolute bottom-8 -right-16 text-emerald-400/60 font-mono text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 pointer-events-none"
          >
            GET
          </motion.div>

          {/* Mascot SVG */}
          <div
            onClick={handleVictorClick}
            className="relative cursor-pointer group"
            title="Click me for co-pilot tips!"
          >
            <svg
              width="210"
              height="180"
              viewBox="0 0 240 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="overflow-visible"
            >
              <defs>
                {/* Visor Glass Gradient */}
                <linearGradient id="visorIdleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0b1329" />
                  <stop offset="65%" stopColor="#111c3a" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.5" />
                </linearGradient>

                {/* Visor Glint Reflection */}
                <linearGradient id="glintIdleGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                  <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </linearGradient>

                {/* Radar beam filter */}
                <linearGradient id="radarIdleBeam" x1="0" y1="0" x2="0.3" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.75" />
                  <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Shadow Base */}
              <motion.ellipse
                cx="110"
                cy="190"
                rx="34"
                ry="7"
                fill="currentColor"
                className="text-primary/25"
                animate={{
                  rx: isJumping ? [34, 20, 34] : [34, 28, 34],
                  opacity: isJumping ? [0.4, 0.15, 0.4] : [0.3, 0.2, 0.3],
                }}
                transition={{
                  duration: isJumping ? 0.6 : 3.4,
                  repeat: isJumping ? 1 : Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Floating Character Group */}
              <motion.g
                animate={{
                  y: isJumping ? [0, -14, 0] : [0, -7, 0],
                }}
                transition={{
                  duration: isJumping ? 0.6 : 3.4,
                  repeat: isJumping ? 1 : Infinity,
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
                {/* Thruster Vents */}
                <rect x="85" y="158" width="16" height="8" rx="3" fill="#334155" />
                <rect x="119" y="158" width="16" height="8" rx="3" fill="#334155" />
                {/* Status LEDs on Backpack */}
                <circle cx="84" cy="114" r="2.5" fill="#10b981" />
                <circle cx="92" cy="114" r="2.5" fill="#06b6d4" />
                <circle cx="100" cy="114" r="2.5" fill="#f59e0b" />

                {/* Astronaut Legs & Boots */}
                <rect x="87" y="152" width="18" height="26" rx="8" fill="#334155" stroke="#475569" strokeWidth="2" />
                <rect x="115" y="152" width="18" height="26" rx="8" fill="#334155" stroke="#475569" strokeWidth="2" />
                {/* Boot Soles */}
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
                {/* Mission Status Bar */}
                <rect x="94" y="120" width="32" height="4.5" rx="2" fill="#06b6d4" fillOpacity="0.85" className="animate-pulse" />
                {/* Status Dot */}
                <circle cx="98" cy="131" r="2.5" fill="#10b981" />
                <line x1="104" y1="131" x2="122" y2="131" stroke="#475569" strokeWidth="2" strokeLinecap="round" />

                {/* Left Arm (Relaxed, Resting Natural Glove) */}
                <g>
                  <circle cx="80" cy="114" r="7.5" fill="#334155" stroke="#475569" strokeWidth="2" />
                  <path
                    d="M80 114 C73 125 71 138 74 148 C75 151 79 152 82 150 C85 147 84 143 83 138 C81 130 83 122 86 116 Z"
                    fill="#334155"
                    stroke="#475569"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <ellipse cx="76" cy="151" rx="5" ry="3.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                </g>

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

                {/* Antenna Beacon Tip with SVG Pulse */}
                <circle cx="110" cy="16" r="4.5" fill="#f97316" className="animate-pulse" />
                <circle cx="110" cy="16" r="5" fill="#f97316" fillOpacity="0.35">
                  <animate attributeName="r" values="4;8.5;4" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.65;0.05;0.65" dur="1.8s" repeatCount="indefinite" />
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

                {/* Earmuffs */}
                <rect x="70" y="62" width="7" height="20" rx="3.5" fill="#1e293b" stroke="currentColor" strokeWidth="2" className="text-zinc-400" />
                <rect x="143" y="62" width="7" height="20" rx="3.5" fill="#1e293b" stroke="currentColor" strokeWidth="2" className="text-zinc-400" />

                {/* Visor Bezel */}
                <rect
                  x="78"
                  y="49"
                  width="64"
                  height="46"
                  rx="20"
                  fill="#030712"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-cyan-400/60"
                />

                {/* Visor Glass */}
                <rect
                  x="80"
                  y="51"
                  width="60"
                  height="42"
                  rx="18"
                  fill="url(#visorIdleGrad)"
                />

                {/* Glint Reflection */}
                <path
                  d="M86 54 C100 52 120 52 134 57 C130 63 118 64 102 63 C94 62 89 58 86 54 Z"
                  fill="url(#glintIdleGrad)"
                />

                {/* Rosy Cheeks */}
                <ellipse cx="91" cy="79" rx="4" ry="2.2" fill="#fb7185" fillOpacity="0.45" />
                <ellipse cx="129" cy="79" rx="4" ry="2.2" fill="#fb7185" fillOpacity="0.45" />

                {/* Expressive Visor Eyes: Alert & Happy Co-Pilot */}
                <g>
                  <circle cx="99" cy="72" r="4.2" fill="#38bdf8" />
                  <circle cx="101" cy="70.5" r="1.6" fill="#ffffff" />
                  <circle cx="121" cy="72" r="4.2" fill="#38bdf8" />
                  <circle cx="123" cy="70.5" r="1.6" fill="#ffffff" />
                  {/* Gentle digital scanline accent */}
                  <line x1="88" y1="72" x2="132" y2="72" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.35" strokeDasharray="2 2" />
                </g>

                {/* Right Arm: Holding Cyber Tablet Diagnostic Pad */}
                <g>
                  {/* Shoulder */}
                  <circle cx="140" cy="114" r="7.5" fill="#334155" stroke="#475569" strokeWidth="2" />
                  {/* Sleeve */}
                  <path
                    d="M139 113 C148 111 158 114 165 124 C167 127 165 131 161 133 C155 134 149 127 141 123 Z"
                    fill="#334155"
                    stroke="#475569"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {/* Glove */}
                  <circle cx="166" cy="129" r="6.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />

                  {/* Holographic Cyber Tablet */}
                  <g transform="translate(162, 110)">
                    <rect
                      x="0"
                      y="0"
                      width="28"
                      height="36"
                      rx="4"
                      fill="#0f172a"
                      stroke="#38bdf8"
                      strokeWidth="1.8"
                      className="shadow-lg"
                    />
                    {/* Tablet Screen */}
                    <rect x="2.5" y="3" width="23" height="30" rx="2" fill="#0284c7" fillOpacity="0.25" />
                    {/* Glowing Route Code Icon */}
                    <text x="7" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                      {"{ }"}
                    </text>
                    <line x1="6" y1="22" x2="22" y2="22" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="6" y1="27" x2="18" y2="27" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" />
                  </g>
                </g>
              </motion.g>
            </svg>
          </div>
        </div>

        {/* Clean Project Identity */}
        <div className="mt-6 mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              {project.name}
            </h2>
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
            <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
              {totalEndpoints} {totalEndpoints === 1 ? "Route" : "Routes"}
            </span>
          </div>

          <button
            onClick={onRevealInExplorer}
            className="text-xs text-muted-foreground/75 hover:text-foreground font-mono flex items-center gap-2 px-3 py-1 rounded-lg bg-card/40 border border-border/30 hover:border-primary/40 transition-all duration-200 group cursor-pointer mt-1 shadow-sm"
            title="Reveal project in Explorer"
          >
            <FolderOpen size={12} className="group-hover:text-primary transition-colors shrink-0 text-muted-foreground/60" />
            <span className="truncate max-w-xs sm:max-w-md">{project.path}</span>
          </button>
        </div>

        {/* Just 2 Clean, Tactile Action Buttons with Generous Breathing Room */}
        <div className="flex items-center justify-center gap-3.5 w-full max-w-md">
          {/* Primary: New Request */}
          <button
            onClick={onNewTab}
            className="group flex-1 relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all duration-200 shadow-[0_6px_24px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.45)] hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus size={15} className="group-hover:rotate-90 transition-transform duration-200" />
            <span>New Request</span>
            <kbd className="text-[10px] font-mono bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded ml-1">
              Ctrl+T
            </kbd>
          </button>

          {/* Secondary: Rescan Codebase */}
          <button
            onClick={onRescan}
            disabled={isScanning}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-card/60 hover:bg-card/90 border border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground text-xs font-semibold transition-all duration-200 shadow-sm hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(isScanning && "animate-spin text-primary")} />
            <span>{isScanning ? "Scanning..." : "Rescan AST"}</span>
          </button>
        </div>

        {/* Subtle Friendly Sidebar Cue */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60 mt-8 mb-2">
          <ArrowLeft size={12} className="text-primary/70 animate-pulse" />
          <span>Pick any route from the sidebar to inspect parameters &amp; test</span>
        </div>
      </div>
    </div>
  );
};

