import dotenv from "dotenv";
import { app, BrowserWindow, shell, ipcMain, screen } from "electron"; // 1. Added ipcMain
import { join, resolve } from "node:path";
import fs from "node:fs";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import Store from "electron-store";
import type { Project, Group, StoreType } from "../types";
import { getAiModel, getAiProvider } from "./lib/ai/openrouter";

// Load environment variables from .env.
// electron-vite/electron may start with a CWD that is NOT the `devdash/` folder,
// so we explicitly try the app's project root (derived from the compiled `out/main`).
(() => {
  try {
    const projectRoot = resolve(__dirname, "..", "..");
    const candidates = [
      resolve(process.cwd(), ".env"),
      resolve(projectRoot, ".env"),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p, override: false });
      }
    }

    if (is.dev) {
      const provider = getAiProvider();
      const hasKey = provider !== "none";
      const model = getAiModel();
      console.log(
        `[AI] AI provider: ${provider} | key loaded: ${hasKey ? "yes" : "no"} | model: ${model}`,
      );

      const bool = (k: string) => {
        const v = String(process.env[k] ?? "")
          .trim()
          .toLowerCase();
        if (!v) return false;
        return v === "1" || v === "true" || v === "yes";
      };
      const num = (k: string, d: number) => {
        const raw = String(process.env[k] ?? "").trim();
        const n = Number(raw);
        return Number.isFinite(n) ? n : d;
      };

      const namingEnabled = (() => {
        const raw = String(process.env["API_EXPLORER_AI_NAMING"] ?? "")
          .trim()
          .toLowerCase();
        if (!raw) return hasKey;
        return raw === "1" || raw === "true" || raw === "yes";
      })();

      console.log(
        `[AI] API Explorer naming: enabled=${namingEnabled ? "yes" : "no"} debug=${bool("API_EXPLORER_AI_DEBUG") ? "yes" : "no"} force=${bool("API_EXPLORER_AI_FORCE") ? "yes" : "no"} budgetRoutes=${num("API_EXPLORER_AI_BUDGET_ROUTES", 60)} batchSize=${num("API_EXPLORER_AI_BATCH_SIZE", 20)}`,
      );
    }
  } catch (e) {
    console.warn("[env] Failed to load .env:", e);
  }
})();

// Dev-only: Electron warns loudly about CSP/unsafe-eval during development.
// This does NOT apply to packaged builds; suppress to reduce noise.
if (is.dev) {
  process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
}

// Import handler registration functions
import {
  registerProjectHandlers,
  killAllRunningProcesses,
} from "./ipcHandlers/projectHandlers";
import { registerGroupHandlers } from "./ipcHandlers/groupHandlers";
import { registerWorkspaceHandlers } from "./ipcHandlers/workspaceHandlers";
import { registerSettingsHandlers } from "./ipcHandlers/settingsHandlers";
import { registerShellHandlers } from "./ipcHandlers/shellHandlers";
import { registerDialogHandlers } from "./ipcHandlers/dialogHandlers";
import { registerGitHandlers } from "./ipcHandlers/gitHandlers";
import { registerDependencyHandlers } from "./ipcHandlers/dependencyHandlers";
import { registerSystemHandlers } from "./ipcHandlers/systemHandlers";
import { registerSystemStatsHandlers } from "./ipcHandlers/systemStatsHandlers";
import { registerAppWorkspaceHandlers } from "./ipcHandlers/appWorkspaceHandlers";
import { registerAIHandlers } from "./ipcHandlers/aiHandlers";
import { registerAppScanHandlers } from "./ipcHandlers/appScanHandlers";
import { registerBrowserScanHandlers } from "./ipcHandlers/browserScanHandlers";
import { registerApiExplorerHandlers } from "./ipcHandlers/apiExplorerHandlers";

let mainWindow: BrowserWindow | null = null; // Global reference

// Initialize Store
const store = new Store<StoreType>({
  defaults: {
    projects: [],
    groups: [],
    settings: {
      manageWorkspaces: false,
      workspaceSavePath: null,
    },
    workspaces: [],
  },
});

// Helper to get main window (now acts as a broadcaster)
function getMainWindow(): BrowserWindow | null {
  // Return a proxy-like object that satisfies the handlers' needs (broadcasting events)
  if (!mainWindow && !ghostWindow) return null;

  return {
    webContents: {
      send: (channel: string, ...args: any[]) => {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send(channel, ...args);
        if (ghostWindow && !ghostWindow.isDestroyed())
          ghostWindow.webContents.send(channel, ...args);
      },
    },
  } as unknown as BrowserWindow;
}

// Dialogs MUST receive a real BrowserWindow instance.
function getDialogWindow(): BrowserWindow | null {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  if (ghostWindow && !ghostWindow.isDestroyed()) return ghostWindow;
  return null;
}

