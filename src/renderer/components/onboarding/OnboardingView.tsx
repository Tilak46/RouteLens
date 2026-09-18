import React, { useState, useEffect, useCallback } from "react";
import { FolderOpen, Sparkles, Zap, ArrowRight, FolderDown } from "lucide-react";
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
      className="relative w-full max-w-2xl mx-auto py-12 px-6 flex flex-col items-center select-none"
    >
      {/* Clean, Minimal Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-2 z-30 rounded-2xl border border-dashed border-white/20 bg-[#0e0f14]/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 pointer-events-none">
          <FolderDown size={28} className="text-foreground/80 mb-3" />
          <span className="text-sm font-medium text-foreground tracking-tight mb-1">
            Drop your project folder here
          </span>
          <span className="text-xs text-muted-foreground/60">
            RouteLens will scan and map all endpoints
          </span>
        </div>
      )}

      {/* Clean, Minimal Header */}
      <div className="relative z-20 text-center max-w-md mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight mb-2">
          RouteLens
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground/80 leading-relaxed">
          Connect your local backend to discover and test API routes in real-time.
        </p>
      </div>

      {/* Subtle Drag & Drop Note */}
      <div className="relative z-20 inline-flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 mb-8 text-muted-foreground/60 bg-white/[0.02]">
        <FolderDown size={13} className="text-muted-foreground/70" />
        <span>Drag and drop a backend folder anywhere to scan</span>
      </div>

      {/* Minimal Action Items */}
      <div className="relative z-20 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-10">
        {/* Card 1: Open Project */}
        <div
          onClick={() => onOpenFolder()}
          className={cn(
            "group relative flex flex-col justify-between p-4 rounded-xl transition-colors duration-150 cursor-pointer",
            isDragging
              ? "bg-white/[0.08]"
              : "bg-white/[0.025] hover:bg-white/[0.05]"
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                <h3 className="text-xs font-semibold text-foreground">
                  Open Project
                </h3>
              </div>
              <ArrowRight
                size={12}
                className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed pl-6">
              Select or drop an Express, Next.js, Fastify or NestJS backend.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground/60 pl-6">
            <span>Choose folder</span>
            <kbd className="font-mono px-1 py-0.5 rounded bg-white/[0.04] text-muted-foreground/70">
              Ctrl+O
            </kbd>
          </div>
        </div>

        {/* Card 2: Explore Demo API */}
        <div
          onClick={onLoadDemo}
          className={cn(
            "group relative flex flex-col justify-between p-4 rounded-xl transition-colors duration-150 cursor-pointer",
            isDragging
              ? "opacity-50 pointer-events-none bg-white/[0.025]"
              : "bg-white/[0.025] hover:bg-white/[0.05]"
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                <h3 className="text-xs font-semibold text-foreground">
                  Explore Demo
                </h3>
              </div>
              <ArrowRight
                size={12}
                className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed pl-6">
              Sample Store &amp; Auth API with pre-populated endpoints.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground/60 pl-6">
            <span>Load sample</span>
            <kbd className="font-mono px-1 py-0.5 rounded bg-white/[0.04] text-muted-foreground/70">
              D
            </kbd>
          </div>
        </div>

        {/* Card 3: Quick Request */}
        <div
          onClick={onQuickRequest}
          className={cn(
            "group relative flex flex-col justify-between p-4 rounded-xl transition-colors duration-150 cursor-pointer",
            isDragging
              ? "opacity-50 pointer-events-none bg-white/[0.025]"
              : "bg-white/[0.025] hover:bg-white/[0.05]"
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                <h3 className="text-xs font-semibold text-foreground">
                  Quick Request
                </h3>
              </div>
              <ArrowRight
                size={12}
                className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed pl-6">
              Send a request to any URL without a project.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground/60 pl-6">
            <span>New request</span>
            <kbd className="font-mono px-1 py-0.5 rounded bg-white/[0.04] text-muted-foreground/70">
              Ctrl+T
            </kbd>
          </div>
        </div>
      </div>

      {/* Clean Footer */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/50">
        <span>Supports any backend or full-stack framework</span>
        {onOpenManualModal && (
          <>
            <span>•</span>
            <button
              onClick={onOpenManualModal}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Manual Config
            </button>
          </>
        )}
      </div>
    </div>
  );
};
