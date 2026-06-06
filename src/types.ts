// Define the possible status values
export type ProjectStatus = "starting" | "running" | "stopping" | "stopped";

// Define the Group type
export type Group = {
  id: string;
  name: string;
  workspacePath?: string; // Optional path to the associated .code-workspace file
};

export type Project = {
  id: string;
  name: string;
  path: string;
  startCommand: string;
  groupId?: string | null; // Link to a Group ID
  status?: ProjectStatus;
  url?: string;
};

// Define the Workspace type with new properties
export type Workspace = {
  id: string; // Unique ID for storage
  name: string; // Original name (derived from path)
  displayName: string | null; // User-defined display name
  path: string; // Full path to the .code-workspace file
  folderCount: number; // Number of folders in the workspace
  isPinned: boolean; // Pinned status
};

// Define Settings type
export type WorkspaceSettings = {
  // Renamed from Settings
  manageWorkspaces: boolean;
  workspaceSavePath: string | null;
};

export type StoreType = {
  projects: Project[];
  groups: Group[];
  settings: WorkspaceSettings;
  workspaces: Workspace[]; // Legacy: .code-workspace files
  appWorkspaces: AppWorkspace[]; // New: God Mode Workspaces
};

// --- New "God Mode" Workspace Types ---

export type AppWorkspace = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  // Use existing project/workspace IDs to link them
  projectIds: string[];
  runProjectIds?: string[];
  vsCodeWorkspaceIds: string[];

  browsers: Array<{
    id: string;
    type: "default" | "chrome" | "edge" | "firefox" | "detected";
    detectedBrowserId?: string;
    urls: string[];
    usePrivateWindow?: boolean;
    openInNewWindow?: boolean;
  }>;

  apps: Array<{
    id: string;
    name: string;
    path: string; // Absolute path to .exe or .lnk
    args?: string;
  }>;

  createdAt: number;
  lastUsedAt?: number;
};

export type DetectedApp = {
  id: string;
  name: string;
  path: string;
  // `path` can be a filesystem path (exe/lnk) or a shell path like `shell:AppsFolder\\<AppId>`
  kind: "shortcut" | "exe" | "appsfolder";
  iconDataUrl?: string;
};

export type DetectedBrowser = {
  id: string;
  name: string;
  command: string;
  exePath?: string;
  iconDataUrl?: string;
};

export type GitFileStatus = {
  path: string;
  indexStatus: string; // X from porcelain
  worktreeStatus: string; // Y from porcelain
  staged: boolean;
  untracked: boolean;
};

export type GitAheadBehind = {
  ahead: number;
  behind: number;
};

export type GitSummary = {
  isRepo: boolean;
  branch: string | null;
  upstream: string | null;
  aheadBehind: GitAheadBehind | null;
  changeCount: number;
  files: GitFileStatus[];
  branches: string[];
  lastRefreshedAt: number;
  error: string | null;
};

export type SystemStats = {
  at: number;
  cpu: { load: number; tempC: number | null };
  memory: { total: number; used: number; usedPercent: number };
  gpu: {
    name: string | null;
    load: number | null;
    tempC: number | null;
  } | null;
  fans: { rpm: number[] } | null;
  topProcess: { pid: number; name: string; cpu: number; mem: number } | null;
  sensors?: {
    status: "ok" | "unavailable" | "permission-denied";
    message?: string;
  };
};

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "ALL";

export type ApiRoute = {
  id: string;
  name: string;
  method: Method;
  path: string;

  // Optional metadata for API Explorer details panels
  file?: string;
  handler?: string;
  middlewares?: string[];
  description?: string;
  pathParams?: string[];
  inferredBodyFields?: string[];
  inferredQueryFields?: string[];
};

export type ApiFolder = {
  id: string;
  name: string;
  children: (ApiFolder | ApiRoute)[];
  isRoute?: false;
};

export const isRoute = (item: ApiFolder | ApiRoute): item is ApiRoute => {
  return (item as any).method !== undefined;
};

// --- API Explorer: Request/Response Types (v1) ---

export type ApiKeyLocation = "header" | "query";

export type ApiAuth =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "apiKey"; key: string; value: string; in: ApiKeyLocation };

export type ApiKeyValueRow = {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
};

export type ApiBody =
  | { mode: "none" }
  | { mode: "json"; text: string }
  | { mode: "text"; text: string }
  | { mode: "form"; fields: ApiKeyValueRow[] };

export type ApiHttpRequest = {
  method: Method;
  url: string;
  query: ApiKeyValueRow[];
  headers: ApiKeyValueRow[];
  auth: ApiAuth;
  body: ApiBody;
  timeoutMs?: number;
};

export type ApiHttpResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  bodyText: string;
  parsedJson?: unknown;
  error?: string;
};
