import { contextBridge, ipcRenderer } from "electron";
import type {
  Project,
  Group,
  ProjectStatus,
  Workspace,
  WorkspaceSettings,
  GitSummary,
  SystemStats,
  AppWorkspace,
  DetectedApp,
  DetectedBrowser,
  ApiFolder,
  ApiHttpRequest,
  ApiHttpResponse,
} from "../types"; // Use WorkspaceSettings

export const api = {
  // --- Project List Management ---
  getProjects: (): Promise<Project[]> => {
    return ipcRenderer.invoke("projects:get");
  },
  onProjectsLoaded: (callback: (projects: Project[]) => void) => {
    ipcRenderer.on("projects-loaded", (_event, projects) => callback(projects));
  },
  addProject: (project: Project) => {
    ipcRenderer.send("project:add", project);
  },
  removeProject: (projectId: string) => {
    ipcRenderer.send("project:remove", projectId);
  },
  updateProject: (project: Project) => {
    ipcRenderer.send("project:update", project);
  },
  openDirectoryDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke("dialog:openDirectory");
  },

  // --- Server Management ---
  getRunningServersSnapshot: (): Promise<Record<string, ProjectStatus>> => {
    return ipcRenderer.invoke("servers:running-snapshot");
  },
  toggleServer: (project: Project) => {
    ipcRenderer.send("project:toggle-server", project);
  },
  restartProject: (project: Project) => {
    ipcRenderer.send("project:restart", project);
  },
  onServerStatusChanged: (
    callback: (args: { projectId: string; status: ProjectStatus }) => void,
  ) => {
    ipcRenderer.on("server-status-changed", (_event, args) => callback(args));
  },
  onTerminalLog: (
    callback: (args: { projectId: string; log: string }) => void,
  ) => {
    ipcRenderer.on("terminal-log", (_event, args) => callback(args));
  },
  onServerUrlFound: (
    callback: (args: { projectId: string; url: string }) => void,
  ) => {
    ipcRenderer.on("server-url-found", (_event, args) => callback(args));
  },

  // --- Shell/External Actions ---
  openExternal: (url: string) => {
    ipcRenderer.send("shell:openExternal", url);
  },
  openPath: (path: string) => {
    ipcRenderer.send("shell:openPath", path);
  },
  openVSCode: (path: string) => {
    ipcRenderer.send("shell:openVSCode", path);
  },
  // *** ADDED showItemInFolder to exposed API ***
  showItemInFolder: (path: string) => {
    ipcRenderer.send("shell:showItemInFolder", path);
  },

  // --- Log Management ---
  clearLogs: (projectId: string) => {
    ipcRenderer.send("terminal-log-clear", projectId);
  },
  onClearLogs: (callback: (args: { projectId: string }) => void) => {
    ipcRenderer.on("terminal-log-clear", (_event, args) => callback(args));
  },

  // --- Group Management ---
  onGroupsLoaded: (callback: (groups: Group[]) => void) => {
    ipcRenderer.on("groups-loaded", (_event, groups) => callback(groups));
  },
  addGroup: (groupName: string) => {
    ipcRenderer.send("group:add", groupName);
  },
  deleteGroup: (groupId: string) => {
    ipcRenderer.send("group:delete", groupId);
  },
  assignProjectToGroup: (projectId: string, groupId: string | null) => {
    ipcRenderer.send("project:assign-group", { projectId, groupId });
  },

  // --- Settings Management ---
  getSettings: () => {
    ipcRenderer.send("settings:get");
  },
  onSettingsLoaded: (callback: (settings: WorkspaceSettings) => void) => {
    // Use WorkspaceSettings
    ipcRenderer.on("settings-loaded", (_event, settings) => callback(settings));
  },
  onSettingsUpdated: (callback: (settings: WorkspaceSettings) => void) => {
    // Use WorkspaceSettings
    ipcRenderer.on("settings-updated", (_event, settings) =>
      callback(settings),
    );
  },
  toggleWorkspaceManagement: (enabled: boolean) => {
    ipcRenderer.send("settings:toggle-workspaces", enabled);
  },
  selectWorkspacePath: (): Promise<string | null> => {
    return ipcRenderer.invoke("settings:select-workspace-path");
  },

  // --- Workspace Management (Group Linking & Tab) ---
  openWorkspace: (workspacePath: string) => {
    ipcRenderer.send("workspace:open", workspacePath);
  },
  onWorkspacesLoaded: (callback: (workspaces: Workspace[]) => void) => {
    ipcRenderer.on("workspaces-loaded", (_event, workspaces) =>
      callback(workspaces),
    );
  },
  addWorkspace: (workspacePath: string) => {
    ipcRenderer.send("workspace:add", workspacePath);
  },
  removeWorkspace: (workspaceId: string) => {
    ipcRenderer.send("workspace:remove", workspaceId);
  },
  selectWorkspaceFile: (): Promise<string | null> => {
    return ipcRenderer.invoke("dialog:openWorkspaceFile");
  },
  selectAppFile: (): Promise<string | null> => {
    return ipcRenderer.invoke("dialog:selectAppFile");
  },
  // *** ADDED updateWorkspace to exposed API ***
  updateWorkspace: (workspaceUpdate: Partial<Workspace> & { id: string }) => {
    ipcRenderer.send("workspace:update", workspaceUpdate);
  },

  // --- "God Mode" Workspaces ---
  getAppWorkspaces: (): Promise<AppWorkspace[]> => {
    return ipcRenderer.invoke("app-workspace:get-all");
  },
  onAppWorkspacesLoaded: (callback: (workspaces: AppWorkspace[]) => void) => {
    ipcRenderer.on("app-workspaces-loaded", (_event, workspaces) =>
      callback(workspaces),
    );
  },
  createAppWorkspace: (workspace: AppWorkspace) => {
    return ipcRenderer.invoke("app-workspace:create", workspace);
  },
  updateAppWorkspace: (workspace: AppWorkspace) => {
    return ipcRenderer.invoke("app-workspace:update", workspace);
  },
  deleteAppWorkspace: (id: string) => {
    return ipcRenderer.invoke("app-workspace:delete", id);
  },
  launchAppWorkspace: (id: string) => {
    return ipcRenderer.invoke("app-workspace:launch", id);
  },

  // App Picker (for automation)
  scanApps: (): Promise<DetectedApp[]> => {
    return ipcRenderer.invoke("apps:scan");
  },
  scanBrowsers: (): Promise<DetectedBrowser[]> => {
    return ipcRenderer.invoke("browsers:scan");
  },

  // API Explorer
  scanProject: (
    path: string,
  ): Promise<{ tree: ApiFolder[]; logs: string[] }> => {
    return ipcRenderer.invoke("api-explorer:scan-project", path);
  },

  runApiRequest: (request: ApiHttpRequest): Promise<ApiHttpResponse> => {
    return ipcRenderer.invoke("api-explorer:run-request", request);
  },

  // --- Git Management ---
  getGitSummary: (projectPath: string): Promise<GitSummary> => {
    return ipcRenderer.invoke("git:summary", projectPath);
  },
  gitPull: (projectPath: string) => {
    return ipcRenderer.invoke("git:pull", projectPath);
  },
  gitPush: (projectPath: string) => {
    return ipcRenderer.invoke("git:push", projectPath);
  },
  gitCheckout: (projectPath: string, branch: string) => {
    return ipcRenderer.invoke("git:checkout", projectPath, branch);
  },
  gitRestoreAll: (projectPath: string) => {
    return ipcRenderer.invoke("git:restore-all", projectPath);
  },
  gitStageFile: (projectPath: string, filePath: string, stage: boolean) => {
    return ipcRenderer.invoke("git:stage-file", projectPath, filePath, stage);
  },
  gitStageAll: (projectPath: string) => {
    return ipcRenderer.invoke("git:stage-all", projectPath);
  },
  gitUnstageAll: (projectPath: string) => {
    return ipcRenderer.invoke("git:unstage-all", projectPath);
  },
  gitCommit: (projectPath: string, message: string) => {
    return ipcRenderer.invoke("git:commit", projectPath, message);
  },
  onGitSummaryUpdated: (
    callback: (args: { projectId: string; summary: GitSummary }) => void,
  ) => {
    ipcRenderer.on("git:summary-updated", (_event, args) => callback(args));
  },

  // --- Dependency Management ---
  getProjectDependencies: (
    projectPath: string,
  ): Promise<{
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null> => {
    return ipcRenderer.invoke("project:get-dependencies", projectPath);
  },

  // Ghost Mode
  toggleGhostMode: () => {
    ipcRenderer.send("app:toggle-ghost-mode");
  },
  forceKillNode: () => {
    return ipcRenderer.invoke("app:force-kill-node");
  },

  // System Stats
  getSystemStats: (): Promise<SystemStats> => {
    return ipcRenderer.invoke("system:stats");
  },

  // System (Port Hunter)
  getRunningProjectPorts: (): Promise<
    Array<{
      projectId: string;
      projectName: string;
      rootPid: number;
      pids: number[];
      ports: number[];
    }>
  > => {
    return ipcRenderer.invoke("servers:project-ports");
  },
  stopRunningProject: (projectId: string): Promise<boolean> => {
    return ipcRenderer.invoke("projects:stop-running", projectId);
  },
  stopAllRunningProjects: (): Promise<boolean> => {
    return ipcRenderer.invoke("projects:stop-all-running");
  },

  // AI (OpenRouter)
  aiGenerateCommitMessage: (diff: string): Promise<string> => {
    return ipcRenderer.invoke("ai:generate-commit-message", diff);
  },
  aiGenerateCommitMessageForProject: (args: {
    projectPath: string;
    mode?: "staged" | "all";
  }): Promise<string> => {
    return ipcRenderer.invoke("ai:generate-commit-message-for-project", args);
  },
  aiExplainLog: (log: string): Promise<string> => {
    return ipcRenderer.invoke("ai:explain-log", log);
  },
  checkPorts: (): Promise<
    Array<{
      pid: number;
      port: number;
      name: string;
      memory?: string;
    }>
  > => {
    return ipcRenderer.invoke("system:check-ports");
  },
  killProcess: (pid: number): Promise<void> => {
    return ipcRenderer.invoke("system:kill-process", pid);
  },
};

// Expose the API to the renderer process via contextBridge
contextBridge.exposeInMainWorld("api", api);
