import React, { useState, useEffect, useCallback } from "react";
import { FolderOpen, Sparkles, Zap, ArrowRight, FolderDown } from "lucide-react";
import { OnboardingMascot } from "./OnboardingMascot";
import { cn } from "@/lib/utils";

type OnboardingViewProps = {
  onOpenFolder: (folderPath?: string) => void;
  onQuickRequest: () => void;
  onLoadDemo: () => void;
  onOpenManualModal?: () => void;
  appVersion?: string;
};

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onOpenFolder,
  onQuickRequest,
  onLoadDemo,
  onOpenManualModal,
  appVersion,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes inside form controls
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Open Project: Ctrl+O or O
      if ((e.ctrlKey || e.metaKey) && key === "o") {
        e.preventDefault();
        onOpenFolder();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === "o") {
        e.preventDefault();
        onOpenFolder();
        return;
      }

      // Demo Project: D
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === "d") {
        e.preventDefault();
        onLoadDemo();
        return;
      }

      // Quick Request: Ctrl+T or N
      if ((e.ctrlKey || e.metaKey) && key === "t") {
        e.preventDefault();
        onQuickRequest();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === "n") {
        e.preventDefault();
        onQuickRequest();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenFolder, onLoadDemo, onQuickRequest]);

  // Drag & Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the component window
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        // In Electron Chromium, file object contains the full OS file path
        const droppedPath = (files[0] as any).path;
        if (droppedPath) {
          onOpenFolder(droppedPath);
        }
      }
    },
    [onOpenFolder]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full max-w-3xl mx-auto py-8 px-4 flex flex-col items-center select-none animate-in fade-in duration-300"
    >
      {/* Drag & Drop Holographic Perimeter Frame (Never obscures or blurs Victor!) */}
      {isDragging && (
        <div className="absolute inset-0 z-10 rounded-3xl border-2 border-dashed border-cyan-400/80 bg-cyan-500/[0.03] shadow-[0_0_50px_rgba(6,182,212,0.25),inset_0_0_40px_rgba(6,182,212,0.08)] pointer-events-none animate-pulse" />
      )}

      {/* Hero: Soulful Mascot as the Center of Attraction */}
      <div className="relative z-20 flex flex-col items-center mb-5">
        <OnboardingMascot isDragging={isDragging} />
      </div>

      {/* Clean, Confident Typography */}
      <div className="relative z-20 text-center max-w-lg mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mb-2 flex items-center justify-center gap-2">
          <span>
            Welcome to{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              RouteLens
            </span>
          </span>
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 align-middle">
            v{appVersion || "0.1.0"}
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Connect your local backend to automatically discover, test, and monitor
          your API routes in real-time.
        </p>
      </div>

      {/* Drag & Drop Pro-Tip Badge */}
      <div
        className={cn(
          "relative z-20 inline-flex items-center gap-2 text-xs rounded-full px-4 py-1.5 mb-7 transition-all duration-300 shadow-sm",
          isDragging
            ? "text-cyan-300 bg-cyan-500/15 border-2 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            : "text-muted-foreground/90 bg-card/60 hover:bg-card/90 border border-border/60 hover:border-primary/40"
        )}
      >
        <FolderDown
          size={14}
          className={cn(
            isDragging ? "text-cyan-400 animate-bounce" : "text-primary animate-bounce"
          )}
        />
        <span>
          {isDragging ? (
            <strong>Drop anywhere inside to start scanning!</strong>
          ) : (
            <>
              Tip: You can <strong>drag &amp; drop</strong> any backend folder anywhere to scan
            </>
          )}
        </span>
      </div>

      {/* 3 Balanced Action Cards */}
      <div className="relative z-20 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-8">
        {/* Card 1: Open Project (Primary) */}
        <div
          onClick={() => onOpenFolder()}
          className={cn(
            "group relative flex flex-col justify-between p-5 rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden",
            isDragging
              ? "bg-primary/20 border-2 border-dashed border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.35)] scale-[1.02]"
              : "bg-card/40 hover:bg-card/70 border border-primary/50 hover:border-primary shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_36px_rgba(59,130,246,0.22)] hover:-translate-y-0.5"
          )}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3.5 group-hover:scale-105 transition-transform">
              <FolderOpen size={20} />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5 flex items-center justify-between">
              <span>Open or Drop Folder</span>
              <ArrowRight
                size={14}
                className="text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
              />
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Drag &amp; drop or select your Express, Next.js, Fastify or NestJS backend folder.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] font-semibold text-primary">
            <span className="flex items-center gap-1.5">
              <FolderDown size={13} className="text-primary" />
              <span>Drop or Choose Folder</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 border border-primary/25 text-primary">
              Ctrl+O
            </kbd>
          </div>
        </div>

        {/* Card 2: Explore Demo API */}
        <div
          onClick={onLoadDemo}
          className={cn(
            "group relative flex flex-col justify-between p-5 rounded-2xl bg-card/30 hover:bg-card/60 border border-border/50 hover:border-emerald-500/50 transition-all duration-200 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_36px_rgba(16,185,129,0.15)] hover:-translate-y-0.5 overflow-hidden",
            isDragging && "opacity-50 pointer-events-none"
          )}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3.5 group-hover:scale-105 transition-transform">
              <Sparkles size={20} />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5 flex items-center justify-between">
              <span>Explore Demo API</span>
              <ArrowRight
                size={14}
                className="text-emerald-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
              />
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore a sample Store &amp; Auth API with pre-populated endpoints
              and cookies.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] font-semibold text-muted-foreground group-hover:text-emerald-400 transition-colors">
            <span>Load Sample</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/50 border border-border/40 text-muted-foreground group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
              D
            </kbd>
          </div>
        </div>

        {/* Card 3: Quick Request */}
        <div
          onClick={onQuickRequest}
          className={cn(
            "group relative flex flex-col justify-between p-5 rounded-2xl bg-card/30 hover:bg-card/60 border border-border/50 hover:border-amber-500/50 transition-all duration-200 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_36px_rgba(245,158,11,0.15)] hover:-translate-y-0.5 overflow-hidden",
            isDragging && "opacity-50 pointer-events-none"
          )}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3.5 group-hover:scale-105 transition-transform">
              <Zap size={20} />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5 flex items-center justify-between">
              <span>Quick API Request</span>
              <ArrowRight
                size={14}
                className="text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
              />
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Send a fast GET, POST, or custom request to any URL without a
              project.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] font-semibold text-muted-foreground group-hover:text-amber-400 transition-colors">
            <span>New Request</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/50 border border-border/40 text-muted-foreground group-hover:text-amber-400 group-hover:border-amber-500/30 transition-colors">
              Ctrl+T
            </kbd>
          </div>
        </div>
      </div>

      {/* Subtle, Clean Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
        <span>Supports Express, Next.js, NestJS, Fastify &amp; Hono</span>
        {onOpenManualModal && (
          <>
            <span>•</span>
            <button
              onClick={onOpenManualModal}
              className="hover:text-foreground transition-colors underline underline-offset-2 cursor-pointer"
            >
              Manual Config
            </button>
          </>
        )}
        <span>•</span>
        <span className="font-mono text-muted-foreground/80">v{appVersion || "0.1.0"}</span>
      </div>
    </div>
  );
};
