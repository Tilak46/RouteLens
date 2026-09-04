import { useEffect, useRef, useState } from "react";
import { Project, ProjectStatus } from "../../../types";
import { Button } from "@/components/ui/button";
import { Sparkles, Trash2, X, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { explainLog } from "@/lib/ai";
import { cn } from "@/lib/utils";

type ConsoleLogsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  projectState: Record<string, { status: ProjectStatus; logs: string; url?: string }>;
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  consoleHeight?: number;
  onConsoleResizeStart?: (e: React.MouseEvent) => void;
};

export function ConsoleLogsDrawer({
  isOpen,
  onClose,
  projects,
  projectState,
  activeProjectId,
  onSelectProject,
  consoleHeight,
  onConsoleResizeStart,
}: ConsoleLogsDrawerProps) {
  const logContainerRef = useRef<HTMLPreElement>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // Filter projects that are either running or have logs
  const activeProjects = projects.filter((p) => {
    const state = projectState[p.id];
    return state && (state.status === "running" || state.status === "starting" || state.logs);
  });

  // Automatically select the first running project if activeProjectId is not valid or empty
  useEffect(() => {
    if (!activeProjectId && activeProjects.length > 0) {
      onSelectProject(activeProjects[0].id);
    }
  }, [activeProjects, activeProjectId, onSelectProject]);

  const selectedProject = projects.find((p) => p.id === activeProjectId) || null;
  const currentLogs = selectedProject ? projectState[selectedProject.id]?.logs || "" : "";

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [currentLogs, isOpen]);

  const handleClearLogs = () => {
    if (activeProjectId) {
      window.api.clearLogs(activeProjectId);
      setExplanation(null);
    }
  };

  const handleExplain = async () => {
    if (!currentLogs.trim()) return;
    setIsExplaining(true);
    setExplanation(null);
    try {
      const lines = currentLogs.split("\n").slice(-30).join("\n");
      const result = await explainLog(lines);
      setExplanation(result);
    } catch (e) {
      setExplanation("Failed to analyze logs. Please check your OpenRouter key.");
    } finally {
      setIsExplaining(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="h-9 border-t border-border bg-sidebar px-4 flex items-center justify-between text-xs text-muted-foreground select-none shrink-0">
        <button
          onClick={() => {
            onClose(); // This will toggle it open
          }}
          className="flex items-center gap-1.5 hover:text-foreground font-medium transition-colors"
        >
          <Terminal size={12} />
          <span>Console Logs</span>
          {activeProjects.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground"
          title="Open Console"
        >
          <ChevronUp size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="border-t border-border bg-sidebar flex flex-col shrink-0 select-none overflow-hidden relative"
      style={{ height: `${consoleHeight || 288}px` }}
    >
      {/* Row resize handle on the top border */}
      {onConsoleResizeStart && (
        <div
          onMouseDown={onConsoleResizeStart}
          className="absolute top-0 left-0 right-0 h-[4px] cursor-row-resize hover:bg-primary/50 active:bg-primary/70 transition-colors z-30"
        />
      )}
      {/* HEADERBAR */}
      <div className="h-10 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground tracking-wider uppercase shrink-0 transition-colors px-2 py-1 -ml-1 rounded hover:bg-white/5 cursor-pointer group"
            title="Click to collapse console"
          >
            <Terminal size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
            <span>Console</span>
            <ChevronDown size={12} className="opacity-60 group-hover:opacity-100 transition-opacity" />
          </button>

          <div className="h-4 w-px bg-border shrink-0" />

          {/* Project Tabs */}
          <div className="flex items-center gap-1">
            {activeProjects.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">No active servers</span>
            ) : (
              activeProjects.map((p) => {
                const isActive = p.id === activeProjectId;
                const status = projectState[p.id]?.status;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 font-medium border",
                      isActive
                        ? "bg-primary/10 border-primary/20 text-primary"
                        : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        status === "running" && "bg-emerald-500",
                        status === "starting" && "bg-amber-500 animate-pulse",
                        "bg-zinc-500"
                      )}
                    />
                    {p.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {currentLogs && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExplain}
              disabled={isExplaining}
              className="h-7 px-2 border-primary/30 text-primary hover:bg-primary/10 text-xs gap-1.5"
            >
              <Sparkles size={12} className={isExplaining ? "animate-spin" : ""} />
              {isExplaining ? "Analyzing..." : "AI Explain"}
            </Button>
          )}

          {selectedProject && (
            <button
              onClick={handleClearLogs}
              className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
              title="Clear Logs"
            >
              <Trash2 size={14} />
            </button>
          )}

          <div className="h-4 w-px bg-border mx-1" />

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            title="Collapse Console"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* TERMINAL CONTENT & EXPLANATION SIDE-BY-SIDE */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Terminal Logs Output */}
        <pre
          ref={logContainerRef}
          className="flex-1 bg-black/30 p-3 text-xs font-mono whitespace-pre-wrap break-all overflow-y-auto text-foreground/90 border-r border-border/50"
          dangerouslySetInnerHTML={{
            __html:
              currentLogs ||
              `<span class="text-muted-foreground/30 italic">No logs. ${
                selectedProject
                  ? "Waiting for server output..."
                  : "Select an active server above to view logs."
              }</span>`,
          }}
        />

        {/* AI Explanation Pane */}
        {explanation && (
          <div className="w-80 bg-card/60 overflow-y-auto p-3 text-xs flex flex-col shrink-0">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-2 font-semibold text-primary">
              <span className="flex items-center gap-1">
                <Sparkles size={12} />
                AI Analysis
              </span>
              <button
                onClick={() => setExplanation(null)}
                className="text-muted-foreground hover:text-foreground text-[10px]"
              >
                Close
              </button>
            </div>
            <div className="whitespace-pre-wrap text-muted-foreground font-sans leading-relaxed">
              {explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
