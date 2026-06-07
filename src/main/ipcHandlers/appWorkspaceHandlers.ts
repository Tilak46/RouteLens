import { ipcMain, shell } from "electron";
import { exec } from "child_process";
import { execFile } from "node:child_process";
import Store from "electron-store";
import { StoreType, AppWorkspace } from "../../types";
import {
  buildBrowserCommandForUrl,
  browserNameFromExe,
  scanInstalledBrowsersWindows,
} from "../lib/windowsBrowserScan";

function execFileAsync(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { windowsHide: true, maxBuffer: 1024 * 1024 * 4 },
      (err, stdout, stderr) => {
        if (err) {
          reject(Object.assign(err, { stdout, stderr }));
          return;
        }
        resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      },
    );
  });
}

function parseRegQueryValues(output: string): string[] {
  // `reg query` output can be localized; we use a loose heuristic:
  // - ignore blank lines
  // - return the last column(s) after REG_* token
  const lines = output.split(/\r?\n/).map((l) => l.trimEnd());
  const values: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/\sREG_\w+\s+/);
    if (!m) continue;
    const idx = trimmed.indexOf(m[0]);
    const rest = trimmed.slice(idx + m[0].length).trim();
    if (rest) values.push(rest);
  }

  return values;
}

async function regGetValue(
  key: string,
  valueName: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("reg", [
      "query",
      key,
      "/v",
      valueName,
    ]);
    return parseRegQueryValues(stdout)[0];
  } catch {
    return undefined;
  }
}

async function regGetDefaultValue(key: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("reg", ["query", key, "/ve"]);
    return parseRegQueryValues(stdout)[0];
  } catch {
    return undefined;
  }
}

async function getDefaultBrowserOpenCommandWindows(): Promise<
  string | undefined
> {
  // Best-effort resolution of the *default* browser command for http URLs.
  // This lets us support "Default + Incognito/New Window" for common browsers.
  const progIdRaw = await regGetValue(
    "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
    "ProgId",
  );
  const progId = String(progIdRaw ?? "")
    .replace(/^"|"$/g, "")
    .trim();
  if (!progId) return undefined;

  const candidates = [
    `HKCU\\Software\\Classes\\${progId}\\shell\\open\\command`,
    `HKLM\\Software\\Classes\\${progId}\\shell\\open\\command`,
    `HKCR\\${progId}\\shell\\open\\command`,
  ];

  for (const key of candidates) {
    const cmd = await regGetDefaultValue(key);
    if (cmd) return cmd;
  }

  return undefined;
}

