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
  requestTabs?: RequestTab[];
  activeRequestTabId?: string | null;
  environments?: any[]; // We can use ApiEnvironment[] but type is imported/defined elsewhere, using any[] is safe
  activeEnvId?: string | null;
  apiScannerTabs?: ApiProjectTab[];
  activeApiScannerTabId?: string | null;
  apiScannerTreeCache?: Record<
    string,
    {
      tree: ApiFolder[];
      logs: string[];
      selectedRouteKey?: string | null;
      potentialRoutesCount?: number;
      detectedRoutesCount?: number;
    }
  >;
  expandedFolderIds?: Record<string, string[]>;
  activeSidebarTab?: string;
  isSidebarExpanded?: boolean;
  isConsoleOpen?: boolean;
  consoleProjectId?: string | null;
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

export type ConfidenceLevel = "high" | "medium" | "low";

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
  confidence?: ConfidenceLevel;
  bodyConfidence?: ConfidenceLevel;
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
  description?: string;
  type?: "text" | "file";
};

export type ApiBody =
  | { mode: "none" }
  | { mode: "json"; text: string }
  | { mode: "text"; text: string }
  | { mode: "javascript"; text: string }
  | { mode: "html"; text: string }
  | { mode: "xml"; text: string }
  | { mode: "form-data"; fields: ApiKeyValueRow[] }
  | { mode: "urlencoded"; fields: ApiKeyValueRow[] }
  | { mode: "binary"; filePath: string };

export type ApiHttpRequest = {
  method: Method;
  url: string;
  query: ApiKeyValueRow[];
  headers: ApiKeyValueRow[];
  auth: ApiAuth;
  body: ApiBody;
  timeoutMs?: number;
};

export type CookieItem = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: string | null;
  maxAge?: number | null;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | string | null;
  raw?: string;
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
  cookies?: CookieItem[];
};

export type ApiProjectTab = {
  id: string;
  name: string;
  path: string;
  baseUrl: string;
};

export interface RequestTab {
  id: string;
  name: string;
  method: Method;
  url: string;
  params: any[];
  headers: any[];
  auth: any;
  bodyMode: any;
  bodyText: string;
  formFields: any[];
  urlencodedFields?: any[];
  binaryFilePath?: string;
  lastCompletedAt?: number;
  response: any | null;
  projectId?: string;
  routePath?: string;
  routeId?: string;
  isNew?: boolean;
  activeSubTab?: string;
  loading?: boolean;
  preRequestScript?: string;
  postResponseScript?: string;
  activeScriptSubTab?: string;
  pathVariables?: any[];
  splitPercent?: number;
}
