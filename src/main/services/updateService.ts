import { autoUpdater } from "electron-updater";
import { app, ipcMain, BrowserWindow } from "electron";
import { is } from "@electron-toolkit/utils";
import Store from "electron-store";

export interface PendingUpdateRecord {
  version: string;
  releaseDate?: string;
  firstDetectedAt: number;
  downloadedAt?: number;
  gracePeriodMs: number;
}

interface UpdateStoreSchema {
  pendingUpdate: PendingUpdateRecord | null;
  simulatedEnforced: boolean;
}

export interface UpdateEnforcementStatus {
  hasPendingUpdate: boolean;
  version: string | null;
  releaseDate?: string;
  firstDetectedAt: number | null;
  deadlineAt: number | null;
  isDownloaded: boolean;
  isGracePeriodActive: boolean;
  isEnforced: boolean;
  remainingMs: number;
  remainingHours: number;
  remainingMinutes: number;
  isSimulated?: boolean;
}

const DEFAULT_GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 hours = 2 days

const updateStore = new Store<UpdateStoreSchema>({
  name: "routelens-updates",
  defaults: {
    pendingUpdate: null,
    simulatedEnforced: false,
  },
});

let isInitialized = false;

export function getEnforcementStatus(): UpdateEnforcementStatus {
  const currentAppVersion = app.getVersion();
  const pending = updateStore.get("pendingUpdate");
  const simulated = updateStore.get("simulatedEnforced", false);

  if (simulated) {
    return {
      hasPendingUpdate: true,
      version: pending?.version || "0.1.1",
      releaseDate: pending?.releaseDate,
      firstDetectedAt: Date.now() - 49 * 3600 * 1000,
      deadlineAt: Date.now() - 1000,
      isDownloaded: true,
      isGracePeriodActive: false,
      isEnforced: true,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      isSimulated: true,
    };
  }

  if (!pending) {
    return {
      hasPendingUpdate: false,
      version: null,
      firstDetectedAt: null,
      deadlineAt: null,
      isDownloaded: false,
      isGracePeriodActive: false,
      isEnforced: false,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
    };
  }

  // If current running app already matches or exceeds pending update version, clear it!
  if (currentAppVersion === pending.version) {
    updateStore.set("pendingUpdate", null);
    updateStore.set("simulatedEnforced", false);
    return {
      hasPendingUpdate: false,
      version: null,
      firstDetectedAt: null,
      deadlineAt: null,
      isDownloaded: false,
      isGracePeriodActive: false,
      isEnforced: false,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
    };
  }

  const graceMs = pending.gracePeriodMs || DEFAULT_GRACE_PERIOD_MS;
  const deadlineAt = pending.firstDetectedAt + graceMs;
  const remainingMs = Math.max(0, deadlineAt - Date.now());
  const isEnforced = remainingMs <= 0;
  const isGracePeriodActive = remainingMs > 0;
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    hasPendingUpdate: true,
    version: pending.version,
    releaseDate: pending.releaseDate,
    firstDetectedAt: pending.firstDetectedAt,
    deadlineAt,
    isDownloaded: !!pending.downloadedAt,
    isGracePeriodActive,
    isEnforced,
    remainingMs,
    remainingHours,
    remainingMinutes,
    isSimulated: false,
  };
}

