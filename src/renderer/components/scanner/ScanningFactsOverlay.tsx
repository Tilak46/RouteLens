import React, { useState, useEffect } from "react";
import { X, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";

interface ScanningFactsOverlayProps {
  projectName?: string;
  onDismiss: () => void;
}

const DID_YOU_KNOW_FACTS = [
  "RouteLens discovers your API endpoints instantly—without needing your backend server to be running.",
  "Endpoints and controllers are automatically organized into clean, nested collection folders.",
  "100% offline and private by design: no cloud accounts, no tracking, and zero telemetry leaving your machine.",
  "Your request tabs, headers, and parameter configurations are automatically preserved across app restarts.",
  "Switch effortlessly between universal global variables and dedicated backend environment profiles.",
  "Press Ctrl+S anywhere in a request tab to quickly save and sync your API endpoints.",
  "Pre-request and post-response scripts support familiar Postman-compatible APIs out of the box.",
  "You can drag and reorder tabs, duplicate requests with a click, and manage multiple workspaces easily.",
];

const SCAN_STEPS = [
  "Indexing controllers and endpoints...",
  "Mapping route paths and methods...",
  "Organizing collection hierarchy...",
  "Preparing request templates...",
  "Finalizing workspace routes...",
];

export const ScanningFactsOverlay: React.FC<ScanningFactsOverlayProps> = ({
  projectName,
  onDismiss,
}) => {
  const [factIndex, setFactIndex] = useState(0);
  const [fadeAnim, setFadeAnim] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  // Cycle facts every 3.8 seconds with smooth fade
  useEffect(() => {
    const timer = setInterval(() => {
      setFadeAnim(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % DID_YOU_KNOW_FACTS.length);
        setFadeAnim(true);
      }, 200);
    }, 3800);

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
    <div className="flex-1 w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#0C0D12] select-none text-foreground p-8 overflow-hidden relative isolate">
      {/* Top right: Clean, understated dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 transition-colors cursor-pointer flex items-center gap-2 text-xs font-medium"
        title="Run in Background (Esc)"
      >
        <span>Run in background</span>
        <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-zinc-500 border border-white/10 font-mono">
          Esc
        </kbd>
        <X size={12} className="text-zinc-400" />
      </button>

      {/* Center Content Container */}
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-7 z-10">
        {/* RouteLens Minimalist Emblem */}
        <div className="relative flex items-center justify-center">
          {/* Very soft, elegant diffused glow */}
          <div
            className="absolute w-28 h-28 rounded-full pointer-events-none -z-10 opacity-30"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
            }}
          />

          {/* Logo Badge */}
          <div className="w-14 h-14 rounded-2xl bg-[#141721] border border-white/[0.1] flex items-center justify-center p-3 shadow-xl relative">
            <img src={logoImg} alt="RouteLens" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Title & Live Status */}
        <div className="space-y-2 w-full">
          {/* Clean Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-[11px] font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>AST Analysis</span>
          </div>

          {/* Project Header */}
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            {projectName ? (
              <span>
                Scanning <span className="font-semibold text-zinc-200 underline decoration-primary/40 underline-offset-4">{projectName}</span>
              </span>
            ) : (
              "Discovering Endpoints"
            )}
          </h2>

          {/* Current Step */}
          <p className="text-xs text-zinc-400 transition-all duration-300 h-5 flex items-center justify-center gap-2 font-normal">
            <RefreshCw size={11} className="animate-spin text-zinc-500" />
            <span>{currentStep}</span>
          </p>
        </div>

        {/* Precision Progress Indicator */}
        <div className="w-full max-w-xs">
          <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-primary/80 rounded-full animate-pulse shadow-sm shadow-primary/30 relative overflow-hidden" />
          </div>
        </div>

        {/* High-End "Did You Know?" Card */}
        <div className="w-full bg-[#12151E] border border-white/[0.08] rounded-xl p-5 shadow-2xl text-left space-y-2.5 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <Sparkles size={11} className="text-primary/90" />
              <span>Did you know?</span>
            </div>
            {/* Step Dots */}
            <div className="flex items-center gap-1">
              {DID_YOU_KNOW_FACTS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    i === factIndex ? "w-3 bg-primary" : "w-1 bg-white/10"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Fact Body */}
          <p
            className={cn(
              "text-xs text-zinc-300 leading-relaxed font-normal min-h-[38px] transition-all duration-200",
              fadeAnim ? "opacity-100 translate-y-0" : "opacity-0 translate-y-0.5"
            )}
          >
            {currentFact}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScanningFactsOverlay;