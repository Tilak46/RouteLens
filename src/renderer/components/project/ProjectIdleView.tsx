import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, FolderOpen, Sparkles, ArrowLeft } from "lucide-react";
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
    setTimeout(() => setIsJumping(false), 650);
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
    <div className="flex-grow flex flex-col items-center justify-center py-8 sm:py-12 px-6 select-none overflow-y-auto w-full animate-in fade-in duration-300">
      <div className="max-w-2xl w-full flex flex-col items-center text-center">
        {/* Floating Story / Dialogue Bubble */}
        <div className="h-20 flex items-end justify-center mb-3 z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={`bubble-${clickCount}`}
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative px-4 py-2.5 rounded-2xl bg-[#131722]/98 border border-primary/40 shadow-[0_8px_30px_rgba(0,0,0,0.35)] text-center flex items-center gap-3 cursor-pointer hover:border-primary/70 transition-colors"
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
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#131722] border-r border-b border-primary/40 rotate-45" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Central Visual: Animated SS2 Victor Mascot (Click to Jump / Easter Egg) */}
        <div className="relative flex flex-col items-center my-2 select-none isolate">
          {/* Ambient Cosmic Lighting Aura (Pure CSS Radial Gradient - zero GPU blur filter overhead) */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none -z-10 animate-pulse"
            style={{
              animationDuration: "4s",
              background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(6,182,212,0.10) 45%, transparent 70%)"
            }}
          />

          {/* Interactive Mascot SVG with GPU-accelerated CSS Keyframes */}
          <div
            onClick={handleVictorClick}
            className="relative cursor-pointer group"
            title="Click me to test reactions!"
          >
            <div
              className={cn(
                "transition-transform duration-200 transform-gpu",
                isJumping ? "animate-victor-jump" : "animate-victor-float"
              )}
            >
                  <svg
                    width="180"
                    height="170"
                    viewBox="0 0 160 160"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="overflow-visible"
                  >
                  {/* Background Twinkling Stars */}
                  <path
                    d="M32 38 L34 43 L39 45 L34 47 L32 52 L30 47 L25 45 L30 43 Z"
                    fill="currentColor"
                    className="text-zinc-500/40 animate-pulse"
                    style={{ animationDuration: "3s" }}
                  />
                  <path
                    d="M138 68 L139.5 71.5 L143 73 L139.5 74.5 L138 78 L136.5 74.5 L133 73 L136.5 71.5 Z"
                    fill="currentColor"
                    className="text-zinc-500/50 animate-pulse"
                    style={{ animationDuration: "2.4s", animationDelay: "0.8s" }}
                  />
                  <path
                    d="M26 95 L27.5 98 L31 99.5 L27.5 101 L26 104 L24.5 101 L21 99.5 L24.5 98 Z"
                    fill="currentColor"
                    className="text-zinc-500/30"
                  />

                  {/* Mini Rocket in Background */}
                  <g transform="translate(122, 22) rotate(42)">
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
                    <circle cx="0" cy="-2" r="3.2" fill="#38bdf8" fillOpacity="0.4" stroke="#38bdf8" strokeWidth="1.2" />
                    {/* Left Fin */}
                    <path d="M-7 8 L-13 15 L-7 14 Z" fill="#0f172a" stroke="currentColor" strokeWidth="1.6" className="text-zinc-300" />
                    {/* Right Fin */}
                    <path d="M7 8 L13 15 L7 14 Z" fill="#0f172a" stroke="currentColor" strokeWidth="1.6" className="text-zinc-300" />
                    {/* Flame */}
                    <path
                      d="M-3 15 C-4 21 0 25 0 25 C0 25 4 21 3 15 Z"
                      fill="#f97316"
                      fillOpacity="0.85"
                      className="animate-pulse"
                    />
                  </g>
                  {/* Curved Smoke Trail */}
                  <path
                    d="M125 42 Q112 58 116 75 T110 95"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeDasharray="3 3"
                    strokeLinecap="round"
                    className="text-zinc-600/60"
                  />

                  {/* Astronaut Mascot */}
                  <g>
                    {/* Antenna */}
                    <line
                      x1="76"
                      y1="34"
                      x2="76"
                      y2="18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="text-zinc-400"
                    />
                    {/* Glowing Beacon on Antenna Tip */}
                    <circle cx="76" cy="14" r="4" fill="#f97316" className="animate-pulse" />
                    <circle cx="76" cy="14" r="6" fill="#f97316" fillOpacity="0.3" className="animate-ping origin-center" />

                    {/* Helmet Outer Shell */}
                    <circle
                      cx="76"
                      cy="65"
                      r="32"
                      fill="#0f172a"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-zinc-200"
                    />
                    {/* Left Earmuff */}
                    <rect x="41" y="56" width="6" height="18" rx="3" fill="#1e293b" stroke="currentColor" strokeWidth="2" className="text-zinc-400" />
                    {/* Right Earmuff */}
                    <rect x="105" y="56" width="6" height="18" rx="3" fill="#1e293b" stroke="currentColor" strokeWidth="2" className="text-zinc-400" />

                    {/* Visor */}
                    <rect
                      x="53"
                      y="48"
                      width="46"
                      height="34"
                      rx="16"
                      fill="#090d16"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-cyan-400/60"
                    />

                    {/* Cute Face Inside Visor (SS2) */}
                    {/* Left Eye */}
                    <ellipse cx="68" cy="63" rx="2.5" ry="3.2" fill="#ffffff" />
                    <circle cx="67" cy="62" r="1" fill="#09090b" />
                    {/* Right Eye */}
                    <ellipse cx="84" cy="63" rx="2.5" ry="3.2" fill="#ffffff" />
                    <circle cx="83" cy="62" r="1" fill="#09090b" />
                    {/* Rosy Cheeks */}
                    <ellipse cx="63" cy="68" rx="2.5" ry="1.4" fill="#fb7185" fillOpacity="0.55" />
                    <ellipse cx="89" cy="68" rx="2.5" ry="1.4" fill="#fb7185" fillOpacity="0.55" />
                    {/* Sweet Smile */}
                    <path
                      d="M72 71 Q76 75 80 71"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                    />

                    {/* Spacesuit Collar */}
                    <path
                      d="M58 94 Q76 102 94 94"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="text-zinc-300"
                    />

                    {/* Smooth V-Tapered U-Shape Spacesuit Torso */}
                    <path
                      d="M52 101 C52 118 63 138 76 138 C89 138 100 118 100 101 Z"
                      fill="#0f172a"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      className="text-zinc-300"
                    />

                    {/* Chest Control Box */}
                    <rect
                      x="68"
                      y="104"
                      width="16"
                      height="11"
                      rx="2.5"
                      fill="#1e293b"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-zinc-500"
                    />
                    <circle cx="73" cy="109.5" r="1.8" fill="#f97316" />
                    <circle cx="79" cy="109.5" r="1.8" fill="#06b6d4" />

                    {/* Left Arm Pointing to Watch */}
                    <path
                      d="M52 103 C41 113 45 127 62 130"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      fill="none"
                      className="text-zinc-300"
                    />

                    {/* Right Arm Holding Watch */}
                    <path
                      d="M100 103 C110 113 99 129 84 129"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      fill="none"
                      className="text-zinc-300"
                    />

                    {/* Smart Radar Scanner Watch */}
                    <circle
                      cx="73"
                      cy="129"
                      r="6.5"
                      fill="#0f172a"
                      stroke="#f97316"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M73 129 L77 125"
                      stroke="#f97316"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="73" cy="129" r="1.5" fill="#f97316" />
                  </g>
                </svg>
              </div>
            </div>
          </div>

        {/* Clean Project Identity */}
        <div className="mt-5 mb-7 flex flex-col items-center gap-2">
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
