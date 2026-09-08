import React, { useState, useEffect } from "react";
import { Radar, Sparkles, Terminal, Layers, X, Cpu, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanningFactsOverlayProps {
  projectName?: string;
  onDismiss: () => void;
}

const SCAN_FACTS = [
  {
    tag: "ZERO RUNTIME OVERHEAD",
    fact: "RouteLens parses ASTs statically—your backend servers don't even need to be running to discover all endpoints.",
  },
  {
    tag: "DEEP ROUTER RESOLUTION",
    fact: "Chained Express and NestJS routers are detected and nested up to 8 directory levels deep with zero configuration.",
  },
  {
    tag: "SMART INFERENCE",
    fact: "Parameter schemas, query fields, and JSON request bodies are automatically inferred directly from AST handler signatures.",
  },
  {
    tag: "100% OFFLINE & PRIVATE",
    fact: "Zero cloud telemetry trackers: all your collections, workspaces, and environment variables stay strictly on your local machine.",
  },
  {
    tag: "SEAMLESS SCRIPTING",
    fact: "Pre-request and post-response scripts support standard Postman-compatible APIs (pm.environment & pm.globals).",
  },
  {
    tag: "MULTI-PASS INTERPOLATION",
    fact: "Environment variables resolve recursively, so {{baseUrl}}/api/{{version}} with nested secrets interpolates instantly.",
  },
];

const SCAN_PHASES = [
  "Initializing Babel AST engine & parser plugins...",
  "Traversing controller & router source AST nodes...",
  "Extracting HTTP methods: GET, POST, PUT, DEL, PAT...",
  "Analyzing middleware chains & route authorization probes...",
  "Mapping route parameter schemas & request body structures...",
  "Synthesizing hierarchical collection tree for workspace...",
];

export const ScanningFactsOverlay: React.FC<ScanningFactsOverlayProps> = ({
  projectName,
  onDismiss,
}) => {
  const [factIndex, setFactIndex] = useState(0);
  const [fadeAnim, setFadeAnim] = useState(true);
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Cycle facts every 3.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFadeAnim(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % SCAN_FACTS.length);
        setFadeAnim(true);
      }, 250);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // Cycle scanning phases every 1.6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % SCAN_PHASES.length);
    }, 1600);

    return () => clearInterval(timer);
  }, []);

  // Allow ESC to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  const currentFact = SCAN_FACTS[factIndex];
  const currentPhase = SCAN_PHASES[phaseIndex];

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#090A0F]/85 backdrop-blur-md select-none text-foreground p-6 overflow-hidden">
      {/* Background ambient radar glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-3xl pointer-events-none -top-24 -left-24 animate-pulse" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-amber-500/15 via-primary/5 to-transparent blur-3xl pointer-events-none -bottom-24 -right-24 animate-pulse" />

      {/* Close button top-right */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 rounded-lg p-2 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium border border-white/10 shadow-lg"
        title="Dismiss and run in background (Esc)"
      >
        <span>Run in Background</span>
        <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-muted-foreground border border-white/10 font-mono">
          Esc
        </kbd>
        <X size={14} className="ml-0.5" />
      </button>

      {/* Center Modal Card */}
      <div className="relative max-w-xl w-full flex flex-col items-center text-center space-y-6 z-10">
        
        {/* Animated Radar Pulse Core */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing Concentric Rings */}
          <div className="absolute w-28 h-28 rounded-full border border-primary/30 animate-ping opacity-40 duration-1000" />
          <div className="absolute w-24 h-24 rounded-full border border-primary/20 animate-pulse duration-700" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#181B24] to-[#0D0F16] border border-primary/40 flex items-center justify-center text-primary shadow-2xl shadow-primary/30 relative z-10">
            <Radar size={30} className="text-primary animate-spin" style={{ animationDuration: "3.5s" }} />
          </div>
        </div>

        {/* Header Titles */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-bold tracking-wider uppercase mb-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>AST Route Scanner Active</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            {projectName ? (
              <>
                Scanning <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-400 font-black">{projectName}</span>
              </>
            ) : (
              "Discovering Backend API Routes"
            )}
          </h2>

          <p className="text-xs text-muted-foreground flex items-center justify-center gap-2 font-mono">
            <Terminal size={12} className="text-primary" />
            <span className="text-zinc-300 font-medium">{currentPhase}</span>
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full max-w-md space-y-1.5">
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5 shadow-inner">
            <div className="h-full bg-gradient-to-r from-primary via-amber-500 to-primary rounded-full animate-pulse shadow-lg shadow-primary/50 relative overflow-hidden" />
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground/70 font-mono px-1">
            <span>Babel AST Engine</span>
            <span>Static Route Analysis</span>
          </div>
        </div>

        {/* Rotating Facts Card for Video Demo */}
        <div className="w-full max-w-lg bg-[#0F121A]/90 border border-primary/20 rounded-xl p-5 shadow-2xl backdrop-blur-md text-left relative overflow-hidden transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full pointer-events-none" />

          {/* Fact Badge Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles size={11} />
              <span>RouteLens Fact</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60 tracking-wider">
              {currentFact.tag}
            </span>
          </div>

          {/* Fact Content with Smooth Transition */}
          <p
            className={cn(
              "text-xs text-zinc-200 leading-relaxed font-normal min-h-[40px] transition-all duration-300",
              fadeAnim ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            )}
          >
            &ldquo;{currentFact.fact}&rdquo;
          </p>

          {/* Feature Badges Footer */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 size={11} />
              <span>Zero-Config</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400">
              <Cpu size={11} />
              <span>100% Offline</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400">
              <Layers size={11} />
              <span>Auto-Hierarchical</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ScanningFactsOverlay;