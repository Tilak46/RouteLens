import { ipcMain, BrowserWindow, dialog } from "electron";
import Store from "electron-store";
import { join } from "node:path";
import type { Project, Group, StoreType, WorkspaceSettings } from "../../types"; // Adjust path

let getMainWindow: () => BrowserWindow | null;
let updateWorkspaceFileFn: (
  group: Group,
  projectsInGroup: Project[]
) => Promise<void>;

// Utility function to get the workspace save path
async function getWorkspaceSavePath(
  store: Store<StoreType>,
  forceSelect = false
): Promise<string | null> {
  let savePath = (store as any).get("settings.workspaceSavePath");
  const mainWindow = getMainWindow();
  if (!mainWindow) return null;

  if (!savePath || forceSelect) {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Folder to Save VS Code Workspaces",
    });
    if (!canceled && filePaths.length > 0) {
      savePath = filePaths[0];
      (store as any).set("settings.workspaceSavePath", savePath);
    } else {
      // If selection cancelled when forced, revert toggle in frontend if needed
      // Setting manageWorkspaces false here might be unexpected if called just for path selection
      if (forceSelect && !savePath) {
        // Only toggle off if forcing failed to get a path
        (store as any).set("settings.manageWorkspaces", false);
        mainWindow.webContents.send(
          "settings-updated",
          (store as any).get("settings")
        );
      }
      return null;
    }
  }
  return savePath;
}

export function registerSettingsHandlers(
  store: Store<StoreType>,
  getMainWindowFn: () => BrowserWindow | null,
  updateWorkspaceFile: (
    group: Group,
    projectsInGroup: Project[]
  ) => Promise<void>
) {
  getMainWindow = getMainWindowFn;
  updateWorkspaceFileFn = updateWorkspaceFile;

  ipcMain.on("settings:get", (_event) => {
    _event.sender.send("settings-loaded", (store as any).get("settings"));
  });

  ipcMain.on("settings:toggle-workspaces", async (_event, enabled: boolean) => {
    let actualEnabled = enabled; // Store the intended state
    if (enabled) {
      const savePath = await getWorkspaceSavePath(store); // Pass store
      if (!savePath) {
        actualEnabled = false; // Force disable if path selection failed/cancelled
      }
    }
    (store as any).set("settings.manageWorkspaces", actualEnabled);
    _event.sender.send("settings-updated", (store as any).get("settings"));

    // If enabling, create/update workspace files for existing groups
    if (actualEnabled) {
      const groups = (store as any).get("groups") as Group[];
      const projects = (store as any).get("projects") as Project[];
      const savePath = (store as any).get("settings.workspaceSavePath");
      let groupsUpdated = false;
      if (savePath) {
        for (const group of groups) {
          if (!group.workspacePath) {
            group.workspacePath = join(
              savePath,
              `${group.name.replace(/[^a-zA-Z0-9]/g, "_")}.code-workspace`
            );
            groupsUpdated = true;
          }
          const projectsInGroup = projects.filter(
            (p) => p.groupId === group.id
          );
          await updateWorkspaceFileFn(group, projectsInGroup); // Use passed function
        }
        if (groupsUpdated) {
          (store as any).set("groups", groups);
          _event.sender.send("groups-loaded", groups);
        }
      }
    }
  });

  ipcMain.handle("settings:select-workspace-path", async () => {
    // Force selection and return the path (or null)
    const newPath = await getWorkspaceSavePath(store, true); // Pass store, force select
    return newPath;
  });

  ipcMain.handle("store:get", async (_, key: string) => {
    return (store as any).get(key);
  });

  ipcMain.handle("store:set", async (_, key: string, value: any) => {
    (store as any).set(key, value);
  });

  ipcMain.handle("store:reset", async () => {
    (store as any).clear();
    return true;
  });
}
