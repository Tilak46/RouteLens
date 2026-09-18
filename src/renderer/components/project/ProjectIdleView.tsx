import React from "react";
import { Plus, RefreshCw, FolderOpen, Compass, CornerDownLeft, Home } from "lucide-react";
import { Project } from "@/../types";

interface ProjectIdleViewProps {
  project: Project;
  totalEndpoints: number;
  isScanning: boolean;
  onNewTab: () => void;
  onRescan: () => void;
  onCancelScan?: () => void;
  onRevealInExplorer: () => void;
  onCloseProject?: () => void;
}

export const ProjectIdleView: React.FC<ProjectIdleViewProps> = ({
  project,
  totalEndpoints,
  isScanning,
  onNewTab,
  onRescan,
  onCancelScan,
  onRevealInExplorer,
  onCloseProject,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 select-none overflow-y-auto w-full animate-in fade-in duration-200">
      <div className="max-w-md w-full flex flex-col items-center text-center">
        {/* Sleek Minimalist Emblem */}
        <div className="w-11 h-11 rounded-xl bg-white/[0.03]  flex items-center justify-center text-foreground/80 mb-3 shadow-sm">
          <Compass size={20} strokeWidth={1.75} />
        </div>

        {/* Project Identity */}
        <div className="flex flex-col items-center gap-1.5 mb-5">
          <h2 className="text-[16px] font-medium text-foreground tracking-tight">
            {project.name}
          </h2>

          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground/70">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>{totalEndpoints} {totalEndpoints === 1 ? "endpoint" : "endpoints"} detected</span>
            </span>
            <span>·</span>
            <button
              onClick={onRevealInExplorer}
              className="flex items-center gap-1 text-muted-foreground/70 hover:text-foreground transition-colors truncate max-w-[200px] cursor-pointer"
              title="Reveal in Explorer"
            >
              <FolderOpen size={11} className="shrink-0" />
              <span className="truncate">{project.path}</span>
            </button>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={onNewTab}
            className="h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-medium rounded-md flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <Plus size={13} />
            <span>New Request</span>
            <kbd className="text-[10px] bg-primary-foreground/20 text-primary-foreground px-1 py-0.2 rounded leading-none">
              Ctrl+T
            </kbd>
          </button>

          {isScanning ? (
            <button
              onClick={onCancelScan}
              className="h-8 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cancel active scan"
            >
              <RefreshCw size={12} className="animate-spin text-rose-400" />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              onClick={onRescan}
              className="h-8 px-3 bg-white/[0.03] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Rescan</span>
            </button>
          )}

          {onCloseProject && (
            <button
              onClick={onCloseProject}
              className="h-8 px-3 bg-white/[0.03] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Close current backend and return to Home"
            >
              <Home size={12} />
              <span>Close Backend</span>
            </button>
          )}
        </div>

        {/* Quick Shortcuts Cheatsheet Card */}
        <div className="w-full max-w-sm p-3.5 select-none text-[11.5px]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 text-left mb-2.5">
            Quick Shortcuts
          </div>

          <div className="space-y-2 text-left">
            <div className="flex items-center justify-between text-muted-foreground/80">
              <span>New request scratchpad</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05]  text-[10.5px] text-foreground/90">
                Ctrl + T
              </kbd>
            </div>

            <div className="flex items-center justify-between text-muted-foreground/80">
              <span>Inspect &amp; test endpoint</span>
              <span className="text-[11px] text-muted-foreground/60">
                Click in sidebar
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground/80">
              <span>Send active request</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05]  text-[10.5px] text-foreground/90 flex items-center gap-1">
                <span>Ctrl + Enter</span>
                <CornerDownLeft size={10} />
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
