import { AppWorkspace, Workspace } from "../../../types";
import { Play, FileCode, FolderOpen, Plus, Trash2, Edit2, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AutomationsPanelProps = {
  appWorkspaces: AppWorkspace[];
  workspaces: Workspace[];
  onNewAutomation: () => void;
  onAddWorkspace: () => void;
  onLaunchAppWorkspace: (id: string) => void;
  onDeleteAppWorkspace: (id: string) => void;
  onEditAppWorkspace: (workspace: AppWorkspace) => void;
  onOpenWorkspace: (workspacePath: string) => void;
  onTogglePin: (workspace: Workspace) => void;
  onRemoveWorkspace: (workspaceId: string) => void;
};

export function AutomationsPanel({
  appWorkspaces,
  workspaces,
  onNewAutomation,
  onAddWorkspace,
  onLaunchAppWorkspace,
  onDeleteAppWorkspace,
  onEditAppWorkspace,
  onOpenWorkspace,
  onTogglePin,
  onRemoveWorkspace,
}: AutomationsPanelProps) {
  return (
    <div className="flex flex-col h-full space-y-4">
      {/* GOD MODE AUTOMATIONS */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
            Stack Automations ({appWorkspaces.length})
          </span>
          <button
            onClick={onNewAutomation}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/5 transition-colors"
            title="Create Stack Automation"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {appWorkspaces.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-2">
              No automations.
              <button
                onClick={onNewAutomation}
                className="text-primary hover:underline block w-full mt-1 font-medium"
              >
                Create Automation
              </button>
            </div>
          ) : (
            appWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="group flex items-center justify-between p-2 rounded-lg border border-border/50 bg-card/30 hover:bg-card/70 transition-all"
              >
                <div className="flex flex-col overflow-hidden min-w-0 pr-2">
                  <span className="text-xs font-medium text-foreground truncate" title={ws.name}>
                    {ws.name}
                  </span>
                  {ws.description && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {ws.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onLaunchAppWorkspace(ws.id)}
                    className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Launch Stack"
                  >
                    <Play size={10} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => onEditAppWorkspace(ws)}
                    className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete automation "${ws.name}"?`)) {
                        onDeleteAppWorkspace(ws.id);
                      }
                    }}
                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* VS CODE WORKSPACE FILES */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
            VS Code Workspaces ({workspaces.length})
          </span>
          <button
            onClick={onAddWorkspace}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/5 transition-colors"
            title="Link VS Code Workspace"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {workspaces.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-2">
              No workspaces linked.
            </div>
          ) : (
            workspaces.map((ws) => (
              <div
                key={ws.id}
                className="group flex items-center justify-between p-2 rounded-lg border border-border/50 bg-card/30 hover:bg-card/70 transition-all"
              >
                <div className="flex items-center gap-2 overflow-hidden min-w-0 pr-2">
                  <FileCode size={12} className="text-blue-400 shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate" title={ws.displayName || ws.name}>
                    {ws.displayName || ws.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onOpenWorkspace(ws.path)}
                    className="p-1.5 rounded bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Open in VS Code"
                  >
                    <FolderOpen size={10} />
                  </button>
                  <button
                    onClick={() => onTogglePin(ws)}
                    className={cn(
                      "p-1 rounded hover:bg-white/5 transition-colors",
                      ws.isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={ws.isPinned ? "Unpin" : "Pin"}
                  >
                    <Pin size={10} className={cn(ws.isPinned && "fill-current")} />
                  </button>
                  <button
                    onClick={() => onRemoveWorkspace(ws.id)}
                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
