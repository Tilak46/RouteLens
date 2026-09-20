import React, { useState, useEffect, useMemo } from "react";
import { X, Sparkles, RefreshCw, FileCode, Network, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";
import apiClient from "@/lib/apiClient";
import type { ScanProgressUpdate } from "@/../types";

interface ScanningFactsOverlayProps {
  projectName?: string;
  projectPath?: string;
  onDismiss: () => void;
  onCancel?: () => void;
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

export const ScanningFactsOverlay: React.FC<ScanningFactsOverlayProps> = ({
  projectName,
  projectPath,
  onDismiss,
  onCancel,
}) => {
  const [progress, setProgress] = useState<ScanProgressUpdate | null>(null);
  const [factIndex, setFactIndex] = useState(0);
  const [fadeAnim, setFadeAnim] = useState(true);

  // Subscribe to live scan progress events locally (avoids root App re-renders)
  useEffect(() => {
    const unsub = apiClient.onScanProgress?.((update) => {
      if (!projectPath || update.projectPath === projectPath) {
        setProgress(update);
      }
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [projectPath]);

  // Cycle facts every 4 seconds with smooth fade
  useEffect(() => {
    const timer = setInterval(() => {
      setFadeAnim(false);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % DID_YOU_KNOW_FACTS.length);
        setFadeAnim(true);
      }, 200);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  // Allow ESC to dismiss overlay to background
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

  // Derived progress visuals
  const percent = Math.min(100, Math.max(progress ? progress.percent : 6, 0));

  const phaseLabel = useMemo(() => {
    if (!progress) return "Discovering Source Files";
    switch (progress.phase) {
      case "discovering":
        return "Indexing Source Files";
      case "linking":
        return "Mapping Controller Mounts";
      case "parsing":
        return "AST Syntax Tree Analysis";
      case "factory":
        return "Resolving Factory Routes";
      case "finalizing":
        return "Organizing Collections";
      case "done":
        return "Scan Complete";
      default:
        return "Discovering Endpoints";
    }
  }, [progress?.phase]);

  return (
    <div className="flex-1 w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#0C0D12] select-none text-foreground p-8 overflow-hidden relative isolate">
      {/* Top Controls: Dismiss (Run in background) & Cancel */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-rose-400 hover:text-rose-300 bg-rose-500/[0.06] hover:bg-rose-500/[0.12] border border-rose-500/20 rounded-lg px-3 py-1.5 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Cancel active scan"
          >
            <StopCircle size={13} className="text-rose-400" />
            <span>Cancel Scan</span>
          </button>
        )}

        <button
          onClick={onDismiss}
          className="text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 transition-colors cursor-pointer flex items-center gap-2 text-xs font-medium"
          title="Run in Background (Esc)"
        >
          <span>Run in background</span>
          <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-zinc-500 border border-white/10 font-mono">
            Esc
          </kbd>
          <X size={12} className="text-zinc-400" />
        </button>
      </div>

      {/* Center Content Container */}
      <div className="max-w-lg w-full flex flex-col items-center text-center space-y-6 z-10">
        {/* RouteLens Minimalist Emblem */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute w-32 h-32 rounded-full pointer-events-none -z-10 opacity-30"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)",
            }}
          />

          <div className="w-14 h-14 rounded-2xl bg-[#141721] border border-white/[0.1] flex items-center justify-center p-3 shadow-xl relative">
            <img src={logoImg} alt="RouteLens" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Title & Live Status */}
        <div className="space-y-2 w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-[11px] font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>{phaseLabel}</span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            {projectName ? (
              <span>
                Scanning{" "}
                <span className="font-semibold text-zinc-100 underline decoration-cyan-400/40 underline-offset-4">
                  {projectName}
                </span>
              </span>
            ) : (
              "Discovering Endpoints"
            )}
          </h2>

          <p className="text-xs text-zinc-400 h-5 flex items-center justify-center gap-2 font-normal truncate max-w-md mx-auto px-4">
            <RefreshCw size={11} className="animate-spin text-cyan-400 shrink-0" />
            <span className="truncate">{progress?.message || "Analyzing project endpoints..."}</span>
          </p>
        </div>

        {/* Real Dynamic Progress Bar Card */}
        <div className="w-full bg-[#12151E] border border-white/[0.08] rounded-xl p-5 shadow-2xl text-left space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-mono text-[11px]">Progress</span>
              <span className="text-cyan-400 font-mono font-bold text-xs tabular-nums">{percent}%</span>
            </div>

            {/* Glowing Smooth Progress Track */}
            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/[0.08] relative">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-sm shadow-cyan-400/50 relative"
                style={{ width: `${percent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              </div>
            </div>
          </div>

          {/* Live Metric Statistics Badges */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <FileCode size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Files Scanned</div>
                <div className="text-xs font-mono font-bold text-zinc-200 truncate">
                  {progress && progress.total > 0 ? `${progress.current} / ${progress.total}` : "Indexing..."}
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <Network size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Routes Found</div>
                <div className="text-xs font-mono font-bold text-cyan-300 truncate">
                  {progress ? progress.routesFound : 0}
                </div>
              </div>
            </div>
          </div>

          {/* Current File Subtext (if present) */}
          {progress?.currentFile && (
            <div className="text-[11px] font-mono text-zinc-400 bg-black/30 px-2.5 py-1.5 rounded border border-white/[0.05] truncate flex items-center gap-2">
              <span className="text-zinc-500 shrink-0">Target:</span>
              <span className="text-zinc-300 truncate">{progress.currentFile}</span>
            </div>
          )}
        </div>

        {/* High-End "Did You Know?" Card */}
        <div className="w-full bg-[#12151E]/70 border border-white/[0.06] rounded-xl p-4 shadow-xl text-left space-y-2 transition-all">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <Sparkles size={11} className="text-primary/90" />
            <span>Did you know?</span>
          </div>

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