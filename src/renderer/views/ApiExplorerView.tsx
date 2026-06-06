import { useMemo, useState, useEffect } from "react";
import apiClient from "@/lib/apiClient";
import { Sidebar } from "../components/api-explorer/ApiSidebar";
import { RequestPanel } from "../components/api-explorer/RequestPanel";
import { ResponsePanel } from "../components/api-explorer/ResponsePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, RefreshCw, Play, X } from "lucide-react";

import { ApiRoute, ApiFolder, Project, ApiHttpResponse } from "../../types";

const API_EXPLORER_TABS_STORAGE_KEY = "devdash.apiExplorer.tabs.v1";
const API_EXPLORER_SCAN_CACHE_KEY = "devdash.apiExplorer.scanCache.v1";

type ApiExplorerScanCacheEntry = {
  tree: ApiFolder[];
  logs: string[];
  cachedAt: number;
  selectedRouteKey?: string | null;
};

type ApiExplorerScanCache = Record<string, ApiExplorerScanCacheEntry>;

type ApiProjectTab = {
  id: string;
  name: string;
  path: string;
  baseUrl: string;
};

type ApiExplorerViewProps = {
  projects: Project[];
};

function guessNameFromPath(p: string) {
  const normalized = String(p || "").replace(/\\+/g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  return parts[parts.length - 1] || "Project";
}

const toRouteKey = (route: Pick<ApiRoute, "method" | "path">) => {
  return `${String(route.method).toUpperCase()}:${route.path}`;
};

const findRouteByKey = (
  tree: ApiFolder[],
  routeKey: string,
): ApiRoute | null => {
  const walk = (nodes: (ApiFolder | ApiRoute)[]): ApiRoute | null => {
    for (const n of nodes) {
      if (!n) continue;
      if ((n as any).method) {
        const r = n as ApiRoute;
        if (toRouteKey(r) === routeKey) return r;
        continue;
      }
      const folder = n as ApiFolder;
      const found = walk(folder.children);
      if (found) return found;
    }
    return null;
  };

  return walk(tree as any);
};

const readScanCache = (): ApiExplorerScanCache => {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(API_EXPLORER_SCAN_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ApiExplorerScanCache;
  } catch {
    return {};
  }
};

const writeScanCache = (cache: ApiExplorerScanCache) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      API_EXPLORER_SCAN_CACHE_KEY,
      JSON.stringify(cache),
    );
  } catch {
    // ignore
  }
};

const getScanCacheEntry = (
  projectPath: string,
): ApiExplorerScanCacheEntry | null => {
  if (!projectPath) return null;
  const cache = readScanCache();
  const entry = cache[projectPath];
  if (!entry || !Array.isArray(entry.tree) || !Array.isArray(entry.logs))
    return null;
  return entry;
};

const upsertScanCacheEntry = (
  projectPath: string,
  patch: Partial<ApiExplorerScanCacheEntry>,
) => {
  if (!projectPath) return;
  const cache = readScanCache();
  const existing = cache[projectPath];
  cache[projectPath] = {
    tree: (patch.tree ?? existing?.tree ?? []) as ApiFolder[],
    logs: (patch.logs ?? existing?.logs ?? []) as string[],
    cachedAt: patch.cachedAt ?? existing?.cachedAt ?? Date.now(),
    selectedRouteKey:
      patch.selectedRouteKey !== undefined
        ? patch.selectedRouteKey
        : existing?.selectedRouteKey,
  };
  writeScanCache(cache);
};

