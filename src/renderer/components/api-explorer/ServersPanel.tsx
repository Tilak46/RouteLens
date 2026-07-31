import { useState } from "react";
import { Project, ProjectStatus } from "../../../types";
import { Play, Square, RotateCw, Trash2, ExternalLink, Terminal, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ServersPanelProps = {
  projects: Project[];
  projectState: Record<string, { status: ProjectStatus; logs: string; url?: string }>;
  onAddProjectClick: () => void;
  onEditProject: (project: Project) => void;
  onViewLogs: (project: Project) => void;
};

export function ServersPanel({
  projects,
  projectState,
  onAddProjectClick,
  onEditProject,
  onViewLogs,
}: ServersPanelProps) {
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
          Local Servers ({projects.length})
        </span>
        <button
          onClick={onAddProjectClick}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/5 transition-colors"
          title="Add Server Project"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto pr-1">
        {projects.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No local servers configured.
            <Button
              variant="outline"
              size="sm"
              onClick={onAddProjectClick}
              className="mt-3 w-full bg-transparent border-border hover:bg-white/5"
            >
              Add Project
            </Button>
          </div>
        ) : (
          projects.map((project) => {
            const state = projectState[project.id] || { status: "stopped", logs: "" };
            const isRunning = state.status === "running";
            const isStarting = state.status === "starting";
            const isStopping = state.status === "stopping";
            
            return (
              <div
                key={project.id}
                className="group p-2.5 rounded-lg border border-border/50 bg-card/40 hover:bg-card/80 transition-all flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        isRunning && "bg-emerald-500 shadow-[0_0_8px_#10b981]",
                        isStarting && "bg-amber-500 animate-pulse",
                        isStopping && "bg-red-400 animate-pulse",
                        state.status === "stopped" && "bg-zinc-600"
                      )}
                    />
                    <span className="text-sm font-medium truncate text-foreground/90 group-hover:text-foreground">
                      {project.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditProject(project)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/5"
                      title="Edit Project Settings"
                    >
                      <Settings size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmProject(project)}
                      className="text-muted-foreground hover:text-red-400 p-1 rounded hover:bg-white/5"
                      title="Remove Project"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {project.path && (
                  <div className="text-[10px] text-muted-foreground font-mono truncate" title={project.path}>
                    {project.path}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/30 pt-2 mt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={isStarting || isStopping}
                      onClick={() => apiClient.toggleServer(project)}
                      className={cn(
                        "flex items-center justify-center p-1.5 rounded transition-all text-xs font-semibold",
                        isRunning
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      )}
                      title={isRunning ? "Stop Server" : "Start Server"}
                    >
                      {isRunning ? <Square size={12} /> : <Play size={12} />}
                    </button>

                    {isRunning && (
                      <button
                        disabled={isStarting || isStopping}
                        onClick={() => apiClient.restartProject(project)}
                        className="flex items-center justify-center p-1.5 rounded bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                        title="Restart Server"
                      >
                        <RotateCw size={12} />
                      </button>
                    )}

                    <button
                      onClick={() => onViewLogs(project)}
                      className="flex items-center justify-center p-1.5 rounded bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                      title="View Terminal Logs"
                    >
                      <Terminal size={12} />
                    </button>
                  </div>

                  {state.url && (
                    <a
                      href={state.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 transition-all shrink-0 max-w-[150px] shadow-[0_0_8px_rgba(16,185,129,0.1)] group/link"
                    >
                      <span className="truncate font-semibold">{state.url.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink size={8} className="shrink-0 opacity-70 group-hover/link:opacity-100 transition-opacity" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deleteConfirmProject !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmProject(null);
        }}
      >
        <AlertDialogContent className="bg-popover border border-border text-foreground w-[90%] max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Remove Project Configuration?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs leading-normal">
              Are you sure you want to remove <strong className="text-foreground">"{deleteConfirmProject?.name}"</strong>? This will remove it from the RouteLens workspace listing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel className="bg-transparent border border-border text-foreground hover:bg-white/5 text-xs h-9">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmProject) {
                  apiClient.removeProject(deleteConfirmProject.id);
                }
                setDeleteConfirmProject(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold h-9"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