function execAsync(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(cmd, (error) => {
      if (error) {
        console.warn("[Launcher] command failed:", cmd, error.message);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function normalizeUrlForLaunch(raw: string): string {
  const u = String(raw ?? "").trim();
  if (!u) return u;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) return u;
  if (
    u.startsWith("localhost") ||
    u.startsWith("127.0.0.1") ||
    u.startsWith("0.0.0.0")
  ) {
    return `http://${u}`;
  }
  if (u.includes(".")) return `https://${u}`;
  return u;
}

async function openUrlInBrowserWindows(args: {
  browser: "default" | "chrome" | "edge" | "firefox";
  url: string;
  privateMode?: boolean;
  newWindow?: boolean;
}) {
  const safeUrl = normalizeUrlForLaunch(String(args.url ?? "").trim());
  if (!safeUrl) return;

  const quotedUrl = `"${safeUrl.replace(/"/g, '\\"')}"`;

  // Use cmd's built-in `start` so it detaches.
  // Always include a window title argument (""), otherwise the first quoted string is treated as title.
  if (args.browser === "default") {
    // If the user asked for incognito/new-window, try to resolve the actual default browser command
    // and inject flags (works for Chrome/Edge/Firefox, best-effort).
    if (process.platform === "win32" && (args.privateMode || args.newWindow)) {
      const defaultCmd = await getDefaultBrowserOpenCommandWindows();
      if (defaultCmd) {
        const cmd = buildBrowserCommandForUrl({
          command: defaultCmd,
          url: safeUrl,
          privateMode: args.privateMode,
          newWindow: args.newWindow,
        });
        const ok = await execAsync(`cmd /c start "" ${cmd}`);
        if (ok) return;
      }
    }

    const ok = await execAsync(`cmd /c start "" ${quotedUrl}`);
    if (!ok) {
      try {
        await shell.openExternal(safeUrl);
      } catch {
        // ignore
      }
    }
    return;
  }

  // On many Windows installs, chrome/msedge/firefox are not on PATH.
  // Best-effort: try resolving the installed browser command first, then fall back.
  if (process.platform === "win32") {
    try {
      const detected = await scanInstalledBrowsersWindows();
      const match = detected.find(
        (b) => browserNameFromExe(b.exePath) === args.browser,
      );
      if (match?.command) {
        const cmd = buildBrowserCommandForUrl({
          command: match.command,
          url: safeUrl,
          privateMode: args.privateMode,
          newWindow: args.newWindow,
        });
        const ok = await execAsync(`cmd /c start "" ${cmd}`);
        if (ok) return;
      }
    } catch {
      // ignore
    }
  }

  // Last resort: try PATH command name, then fall back to default browser.
  let browserCmd = "";
  let privateFlag = "";
  if (args.browser === "chrome") {
    browserCmd = "chrome";
    privateFlag = args.privateMode ? "--incognito" : "";
    if (args.newWindow) privateFlag = `${privateFlag} --new-window`.trim();
  }
  if (args.browser === "edge") {
    browserCmd = "msedge";
    privateFlag = args.privateMode ? "-inprivate" : "";
    if (args.newWindow) privateFlag = `${privateFlag} --new-window`.trim();
  }
  if (args.browser === "firefox") {
    browserCmd = "firefox";
    privateFlag = args.privateMode ? "-private-window" : "";
    if (args.newWindow) privateFlag = `${privateFlag} -new-window`.trim();
  }

  if (browserCmd) {
    const ok = await execAsync(
      `cmd /c start "" ${browserCmd} ${privateFlag} ${quotedUrl}`.trim(),
    );
    if (ok) return;
    const fallbackOk = await execAsync(`cmd /c start "" ${quotedUrl}`);
    if (fallbackOk) return;
    try {
      await shell.openExternal(safeUrl);
    } catch {
      // ignore
    }
  } else {
    const ok = await execAsync(`cmd /c start "" ${quotedUrl}`);
    if (!ok) {
      try {
        await shell.openExternal(safeUrl);
      } catch {
        // ignore
      }
    }
  }
}

export const registerAppWorkspaceHandlers = (
  store: Store<StoreType>,
  getMainWindow: () => Electron.BrowserWindow | null,
) => {
  // Fix TS types for store access
  const s = store as any;

  // GET
  ipcMain.handle("app-workspace:get-all", () => {
    return s.get("appWorkspaces", []);
  });

  // CREATE
  ipcMain.handle("app-workspace:create", (_, workspace: AppWorkspace) => {
    const current = s.get("appWorkspaces", []);
    const updated = [...current, workspace];
    s.set("appWorkspaces", updated);
    getMainWindow()?.webContents.send("app-workspaces-loaded", updated);
    return workspace;
  });

  // UPDATE
  ipcMain.handle("app-workspace:update", (_, workspace: AppWorkspace) => {
    const current = s.get("appWorkspaces", []);
    const index = current.findIndex((w: AppWorkspace) => w.id === workspace.id);
    if (index !== -1) {
      current[index] = workspace;
      s.set("appWorkspaces", current);
      getMainWindow()?.webContents.send("app-workspaces-loaded", current);
    }
    return workspace;
  });

  // DELETE
  ipcMain.handle("app-workspace:delete", (_, id: string): boolean => {
    const current = s.get("appWorkspaces", []);
    const updated = current.filter((w: AppWorkspace) => w.id !== id);
    s.set("appWorkspaces", updated);
    getMainWindow()?.webContents.send("app-workspaces-loaded", updated);
    return true;
  });

  // --- LAUNCHER LOGIC ---
  ipcMain.handle("app-workspace:launch", async (_, workspaceId: string) => {
    const workspace = s
      .get("appWorkspaces", [])
      .find((w: AppWorkspace) => w.id === workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    console.log(`[Launcher] Starting Workspace: ${workspace.name}`);

    // 1. Launch VS Code Projects
    for (const projectId of workspace.projectIds) {
      const project = s
        .get("projects", [])
        .find((p: any) => p.id === projectId);
      if (project) {
        console.log(`Open VS Code: ${project.path}`);
        exec(`code "${project.path}"`);
        // Optional: Start dev server? (Feature for later)
      }
    }

    // 2. Launch .code-workspace files
    for (const wsFileId of workspace.vsCodeWorkspaceIds) {
      const wsFile = s
        .get("workspaces", [])
        .find((w: any) => w.id === wsFileId);
      if (wsFile) {
        console.log(`Open Workspace File: ${wsFile.path}`);
        exec(`code "${wsFile.path}"`);
      }
    }

    // 3. Launch Browsers / URLs
    let detectedBrowsers: Array<{
      id: string;
      name: string;
      command: string;
      exePath?: string;
    }> = [];
    let detectedById = new Map<string, (typeof detectedBrowsers)[number]>();
    let detectedByKnownName = new Map<
      string,
      (typeof detectedBrowsers)[number]
    >();
    if (process.platform === "win32") {
      try {
        detectedBrowsers = await scanInstalledBrowsersWindows();
        detectedById = new Map(detectedBrowsers.map((b) => [b.id, b]));
        detectedByKnownName = new Map(
          detectedBrowsers
            .map((b) => {
              const known = browserNameFromExe(b.exePath);
              return known ? ([known, b] as const) : null;
            })
            .filter(Boolean) as Array<
            readonly [string, (typeof detectedBrowsers)[number]]
          >,
        );
      } catch {
        // ignore
      }
    }

    for (const browserEntry of workspace.browsers ?? []) {
      const urls = Array.isArray(browserEntry.urls) ? browserEntry.urls : [];
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const trimmed = normalizeUrlForLaunch(String(url ?? "").trim());
        if (!trimmed) continue;
        if (process.platform === "win32") {
          const privateMode = Boolean(browserEntry.usePrivateWindow);
          const newWindow = Boolean(browserEntry.openInNewWindow) && i === 0;

          if (
            browserEntry.type === "detected" &&
            browserEntry.detectedBrowserId
          ) {
            const detected = detectedById.get(browserEntry.detectedBrowserId);
            if (detected?.command) {
              const cmd = buildBrowserCommandForUrl({
                command: detected.command,
                url: trimmed,
                privateMode,
                newWindow,
              });
              const ok = await execAsync(`cmd /c start "" ${cmd}`);
              if (!ok) {
                await openUrlInBrowserWindows({
                  browser: "default",
                  url: trimmed,
                  privateMode,
                  newWindow,
                });
              }
              continue;
            }
          }

          // If an older workspace uses chrome/edge/firefox types, try to map it to detected executable first.
          if (
            browserEntry.type === "chrome" ||
            browserEntry.type === "edge" ||
            browserEntry.type === "firefox"
          ) {
            const detected = detectedByKnownName.get(browserEntry.type);
            if (detected?.command) {
              const cmd = buildBrowserCommandForUrl({
                command: detected.command,
                url: trimmed,
                privateMode,
                newWindow,
              });
              const ok = await execAsync(`cmd /c start "" ${cmd}`);
              if (!ok) {
                await openUrlInBrowserWindows({
                  browser: "default",
                  url: trimmed,
                  privateMode,
                  newWindow,
                });
              }
              continue;
            }
          }

          await openUrlInBrowserWindows({
            browser: (browserEntry.type ?? "default") as any,
            url: trimmed,
            privateMode,
            newWindow,
          });
        } else {
          // Cross-platform fallback (no reliable per-browser selection)
          await shell.openExternal(trimmed);
        }
      }
    }

    // 4. Launch Apps
    for (const app of workspace.apps) {
      if (!app.path) continue;
      console.log(`Launching App: ${app.path}`);

      // Use 'start "" "path"' on windows to detach
      if (process.platform === "win32") {
        exec(`start "" "${app.path}"`);
      } else {
        shell.openPath(app.path);
      }
    }

    // Update 'lastUsedAt'
    const current = s.get("appWorkspaces", []);
    const index = current.findIndex((w: AppWorkspace) => w.id === workspaceId);
    if (index !== -1) {
      current[index].lastUsedAt = Date.now();
      s.set("appWorkspaces", current);
      getMainWindow()?.webContents.send("app-workspaces-loaded", current);
    }

    return { success: true };
  });
};