// Helper function to update workspace file
async function updateWorkspaceFile(group: Group, projectsInGroup: Project[]) {
  const manageWorkspaces = (store as any).get("settings.manageWorkspaces");
  if (!manageWorkspaces || !group.workspacePath) return;
  const workspaceData = {
    folders: projectsInGroup.map((p) => ({ path: p.path })),
  };
  try {
    const dirPath = join(group.workspacePath, "..");
    await fs.promises.mkdir(dirPath, { recursive: true });
    await fs.promises.writeFile(
      group.workspacePath,
      JSON.stringify(workspaceData, null, 2),
    );
    console.log(`Updated workspace file: ${group.workspacePath}`);
  } catch (error) {
    console.error(
      `Failed to write workspace file ${group.workspacePath}:`,
      error,
    );
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send(
      "projects-loaded",
      (store as any).get("projects"),
    );
    mainWindow.webContents.send("groups-loaded", (store as any).get("groups"));
    mainWindow.webContents.send(
      "settings-loaded",
      (store as any).get("settings"),
    );
    mainWindow.webContents.send(
      "workspaces-loaded",
      (store as any).get("workspaces"),
    );
    mainWindow.webContents.send(
      "app-workspaces-loaded",
      (store as any).get("appWorkspaces", []),
    );
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // 3. REMOVED incorrect webContents.on listeners for workspace updates

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ...
let ghostWindow: BrowserWindow | null = null;

function createGhostWindow(): void {
  if (ghostWindow && !ghostWindow.isDestroyed()) return;

  const workArea = screen.getPrimaryDisplay().workArea;
  const width = 460;
  const height = 56;
  const x = Math.max(workArea.x, workArea.x + 16);
  const y = Math.max(workArea.y, workArea.y + 16);

  ghostWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: "#00000000",
    // skipTaskbar: true, // User requested taskbar item
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
    },
  });

  ghostWindow.on("closed", () => {
    ghostWindow = null;
  });

  ghostWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `Ghost window failed to load (${errorCode}): ${errorDescription} @ ${validatedURL}`,
      );
    },
  );

  ghostWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Ghost window render process gone:", details);
  });

  ghostWindow.on("ready-to-show", () => {
    if (!ghostWindow || ghostWindow.isDestroyed()) return;
    ghostWindow.setAlwaysOnTop(true, "screen-saver");
    ghostWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    ghostWindow.show();
    ghostWindow.moveTop();
  });

  // Sync state to ghost window when it loads
  ghostWindow.webContents.on("did-finish-load", () => {
    ghostWindow?.webContents.send(
      "projects-loaded",
      (store as any).get("projects"),
    );
    ghostWindow?.webContents.send(
      "app-workspaces-loaded",
      (store as any).get("appWorkspaces", []),
    );
    // If ready-to-show doesn't fire for any reason, ensure the window is visible.
    if (ghostWindow && !ghostWindow.isDestroyed()) {
      ghostWindow.setAlwaysOnTop(true, "screen-saver");
      ghostWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
      });
      ghostWindow.show();
      ghostWindow.moveTop();
    }

    // DevTools are useful for debugging Ghost mode, but auto-opening is noisy.
    // Opt-in with DEVDASH_GHOST_DEVTOOLS=1
    if (is.dev && process.env["DEVDASH_GHOST_DEVTOOLS"] === "1") {
      ghostWindow?.webContents.openDevTools({ mode: "detach" });
    }
    // Notify other modules that ghost window is ready, so they can sync runtime state (like running servers)
    ipcMain.emit("internal:ghost-window-ready");
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    ghostWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/ghost.html`);
  } else {
    ghostWindow.loadFile(join(__dirname, "../renderer/ghost.html"));
  }
}

function toggleGhostWindow() {
  // If ghost is visible -> exit ghost mode.
  if (ghostWindow && !ghostWindow.isDestroyed() && ghostWindow.isVisible()) {
    ghostWindow.hide();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    return;
  }

  // Otherwise -> enter ghost mode.
  createGhostWindow();
  if (ghostWindow && !ghostWindow.isDestroyed()) {
    ghostWindow.setAlwaysOnTop(true, "screen-saver");
    ghostWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    ghostWindow.show();
    ghostWindow.moveTop();
    ghostWindow.focus();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

// ... existing createWindow ...

app.whenReady().then(() => {
  // ... existing setup ...

  // Register all IPC handlers, passing dependencies
  try {
    console.log("Registering Project Handlers...");
    registerProjectHandlers(store, getMainWindow, updateWorkspaceFile);

    console.log("Registering Group Handlers...");
    registerGroupHandlers(store, getMainWindow, updateWorkspaceFile);

    console.log("Registering Workspace Handlers...");
    console.log("Registering Workspace Handlers...");
    registerWorkspaceHandlers(store, getMainWindow);
    registerAppWorkspaceHandlers(store, getMainWindow);

    console.log("Registering Settings Handlers...");
    registerSettingsHandlers(store, getMainWindow, updateWorkspaceFile);

    console.log("Registering Dialog Handlers...");
    registerDialogHandlers(getDialogWindow);

    console.log("Registering Git Handlers...");
    registerGitHandlers(store, getMainWindow);

    console.log("Registering Dependency Handlers...");
    registerDependencyHandlers();

    console.log("Registering System Stats Handlers...");
    registerSystemStatsHandlers();

    console.log("Registering System Handlers...");
    registerSystemHandlers();

    console.log("Registering AI Handlers...");
    registerAIHandlers();

    console.log("Registering App Scan Handlers...");
    registerAppScanHandlers();

    console.log("Registering API Explorer Handlers...");
    registerApiExplorerHandlers();

    console.log("Registering Browser Scan Handlers...");
    registerBrowserScanHandlers();

    console.log("Registering Shell Handlers...");
    registerShellHandlers();

    console.log("All handlers registered successfully.");
  } catch (error) {
    console.error("Failed to register IPC handlers:", error);
  }

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on("app:toggle-ghost-mode", () => {
  toggleGhostWindow();
});

// ...

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 4. UPDATED will-quit handler
app.on("will-quit", () => {
  console.log("App quitting, terminating running processes...");
  killAllRunningProcesses(); // Call the exported function from projectHandlers
});
