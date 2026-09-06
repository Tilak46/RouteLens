import { autoUpdater } from "electron-updater";
import { app, ipcMain, BrowserWindow } from "electron";
import { is } from "@electron-toolkit/utils";

let isInitialized = false;

export function initUpdateService(getMainWindow: () => BrowserWindow | null): void {
  if (isInitialized) return;
  isInitialized = true;

  // Configure autoUpdater settings
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Use console logging in development
  if (is.dev) {
    console.log("[UpdateService] Initialized in development mode (app not packaged)");
  } else {
    console.log("[UpdateService] Initialized in production mode - feed targeting Tilak46/routelens-releases");
  }

  // Helper to send events to the renderer
  const broadcast = (channel: string, ...args: any[]) => {
    try {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, ...args);
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
    broadcast("update:available", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("[UpdateService] Update not available. Current version is up to date:", info.version);
    broadcast("update:not-available", {
      version: info.version,
    });
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
    broadcast("update:downloaded", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("[UpdateService] Error during auto-update:", err?.message || err);
    broadcast("update:error", {
      message: err?.message || String(err),
    });
  });

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
    console.log("[UpdateService] Quitting and installing update...");
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle("updates:get-version", () => {
    return app.getVersion();
  });

  // Automatic background update check on app launch (wait 5s for smooth startup)
  setTimeout(() => {
    if (!is.dev) {
      console.log("[UpdateService] Performing background launch update check...");
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn("[UpdateService] Background update check failed:", err?.message);
      });
    }
  }, 5000);
}
