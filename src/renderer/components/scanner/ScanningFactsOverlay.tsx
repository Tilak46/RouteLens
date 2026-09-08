import React, { useState, useEffect } from "react";
import { X, Sparkles, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";

interface ScanningFactsOverlayProps {
  projectName?: string;
  onDismiss: () => void;
}

const DID_YOU_KNOW_FACTS = [
  "RouteLens discovers your API endpoints instantly—without even needing your backend server to be running.",
  "Endpoints and controllers are automatically organized into clean, nested collection folders.",
  "100% offline and private by design: no cloud accounts, no tracking, and zero data leaves your machine.",
  "Your request tabs, headers, and parameter configurations are automatically preserved across app restarts.",
  "Switch effortlessly between universal global variables and dedicated backend environment profiles.",
  "Press Ctrl+S anywhere in a request tab to quickly save and update your API endpoints.",
  "Pre-request and post-response scripts support familiar Postman-compatible APIs out of the box.",
  "You can drag and reorder tabs, duplicate requests with a click, and manage multiple workspaces easily.",
];

const SCAN_STEPS = [
  "Indexing controllers and endpoints...",
  "Mapping route paths and methods...",
  "Organizing collection hierarchy...",
  "Preparing request templates...",
  "Finalizing project workspace...",
];

export const ScanningFactsOverlay: React.FC<ScanningFactsOverlayProps> = ({
  projectName,
  onDismiss,
}) => {
  const [factIndex, setFactIndex] = useState(0);
  const [fadeAnim, setFadeAnim] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  // Cycle facts every 3.6 seconds with smooth fade
  useEffect(() => {
    const timer = setInterval(() => {
      setFadeAnim(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % DID_YOU_KNOW_FACTS.length);
        setFadeAnim(true);
      }, 250);
    }, 3600);

    return () => clearInterval(timer);
  }, []);

  // Cycle status steps every 1.8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % SCAN_STEPS.length);
    }, 1800);

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

  const currentFact = DID_YOU_KNOW_FACTS[factIndex];
  const currentStep = SCAN_STEPS[stepIndex];

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#090A0F]/90 backdrop-blur-xl select-none text-foreground p-6 overflow-hidden animate-in fade-in duration-200">
      {/* Subtle background ambient glow */}
      <div className="absolute w-[460px] h-[460px] rounded-full bg-primary/10 blur-[120px] pointer-events-none -top-20 -left-20" />
      <div className="absolute w-[460px] h-[460px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none -bottom-20 -right-20" />

      {/* Top right: Clean dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-5 right-5 text-muted-foreground hover:text-foreground bg-white/[0.04] hover:bg-white/[0.08] rounded-lg px-3 py-1.5 transition-all cursor-pointer flex items-center gap-2 text-xs font-medium border border-white/[0.08]"
        title="Run in Background (Esc)"
      >
        <span>Run in background</span>
        <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-muted-foreground border border-white/10 font-mono">
          Esc
        </kbd>
        <X size={13} className="text-muted-foreground" />
      </button>

      {/* Center Content Container */}
      <div className="relative max-w-lg w-full flex flex-col items-center text-center space-y-7 z-10">
        
        {/* RouteLens Logo with Breathing Halo */}
        <div className="relative flex items-center justify-center">
          {/* Ambient Glow */}
          <div className="absolute w-24 h-24 rounded-full bg-primary/20 blur-xl animate-pulse" />
          
          {/* Subtle Outer Spinner Ring */}
          <div className="absolute w-20 h-20 rounded-2xl border border-primary/30 animate-spin" style={{ animationDuration: "8s" }} />

          {/* Logo Squircle Badge */}
          <div className="w-16 h-16 rounded-2xl bg-[#0D0F16] border border-white/10 flex items-center justify-center p-3 shadow-2xl shadow-primary/25 relative z-10">
            <img src={logoImg} alt="RouteLens" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Title & Live Status */}
        <div className="space-y-2">
          {/* Clean Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-semibold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span>Scanning Project</span>
          </div>

          {/* Project Header */}
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {projectName ? (
              <>
                Scanning <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-amber-300">{projectName}</span>
              </>
            ) : (
              "Discovering Endpoints"
            )}
          </h2>

          {/* Current Step */}
          <p className="text-xs text-muted-foreground transition-all duration-300 h-5 flex items-center justify-center gap-1.5 font-medium">
            <Compass size={13} className="text-primary/70 animate-spin" style={{ animationDuration: "4s" }} />
            <span className="text-zinc-300">{currentStep}</span>
          </p>
        </div>

        {/* Sleek Minimalist Progress Bar */}
        <div className="w-full max-w-xs">
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
            <div className="h-full bg-gradient-to-r from-primary via-amber-400 to-primary rounded-full animate-pulse shadow-sm shadow-primary/50 relative overflow-hidden" />
          </div>
        </div>

        {/* Elegant "Did You Know?" Card */}
        <div className="w-full bg-white/[0.025] border border-white/[0.08] rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center space-y-3 transition-all">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles size={11} />
            <span>Did you know?</span>
          </div>

          {/* Fact Body */}
          <p
            className={cn(
              "text-xs text-zinc-300 leading-relaxed font-normal min-h-[38px] transition-all duration-300 max-w-md mx-auto",
              fadeAnim ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            )}
          >
            &ldquo;{currentFact}&rdquo;
          </p>
        </div>

      </div>
    </div>
  );
};

export default ScanningFactsOverlay;