export function initUpdateService(getMainWindow: () => BrowserWindow | null): void {
  if (isInitialized) return;
  isInitialized = true;

  // Configure autoUpdater settings
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  if (is.dev) {
    console.log("[UpdateService] Initialized in development mode (app not packaged)");
  } else {
    console.log("[UpdateService] Initialized in production mode - feed targeting Tilak46/routelens-releases");
  }

  // Helper to send events to the renderer
  const broadcast = (channel: string, ...args: any[]) => {
    try {
      const win = getMainWindow();
      if (win && typeof win.isDestroyed === "function" && !win.isDestroyed()) {
        win.webContents?.send(channel, ...args);
      }
    } catch (e) {
      console.warn(`[UpdateService] Failed to broadcast ${channel}:`, e);
    }
  };

  // Lifecycle listeners
  autoUpdater.on("checking-for-update", () => {
    console.log("[UpdateService] Checking for updates...");
    broadcast("update:checking");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[UpdateService] Update available:", info.version);
    
    // Record in persistent store
    const existing = updateStore.get("pendingUpdate");
    if (!existing || existing.version !== info.version) {
      updateStore.set("pendingUpdate", {
        version: info.version,
        releaseDate: info.releaseDate,
        firstDetectedAt: Date.now(),
        gracePeriodMs: DEFAULT_GRACE_PERIOD_MS,
      });
    }

    broadcast("update:available", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
    broadcast("update:enforcement", getEnforcementStatus());
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("[UpdateService] Update not available. Current version is up to date:", info.version);
    const existing = updateStore.get("pendingUpdate");
    if (existing && existing.version === info.version) {
      updateStore.set("pendingUpdate", null);
    }
    broadcast("update:not-available", {
      version: info.version,
    });
    broadcast("update:enforcement", getEnforcementStatus());
  });

  autoUpdater.on("download-progress", (progress) => {
    broadcast("update:progress", {
      percent: Math.round(progress.percent || 0),
      bytesPerSecond: progress.bytesPerSecond || 0,
      transferred: progress.transferred || 0,
      total: progress.total || 0,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[UpdateService] Update downloaded successfully:", info.version);
    
    const existing = updateStore.get("pendingUpdate");
    if (existing && existing.version === info.version) {
      existing.downloadedAt = Date.now();
      updateStore.set("pendingUpdate", existing);
    }

    broadcast("update:downloaded", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
    broadcast("update:enforcement", getEnforcementStatus());
  });

  autoUpdater.on("error", (err) => {
    console.error("[UpdateService] Error during auto-update:", err?.message || err);
    broadcast("update:error", {
      message: err?.message || String(err),
    });
  });

  // Periodic enforcement check every 60 seconds
  setInterval(() => {
    const status = getEnforcementStatus();
    if (status.hasPendingUpdate) {
      broadcast("update:enforcement", status);
    }
  }, 60000);

  // IPC Handlers
  ipcMain.handle("updates:check", async () => {
    if (is.dev) {
      console.log("[UpdateService] Dev mode: simulating update check");
      return {
        success: true,
        isDev: true,
        version: app.getVersion(),
        message: "Running in dev mode. Updates will check against GitHub Releases in production.",
      };
    }

    try {
      console.log("[UpdateService] Triggering manual update check...");
      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        version: result?.updateInfo?.version || app.getVersion(),
      };
    } catch (error: any) {
      console.error("[UpdateService] Manual check error:", error?.message || error);
      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  });

  ipcMain.handle("updates:install", () => {
    console.log("[UpdateService] Quitting and installing update (silent = true, forceRunAfter = true)...");
    autoUpdater.quitAndInstall(true, true);
  });

  ipcMain.handle("updates:get-version", () => {
    return app.getVersion();
  });

  ipcMain.handle("updates:get-enforcement", () => {
    return getEnforcementStatus();
  });

  ipcMain.handle("updates:simulate-enforcement", (_, mode: "expire" | "reset") => {
    if (mode === "expire") {
      updateStore.set("simulatedEnforced", true);
    } else {
      updateStore.set("simulatedEnforced", false);
    }
    const status = getEnforcementStatus();
    broadcast("update:enforcement", status);
    return status;
  });

  // Automatic background update check on app launch (wait 5s for smooth startup)
  setTimeout(() => {
    // Also broadcast current enforcement status on launch
    broadcast("update:enforcement", getEnforcementStatus());

    if (!is.dev) {
      console.log("[UpdateService] Performing background launch update check...");
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn("[UpdateService] Background update check failed:", err?.message);
      });
    }
  }, 5000);
}
