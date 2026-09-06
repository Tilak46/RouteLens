import { WorkspaceSettings } from "../../../types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Settings,
  FolderOpen,
  Cpu,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowUpCircle,
} from "lucide-react";
import { useState, useEffect } from "react";

type SettingsSidebarPanelProps = {
  settings: WorkspaceSettings;
  onToggleWorkspaces: (enabled: boolean) => void;
  onSelectWorkspacePath: () => void;
};

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatSpeed(bytesPerSec: number) {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

export function SettingsSidebarPanel({
  settings,
  onToggleWorkspaces,
  onSelectWorkspacePath,
}: SettingsSidebarPanelProps) {
  const [systemStats, setSystemStats] = useState<any>(null);
  const [appVersion, setAppVersion] = useState<string>("0.1.0");
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "checking" | "up-to-date" | "downloading" | "downloaded" | "error"
  >("idle");
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseDate?: string } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enforcement, setEnforcement] = useState<any>(null);

  useEffect(() => {
    // Optionally fetch some basic system specs
    window.api.getSystemStats?.()
      .then((stats) => {
        setSystemStats(stats);
      })
      .catch(() => {});

    // Fetch actual app version
    window.api.updates?.getVersion?.()
      .then((ver) => {
        if (ver) setAppVersion(ver);
      })
      .catch(() => {});

    // Wire up update lifecycle listeners
    window.api.updates?.onChecking?.(() => {
      setUpdateStatus("checking");
      setErrorMessage(null);
    });

    window.api.updates?.onUpdateAvailable?.((info) => {
      setUpdateStatus("downloading");
      setUpdateInfo(info);
    });

    window.api.updates?.onUpdateNotAvailable?.((info) => {
      setUpdateStatus("up-to-date");
      if (info?.version) setAppVersion(info.version);
      setTimeout(() => {
        setUpdateStatus((prev) => (prev === "up-to-date" ? "idle" : prev));
      }, 5000);
    });

    window.api.updates?.onProgress?.((progress) => {
      setUpdateStatus("downloading");
      setDownloadProgress(progress);
    });

    window.api.updates?.onUpdateDownloaded?.((info) => {
      setUpdateStatus("downloaded");
      setUpdateInfo(info);
    });

    window.api.updates?.onError?.((err) => {
      setUpdateStatus("error");
      setErrorMessage(err?.message || "Check failed");
    });

    window.api.updates?.getEnforcementStatus?.()
      .then((status) => {
        if (status) setEnforcement(status);
      })
      .catch(() => {});

    window.api.updates?.onEnforcementUpdated?.((status) => {
      setEnforcement(status);
    });
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateStatus("checking");
    setErrorMessage(null);
    try {
      const res = await window.api.updates?.check?.();
      if (res?.isDev) {
        setUpdateStatus("error");
        setErrorMessage("Auto-updates are only active in production builds.");
      } else if (!res?.success && res?.error) {
        setUpdateStatus("error");
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setUpdateStatus("error");
      setErrorMessage(err?.message || "Failed to check for updates");
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await window.api.updates?.install?.();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to restart & install");
    }
  };

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
          <div>Platform: <span className="text-foreground font-mono">{typeof process !== "undefined" ? process.platform : "win32"}</span></div>
          <div>Node Version: <span className="text-foreground font-mono">{typeof process !== "undefined" ? process.versions.node : "v20.11.0"}</span></div>
          <div>Chrome Version: <span className="text-foreground font-mono">{typeof process !== "undefined" ? process.versions.chrome : "120.0.0.0"}</span></div>
          <div>Electron: <span className="text-foreground font-mono">{typeof process !== "undefined" ? process.versions.electron : "28.2.0"}</span></div>
        </div>
      </div>

      {/* Data & Storage Management */}
      <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
        <div className="text-xs font-semibold text-destructive flex items-center gap-1.5">
          <span>Factory Reset</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-normal">
          Wipe all cached projects, request tabs, environments, and cookies to return to a 100% fresh slate.
        </p>
        <button
          onClick={async () => {
            if (window.confirm("Are you sure you want to reset all RouteLens app data? This will restore a clean first-run experience.")) {
              await window.api?.storeReset?.();
              window.location.reload();
            }
          }}
          className="w-full py-1.5 px-2.5 rounded bg-destructive/20 hover:bg-destructive/30 text-destructive text-[11px] font-semibold border border-destructive/40 transition-colors cursor-pointer"
        >
          Reset to Clean State
        </button>
      </div>

      {/* Software Updates */}
      <div className="p-3 rounded-lg border border-border bg-card/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
            <Sparkles size={13} className="text-primary" />
            <span>Software Updates</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
            v{appVersion}
          </span>
        </div>

        {updateStatus === "idle" && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground leading-normal">
              RouteLens checks for official updates automatically on startup.
            </p>
            <button
              onClick={handleCheckForUpdates}
              className="w-full py-1.5 px-2.5 rounded bg-secondary hover:bg-muted text-foreground text-[11px] font-medium border border-border flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Check for Updates</span>
            </button>
          </div>
        )}

        {updateStatus === "checking" && (
          <div className="space-y-2 py-1">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <RefreshCw size={13} className="animate-spin text-primary" />
              <span>Checking for updates...</span>
            </div>
          </div>
        )}

        {updateStatus === "up-to-date" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 size={13} />
              <span className="font-medium">You're on the latest version</span>
            </div>
            <button
              onClick={handleCheckForUpdates}
              className="w-full py-1 px-2 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground text-[10px] font-medium border border-border flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw size={11} />
              <span>Check again</span>
            </button>
          </div>
        )}

        {updateStatus === "downloading" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-foreground font-medium flex items-center gap-1">
                <Download size={11} className="text-primary animate-pulse" />
                Downloading v{updateInfo?.version || "update"}...
              </span>
              <span className="font-mono text-primary font-semibold">
                {downloadProgress ? Math.round(downloadProgress.percent) : 0}%
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-200"
                style={{
                  width: `${Math.min(100, Math.max(0, downloadProgress?.percent || 0))}%`,
                }}
              />
            </div>
            {downloadProgress && (
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>
                  {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                </span>
                <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
              </div>
            )}
          </div>
        )}

        {updateStatus === "downloaded" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 size={13} />
              <span>Update v{updateInfo?.version} ready!</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-normal">
              Restart RouteLens now to apply the new version seamlessly.
            </p>
            <button
              onClick={handleInstallUpdate}
              className="w-full py-1.5 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <ArrowUpCircle size={13} />
              <span>Restart & Install Update</span>
            </button>
          </div>
        )}

        {updateStatus === "error" && (
          <div className="space-y-2">
            <div className="flex items-start gap-1.5 text-[10px] text-destructive">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span className="leading-tight">{errorMessage || "Unable to check for updates"}</span>
            </div>
            <button
              onClick={handleCheckForUpdates}
              className="w-full py-1 px-2 rounded bg-secondary hover:bg-muted text-foreground text-[10px] font-medium border border-border flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw size={11} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Update Status Details */}
        {enforcement?.hasPendingUpdate && (
          <div className="pt-2 border-t border-border/50 text-[10px] space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Status:</span>
              <span className="font-mono text-emerald-400 font-medium">
                v{enforcement.version} ready to install
              </span>
            </div>
          </div>
        )}

        {/* Test Simulator Toggle Button */}
        <div className="pt-1">
          <button
            onClick={async () => {
              const nextMode = enforcement?.isSimulated ? "reset" : "expire";
              await window.api.updates?.simulateEnforcement?.(nextMode);
            }}
            className="w-full py-1 px-2 rounded bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground text-[10px] font-mono border border-border/40 transition-colors cursor-pointer"
          >
            {enforcement?.isSimulated ? "Reset Update Simulation" : "Test Mandatory Modal (Simulate Expiration)"}
          </button>
        </div>
      </div>

      {/* About Box */}
      <div className="p-3 rounded-lg border border-border/50 bg-primary/5 text-center">
        <div className="text-xs font-bold text-primary mb-1">RouteLens v{appVersion}</div>
        <div className="text-[10px] text-muted-foreground leading-normal">
          AST Route Scanner and API Client for Modern Full-Stack Workspaces.
        </div>
      </div>
    </div>
  );
}