export function ApiExplorerView({ projects }: ApiExplorerViewProps) {
  const [selectedRoute, setSelectedRoute] = useState<ApiRoute | null>(null);
  const [activeResponse, setActiveResponse] = useState<ApiHttpResponse | null>(
    null,
  );

  const handleSelectRoute = (route: ApiRoute) => {
    setSelectedRoute(route);
    // Reset response when changing routes
    setActiveResponse(null);

    if (activeTab?.path) {
      upsertScanCacheEntry(activeTab.path, {
        selectedRouteKey: toRouteKey(route),
      });
    }
  };

  const [tree, setTree] = useState<ApiFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const [tabs, setTabs] = useState<ApiProjectTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [addProjectId, setAddProjectId] = useState<string | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId],
  );

  const detectedCount = useMemo(() => {
    const countRoutes = (nodes: any[]): number => {
      let count = 0;
      for (const node of nodes) {
        if (!node) continue;
        if ((node as any).method) {
          count++;
          continue;
        }
        const children = (node as any).children;
        if (Array.isArray(children)) {
          count += countRoutes(children);
        }
      }
      return count;
    };

    return countRoutes(tree as any);
  }, [tree]);

  useEffect(() => {
    // Restore tabs from previous session.
    // Important: do NOT auto-open any project by default; user chooses.
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(API_EXPLORER_TABS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        tabs?: ApiProjectTab[];
        activeTabId?: string | null;
      };
      const restoredTabs = Array.isArray(parsed?.tabs)
        ? parsed.tabs.filter(
            (t) =>
              t &&
              typeof t.id === "string" &&
              typeof t.name === "string" &&
              typeof t.path === "string" &&
              typeof t.baseUrl === "string",
          )
        : [];

      if (restoredTabs.length === 0) return;

      setTabs(restoredTabs);
      const restoredActive =
        typeof parsed.activeTabId === "string" ? parsed.activeTabId : null;
      setActiveTabId(
        restoredActive && restoredTabs.some((t) => t.id === restoredActive)
          ? restoredActive
          : restoredTabs[0].id,
      );
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep persisted state in sync so switching views doesn't reset the tabs.
    try {
      if (typeof window === "undefined") return;
      const payload = JSON.stringify({ tabs, activeTabId });
      window.localStorage.setItem(API_EXPLORER_TABS_STORAGE_KEY, payload);
    } catch {
      // ignore
    }
  }, [tabs, activeTabId]);

  useEffect(() => {
    // If a tab corresponds to a known DevDash project, keep its name/path fresh.
    if (!projects.length) return;
    setTabs((prev) =>
      prev.map((t) => {
        const p = projects.find((x) => x.id === t.id);
        if (!p) return t;
        return {
          ...t,
          name: p.name,
          path: p.path,
        };
      }),
    );
  }, [projects]);

  useEffect(() => {
    if (!activeTab) return;
    setSelectedRoute(null);
    setActiveResponse(null);

    // Prefer cached scan results so revisiting the view doesn't trigger a full rescan.
    const cached = getScanCacheEntry(activeTab.path);
    if (cached) {
      setTree(cached.tree || []);
      setLogs(cached.logs || []);
      setLoading(false);

      if (cached.selectedRouteKey) {
        const restored = findRouteByKey(
          cached.tree || [],
          cached.selectedRouteKey,
        );
        if (restored) setSelectedRoute(restored);
      }
      return;
    }

    void scan(activeTab, { force: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const scan = async (tab: ApiProjectTab, opts?: { force?: boolean }) => {
    const force = Boolean(opts?.force);
    if (!force) {
      const cached = getScanCacheEntry(tab.path);
      if (cached) {
        setTree(cached.tree || []);
        setLogs(cached.logs || []);
        return;
      }
    }

    setLoading(true);
    setLogs([]);
    try {
      const result = await apiClient.scanProject(tab.path);
      setTree(result.tree || []);
      setLogs(result.logs || []);

      // Persist scan results so returning to the screen doesn't rescan.
      const existing = getScanCacheEntry(tab.path);
      upsertScanCacheEntry(tab.path, {
        tree: result.tree || [],
        logs: result.logs || [],
        cachedAt: Date.now(),
        selectedRouteKey: existing?.selectedRouteKey,
      });
    } catch (err) {
      console.error("Scan failed", err);
      setLogs((prev) => [...prev, `Client Error: ${err}`]);
    } finally {
      setLoading(false);
    }
  };

  const addTabFromProject = (p: Project) => {
    setTabs((prev) => {
      if (prev.some((t) => t.id === p.id)) return prev;
      return [
        ...prev,
        {
          id: p.id,
          name: p.name,
          path: p.path,
          baseUrl: "http://localhost:3000",
        },
      ];
    });
    setActiveTabId(p.id);
    setAddPopoverOpen(false);
    setAddProjectId(null);
  };

  const addTabFromFolderPick = async () => {
    const folder = await apiClient.openDirectoryDialog();
    if (!folder) return;
    const id = `folder_${Date.now()}`;
    const name = guessNameFromPath(folder);
    setTabs((prev) => [
      ...prev,
      { id, name, path: folder, baseUrl: "http://localhost:3000" },
    ]);
    setActiveTabId(id);
    setAddPopoverOpen(false);
    setAddProjectId(null);
  };

  const removeTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(next[0]?.id ?? null);
        setSelectedRoute(null);
        setActiveResponse(null);
        setTree([]);
        setLogs([]);
      }
      return next;
    });
  };

  const updateActiveBaseUrl = (baseUrl: string) => {
    if (!activeTabId) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, baseUrl } : t)),
    );
  };

  return (
    <div className="flex h-full w-full bg-[#0a0a0a] text-white overflow-hidden font-sans select-none">
      {/* SIDEBAR */}
      <div className="w-64 bg-[#0f0f0f] border-r border-white/5 flex flex-col shrink-0">
        <div
          className="h-12 border-b border-white/5 flex items-center px-4 justify-between"
          style={{ WebkitAppRegion: "drag" } as any}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-400">DevDash</span>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-500 mb-2 tracking-wider">
            PROJECTS
          </div>
          <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors mb-4">
                <span className="text-sm font-medium">Add Backend</span>
                <Plus size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[320px] bg-[#121212] border-white/10"
            >
              <div className="space-y-3">
                <div className="text-sm font-medium text-white">
                  Add project to API Explorer
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    From DevDash projects
                  </div>
                  <Select
                    value={addProjectId ?? ""}
                    onValueChange={(v) => setAddProjectId(v)}
                  >
                    <SelectTrigger className="bg-black/30 border-white/10 text-white">
                      <SelectValue placeholder="Select project..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-white/10 text-white">
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!addProjectId}
                      onClick={() => {
                        const p = projects.find((x) => x.id === addProjectId);
                        if (p) addTabFromProject(p);
                      }}
                      className="bg-primary text-white"
                    >
                      Open
                    </Button>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Or browse a folder
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full bg-white/10 hover:bg-white/20 text-white border-transparent"
                    onClick={addTabFromFolderPick}
                  >
                    Choose Folder...
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex flex-col gap-1">
            {tabs.map((t) => {
              const active = t.id === activeTabId;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveTabId(t.id)}
                  className={
                    "group px-3 py-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors " +
                    (active
                      ? "bg-white/5 border-white/10"
                      : "bg-transparent border-transparent hover:bg-white/5")
                  }
                  title={t.path}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-sm text-gray-300 truncate">
                      {t.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {loading && active ? (
                      <RefreshCw
                        size={14}
                        className="animate-spin text-blue-400"
                      />
                    ) : active ? (
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></div>
                    ) : (
                      <span
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTab(t.id);
                        }}
                      >
                        <X size={14} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <div className="h-12 border-b border-white/5 bg-[#0a0a0a] flex items-center px-4 justify-between shrink-0">
          <div className="flex gap-4 text-sm font-medium text-gray-400 h-full">
            <span className="text-white border-b-2 border-white pt-3">
              API Explorer
            </span>
            <span className="pt-3">Logs</span>
            <span className="pt-3">Git</span>
          </div>
        </div>

        <div className="flex-1 flex bg-[#050505] min-h-0">
          {/* API TREE */}
          <div className="w-72 border-r border-white/5 bg-[#0a0a0a] flex flex-col shrink-0">
            <div className="p-4 border-b border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 tracking-wider">
                  DETECTED ROUTES ({detectedCount})
                </span>
                <button
                  className="text-gray-400 hover:text-white"
                  onClick={() => activeTab && scan(activeTab, { force: true })}
                  disabled={loading || !activeTab}
                  title="Refresh Scan"
                >
                  <RefreshCw
                    size={14}
                    className={loading ? "animate-spin" : ""}
                  />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={activeTab?.baseUrl ?? ""}
                  onChange={(e) => updateActiveBaseUrl(e.target.value)}
                  placeholder="Base URL (e.g. http://localhost:3000)"
                  className="h-8 bg-black border-white/10 text-xs text-gray-300"
                  disabled={!activeTab}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="p-4 text-xs text-blue-400 flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Scanning...
                </div>
              ) : tree.length > 0 ? (
                <Sidebar
                  tree={tree}
                  selectedKey={
                    selectedRoute ? toRouteKey(selectedRoute) : undefined
                  }
                  onSelect={handleSelectRoute}
                />
              ) : (
                <div className="p-4 space-y-2">
                  <p className="text-xs text-gray-500 text-center">
                    No APIs found.
                  </p>
                  {logs.length > 0 && (
                    <div className="bg-black/40 rounded p-2 text-[10px] font-mono text-gray-500 overflow-x-auto whitespace-pre-wrap">
                      {logs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL - REQUEST/RESPONSE */}
          <div className="flex-1 p-6 flex flex-col gap-6 min-w-0 overflow-y-auto">
            {!activeTab ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                <div className="mb-4 opacity-50 relative">
                  <RefreshCw size={48} className="text-gray-400" />
                </div>
                <h3 className="text-xl text-white mb-2">No Project Selected</h3>
                <p>
                  Add or select a backend project from the sidebar to scan for
                  APIs.
                </p>
              </div>
            ) : loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-blue-400">
                <RefreshCw size={48} className="mb-4 animate-spin" />
                <h3 className="text-xl text-white mb-2">Scanning AST...</h3>
                <p className="font-mono text-sm text-gray-500">
                  Parsing Express/Next.js routes in real-time
                </p>
              </div>
            ) : !selectedRoute ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10 text-gray-400">
                  <Play size={24} />
                </div>
                <h3 className="text-xl text-white mb-2">Select an Endpoint</h3>
                <p>
                  Choose an API endpoint from the detected routes tree to start
                  testing.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full gap-4">
                <RequestPanel
                  route={selectedRoute}
                  baseUrl={activeTab?.baseUrl ?? "http://localhost:3000"}
                  draftKey={`${activeTab?.path ?? ""}::${selectedRoute.path}`}
                  onRun={(res) => setActiveResponse(res)}
                />
                <ResponsePanel response={activeResponse} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
