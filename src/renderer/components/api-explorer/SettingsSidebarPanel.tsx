import { WorkspaceSettings } from "../../../types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, FolderOpen, Cpu } from "lucide-react";
import { useState, useEffect } from "react";

type SettingsSidebarPanelProps = {
  settings: WorkspaceSettings;
  onToggleWorkspaces: (enabled: boolean) => void;
  onSelectWorkspacePath: () => void;
};

export function SettingsSidebarPanel({
  settings,
  onToggleWorkspaces,
  onSelectWorkspacePath,
}: SettingsSidebarPanelProps) {
  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => {
    // Optionally fetch some basic system specs
    window.api.getSystemStats?.()
      .then((stats) => {
        setSystemStats(stats);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full space-y-5">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <Settings size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
          RouteLens Settings
        </span>
      </div>

      {/* Sync settings */}
      <div className="p-3 rounded-lg border border-border bg-card/20 space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="sync-switch" className="text-xs font-medium cursor-pointer text-foreground/80">
            VS Code Sync
          </Label>
          <Switch
            id="sync-switch"
            checked={settings.manageWorkspaces}
            onCheckedChange={onToggleWorkspaces}
          />
        </div>
        
        <p className="text-[10px] text-muted-foreground leading-normal">
          Automatically synchronize your project groups into a local VS Code multi-root workspace file.
        </p>

        {settings.manageWorkspaces && (
          <div className="space-y-1.5 pt-1.5 border-t border-border/40">
            <div className="text-[10px] font-semibold text-muted-foreground">Save Location</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono bg-black/30 p-1 rounded truncate flex-1 block" title={settings.workspaceSavePath || "Not set"}>
                {settings.workspaceSavePath || "No path selected"}
              </span>
              <button
                onClick={onSelectWorkspacePath}
                className="p-1 rounded bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                title="Select folder"
              >
                <FolderOpen size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* System Details */}
      <div className="p-3 rounded-lg border border-border bg-card/20 space-y-2">
        <div className="text-xs font-medium text-foreground/80 flex items-center gap-1">
          <Cpu size={12} />
          <span>System Environment</span>
        </div>
        <div className="text-[10px] text-muted-foreground space-y-1">
          <div>Platform: <span className="text-foreground font-mono">{process.platform}</span></div>
          <div>Node Version: <span className="text-foreground font-mono">{process.versions.node}</span></div>
          <div>Chrome Version: <span className="text-foreground font-mono">{process.versions.chrome}</span></div>
          <div>Electron: <span className="text-foreground font-mono">{process.versions.electron}</span></div>
        </div>
      </div>

      {/* About Box */}
      <div className="p-3 rounded-lg border border-border/50 bg-primary/5 text-center">
        <div className="text-xs font-bold text-primary mb-1">RouteLens v1.0.0</div>
        <div className="text-[10px] text-muted-foreground leading-normal">
          AST Route Scanner and API Client for Modern Full-Stack Workspaces.
        </div>
      </div>
    </div>
  );
}
