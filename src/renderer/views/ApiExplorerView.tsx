import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/apiClient";
import { Sidebar } from "../components/api-explorer/ApiSidebar";
import { cn } from "@/lib/utils";
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
import { Plus, RefreshCw, X, Compass, FolderPlus, FileCode, ChevronDown, Play, Square } from "lucide-react";
import { ApiRoute, ApiFolder, Project, isRoute, ApiProjectTab } from "../../types";

const API_EXPLORER_SCAN_CACHE_KEY = "devdash.apiExplorer.scanCache.v1";

type ApiExplorerScanCacheEntry = {
  tree: ApiFolder[];
  logs: string[];
  cachedAt: number;
  selectedRouteKey?: string | null;
};

type ApiExplorerScanCache = Record<string, ApiExplorerScanCacheEntry>;

type ApiExplorerSidebarPanelProps = {
  projects: Project[];
  projectState?: Record<string, { url?: string }>;
  onSelectRoute: (route: ApiRoute, baseUrl: string, projectId: string) => void;
  onBaseUrlChange?: (projectId: string, baseUrl: string) => void;
  treeCache: ApiExplorerScanCache;
  setTreeCache: React.Dispatch<React.SetStateAction<ApiExplorerScanCache>>;
  activeProjectId?: string | null;
  onActiveProjectIdChange?: (id: string | null) => void;
  activeRouteKey?: string | null;
};

function guessNameFromPath(p: string) {
  const normalized = String(p || "").replace(/\\+/g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  return parts[parts.length - 1] || "Project";
}

const toRouteKey = (route: Pick<ApiRoute, "method" | "path">) => {
  return `${String(route.method).toUpperCase()}:${route.path}`;
};

// Local storage sync removed. Replaced by generic Electron Store getters/setters.

export function ApiExplorerSidebarPanel({
  projects,
  projectState,
  onSelectRoute,
  onBaseUrlChange,
  treeCache,
  setTreeCache,
  activeProjectId,
  onActiveProjectIdChange,
  activeRouteKey,
}: ApiExplorerSidebarPanelProps) {
  const [tree, setTree] = useState<ApiFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRouteKey(activeRouteKey || null);
  }, [activeRouteKey]);

  const [tabs, setTabs] = useState<ApiProjectTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [addProjectId, setAddProjectId] = useState<string | null>(null);

  const [isScannersExpanded, setIsScannersExpanded] = useState(true);
  const [isRestored, setIsRestored] = useState(false);

  // Electron Store backed treeCache is now a prop
  const [expandedFolderMap, setExpandedFolderMap] = useState<Record<string, string[]>>({});
  const [newlyCreatedNodeId, setNewlyCreatedNodeId] = useState<string | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId],
  );

  const saveScanCacheEntry = (
    projectPath: string,
    patch: Partial<ApiExplorerScanCacheEntry>,
  ) => {
    if (!projectPath) return;
    setTreeCache((prev) => {
      const existing = prev[projectPath];
      const updatedEntry: ApiExplorerScanCacheEntry = {
        tree: (patch.tree ?? existing?.tree ?? []) as ApiFolder[],
        logs: (patch.logs ?? existing?.logs ?? []) as string[],
        cachedAt: patch.cachedAt ?? existing?.cachedAt ?? Date.now(),
        selectedRouteKey:
          patch.selectedRouteKey !== undefined
            ? patch.selectedRouteKey
            : existing?.selectedRouteKey,
      };
      const nextCache = { ...prev, [projectPath]: updatedEntry };
      apiClient.storeSet("apiScannerTreeCache", nextCache);
      return nextCache;
    });
  };

  const expandedFolderIds = activeTab ? (expandedFolderMap[activeTab.path] || []) : [];

  const handleToggleFolderExpanded = (folderId: string, isOpen: boolean) => {
    if (!activeTab) return;
    const currentList = expandedFolderMap[activeTab.path] || [];
    const nextList = isOpen
      ? [...currentList.filter((id) => id !== folderId), folderId]
      : currentList.filter((id) => id !== folderId);
      
    const nextMap = {
      ...expandedFolderMap,
      [activeTab.path]: nextList,
    };
    setExpandedFolderMap(nextMap);
    apiClient.storeSet("expandedFolderIds", nextMap);
  };

  const toggleScannersExpanded = () => {
    const next = !isScannersExpanded;
    setIsScannersExpanded(next);
    apiClient.storeSet("scannersPanelExpanded", next);
  };

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

  // Restore state from Electron Store on mount
  useEffect(() => {
    apiClient.storeGet("expandedFolderIds").then((val) => {
      if (val && typeof val === "object") setExpandedFolderMap(val);
    });

    apiClient.storeGet("scannersPanelExpanded").then((val) => {
      if (typeof val === "boolean") setIsScannersExpanded(val);
    });

    apiClient.storeGet("apiScannerTabs").then((restoredTabsVal) => {
      const restoredTabs = Array.isArray(restoredTabsVal)
        ? restoredTabsVal.filter(
            (t) =>
              t &&
              typeof t.id === "string" &&
              typeof t.name === "string" &&
              typeof t.path === "string" &&
              typeof t.baseUrl === "string",
          )
        : [];

      if (restoredTabs.length === 0) {
        setIsRestored(true);
        return;
      }

      setTabs(restoredTabs);
      apiClient.storeGet("activeApiScannerTabId").then((restoredActiveVal) => {
        const restoredActive = typeof restoredActiveVal === "string" ? restoredActiveVal : null;
        setActiveTabId(
          restoredActive && restoredTabs.some((t) => t.id === restoredActive)
            ? restoredActive
            : restoredTabs[0].id,
        );
        setIsRestored(true);
      });
    });
  }, []);

  // Sync tabs changes to Electron Store
  useEffect(() => {
    if (!isRestored) return;
    apiClient.storeSet("apiScannerTabs", tabs);
    apiClient.storeSet("activeApiScannerTabId", activeTabId);
  }, [tabs, activeTabId, isRestored]);

  // Propagate active project selection up to parent App
  useEffect(() => {
    if (onActiveProjectIdChange) {
      onActiveProjectIdChange(activeTabId);
    }
  }, [activeTabId, onActiveProjectIdChange]);

  // Sync projects with tabs: auto-add missing projects, update existing project names/paths, and remove deleted projects
  useEffect(() => {
    if (!isRestored) return;
    setTabs((prev) => {
      // Clean up tabs whose projects no longer exist (ignore custom folders starting with "folder_")
      const cleaned = prev.filter((t) => t.id.startsWith("folder_") || projects.some((p) => p.id === t.id));
      
      // Map existing project tabs to update names/paths in case they changed
      const updated = cleaned.map((t) => {
        const p = projects.find((x) => x.id === t.id);
        if (!p) return t;
        return {
          ...t,
          name: p.name,
          path: p.path,
          baseUrl: t.baseUrl === "http://localhost:3000" && p.url ? p.url : t.baseUrl,
        };
      });

      // Add missing projects
      const missing = projects.filter((p) => !updated.some((t) => t.id === p.id));
      if (missing.length === 0) {
        // Compare to see if updated is actually different from prev
        const isSame = prev.length === updated.length && prev.every((t, i) => t.id === updated[i].id && t.name === updated[i].name && t.path === updated[i].path && t.baseUrl === updated[i].baseUrl);
        if (isSame) return prev;
        return updated;
      }

      const added = missing.map((p) => {
        let baseUrl = p.url || "http://localhost:3000";
        return {
          id: p.id,
          name: p.name,
          path: p.path,
          baseUrl,
        };
      });

      return [...updated, ...added];
    });
  }, [projects, isRestored]);

  // Auto-select first tab if none is active
  useEffect(() => {
    if (isRestored && tabs.length > 0 && !activeTabId) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId, isRestored]);

  // Run scan when switching scanned project tab
  useEffect(() => {
    if (!activeTab) return;
    setSelectedRouteKey(null);
    setTree([]);
    setLogs([]);

    // Check if we can resolve/update the baseUrl from projectState if it's currently localhost:3000 or empty
    const runningUrl = projectState?.[activeTab.id]?.url;
    if (runningUrl) {
      const cleanRunning = runningUrl.replace(/\/+$/, "");
      if (activeTab.baseUrl === "http://localhost:3000" || !activeTab.baseUrl) {
        updateActiveBaseUrl(cleanRunning);
      }
    } else {
      // Try to detect the port using the file scanner if the baseUrl is still 3000
      if (activeTab.baseUrl === "http://localhost:3000" || !activeTab.baseUrl) {
        apiClient.detectProjectPort(activeTab.path).then((port) => {
          if (port && port !== 3000) {
            updateActiveBaseUrl(`http://localhost:${port}`);
          }
        });
      }
    }

    const cached = treeCache[activeTab.path];
    if (cached) {
      setTree(cached.tree || []);
      setLogs(cached.logs || []);
      setLoading(false);
      if (activeRouteKey) {
        setSelectedRouteKey(activeRouteKey);
      } else if (cached.selectedRouteKey) {
        setSelectedRouteKey(cached.selectedRouteKey);
      }
      return;
    }

    void scan(activeTab, { force: false });
  }, [activeTabId]);

  const scan = async (tab: ApiProjectTab, opts?: { force?: boolean }) => {
    const force = Boolean(opts?.force);
    if (!force) {
      const cached = treeCache[tab.path];
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

      const existing = treeCache[tab.path];
      saveScanCacheEntry(tab.path, {
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

  const addTabFromProject = async (p: Project) => {
    let port: number | null = null;
    
    // 1. Check if running in DevDash
    try {
      const runningPorts = await window.api.getRunningProjectPorts().catch(() => []);
      const match = runningPorts.find((r) => r.projectId === p.id);
      if (match && match.ports && match.ports.length > 0) {
        port = match.ports[0];
      }
    } catch (e) {
      console.warn("Failed to query running project ports:", e);
    }

    // 2. Fall back to static config scan
    if (!port) {
      port = await apiClient.detectProjectPort(p.path).catch(() => null);
    }

    const finalPort = port || 3000;
    const baseUrl = `http://localhost:${finalPort}`;

    setTabs((prev) => {
      if (prev.some((t) => t.id === p.id)) return prev;
      return [
        ...prev,
        {
          id: p.id,
          name: p.name,
          path: p.path,
          baseUrl,
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

    // Detect port from files
    const port = await apiClient.detectProjectPort(folder).catch(() => null);
    const finalPort = port || 3000;
    const baseUrl = `http://localhost:${finalPort}`;

    setTabs((prev) => [
      ...prev,
      { id, name, path: folder, baseUrl },
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
        setSelectedRouteKey(null);
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
    if (onBaseUrlChange) {
      onBaseUrlChange(activeTabId, baseUrl);
    }
  };

  const handleRouteClick = (route: ApiRoute) => {
    const routeKey = route.id && route.id.startsWith("request_") ? route.id : toRouteKey(route);
    setSelectedRouteKey(routeKey);

    if (activeTab?.path) {
      saveScanCacheEntry(activeTab.path, {
        selectedRouteKey: routeKey,
      });
    }
    
    // Bubble route click up to parent tabbed workspace container
    onSelectRoute(route, activeTab?.baseUrl ?? "http://localhost:3000", activeTab?.id || "");
  };

  const saveTreeCache = (newTree: ApiFolder[]) => {
    if (activeTab) {
      saveScanCacheEntry(activeTab.path, {
        tree: newTree,
        cachedAt: Date.now(),
      });
    }
  };

  const handleRenameNode = (nodeId: string, newName: string) => {
    const renameRecursive = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
      return nodes.map((n) => {
        if (n.id === nodeId) {
          return { ...n, name: newName };
        }
        if (!isRoute(n) && Array.isArray(n.children)) {
          return { ...n, children: renameRecursive(n.children) as (ApiFolder | ApiRoute)[] };
        }
        return n;
      });
    };
    setTree((prev) => {
      const next = renameRecursive(prev) as ApiFolder[];
      saveTreeCache(next);
      return next;
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    const deleteRecursive = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
      return nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => {
          if (!isRoute(n) && Array.isArray(n.children)) {
            return { ...n, children: deleteRecursive(n.children) as (ApiFolder | ApiRoute)[] };
          }
          return n;
        });
    };
    setTree((prev) => {
      const next = deleteRecursive(prev) as ApiFolder[];
      saveTreeCache(next);
      return next;
    });
  };

  const handleDuplicateNode = (nodeId: string) => {
    let duplicatedRequest: ApiRoute | null = null;

    const findAndDuplicateRecursive = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
      const result: (ApiFolder | ApiRoute)[] = [];
      for (const n of nodes) {
        if (n.id === nodeId && isRoute(n)) {
          result.push(n);
          duplicatedRequest = {
            ...n,
            id: `request_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: `${n.name} Copy`,
            isNew: true,
          };
          result.push(duplicatedRequest);
        } else if (!isRoute(n) && Array.isArray(n.children)) {
          result.push({
            ...n,
            children: findAndDuplicateRecursive(n.children) as (ApiFolder | ApiRoute)[],
          });
        } else {
          result.push(n);
        }
      }
      return result;
    };

    setTree((prev) => {
      const next = findAndDuplicateRecursive(prev) as ApiFolder[];
      saveTreeCache(next);
      return next;
    });

    if (duplicatedRequest) {
      handleRouteClick(duplicatedRequest);
      toast.success("Request duplicated successfully!");
    }
  };

  const handleCopyNode = (route: ApiRoute) => {
    const fullUrl = route.path ? `${(activeTab?.baseUrl || "http://localhost:3000").replace(/\/+$/, "")}${route.path}` : "";
    navigator.clipboard.writeText(fullUrl || route.name);
    toast.success("Request URL copied to clipboard!");
  };

  const handleAddFolder = (parentFolderId: string | null) => {
    const newFolder: ApiFolder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: "New Folder",
      children: [],
    };
    setNewlyCreatedNodeId(newFolder.id);

    if (parentFolderId === null) {
      setTree((prev) => {
        const next = [...prev, newFolder];
        saveTreeCache(next);
        return next;
      });
      return;
    }

    const addRecursive = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
      return nodes.map((n) => {
        if (n.id === parentFolderId && !isRoute(n)) {
          return { ...n, children: [...(n.children || []), newFolder] };
        }
        if (!isRoute(n) && Array.isArray(n.children)) {
          return { ...n, children: addRecursive(n.children) as (ApiFolder | ApiRoute)[] };
        }
        return n;
      });
    };
    setTree((prev) => {
      const next = addRecursive(prev) as ApiFolder[];
      saveTreeCache(next);
      return next;
    });
  };

  const handleAddRequest = (parentFolderId: string | null) => {
    const newRequest: ApiRoute & { isNew?: boolean } = {
      id: `request_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: "New Request",
      method: "GET",
      path: "",
      isNew: true,
    };

    if (parentFolderId === null) {
      setTree((prev) => {
        const next = [...prev, newRequest as any];
        saveTreeCache(next);
        return next;
      });
      handleRouteClick(newRequest);
      return;
    }

    const addRecursive = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
      return nodes.map((n) => {
        if (n.id === parentFolderId && !isRoute(n)) {
          return { ...n, children: [...(n.children || []), newRequest] };
        }
        if (!isRoute(n) && Array.isArray(n.children)) {
          return { ...n, children: addRecursive(n.children) as (ApiFolder | ApiRoute)[] };
        }
        return n;
      });
    };
    setTree((prev) => {
      const next = addRecursive(prev) as ApiFolder[];
      saveTreeCache(next);
      return next;
    });
    handleRouteClick(newRequest);
  };

  const findNode = (id: string, nodes: (ApiFolder | ApiRoute)[]): ApiFolder | ApiRoute | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (!isRoute(n) && Array.isArray(n.children)) {
        const found = findNode(id, n.children);
        if (found) return found;
      }
    }
    return null;
  };

  const isDescendant = (parentId: string, childId: string, nodes: (ApiFolder | ApiRoute)[]): boolean => {
    const parentNode = findNode(parentId, nodes);
    if (!parentNode || isRoute(parentNode)) return false;
    
    const checkChildren = (children: (ApiFolder | ApiRoute)[]): boolean => {
      for (const c of children) {
        if (c.id === childId) return true;
        if (!isRoute(c) && Array.isArray(c.children) && checkChildren(c.children)) {
          return true;
        }
      }
      return false;
    };
    return checkChildren(parentNode.children);
  };

  const handleMoveNode = (
    draggedId: string,
    targetNodeId: string | null,
    position: "inside" | "before" | "after" = "inside"
  ) => {
    if (draggedId === targetNodeId) return;
    if (isDescendant(draggedId, targetNodeId || "", tree)) return;

    let draggedNode: ApiFolder | ApiRoute | null = null;
    const removeNode = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
      const filtered = nodes.filter((n) => {
        if (n.id === draggedId) {
          draggedNode = n;
          return false;
        }
        return true;
      });
      return filtered.map((n) => {
        if (!isRoute(n) && Array.isArray(n.children)) {
          return { ...n, children: removeNode(n.children) as (ApiFolder | ApiRoute)[] };
        }
        return n;
      });
    };

    setTree((prev) => {
      const treeWithoutDragged = removeNode(prev) as ApiFolder[];
      if (!draggedNode) return prev;

      const insertNode = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
        const idx = nodes.findIndex((n) => n.id === targetNodeId);
        if (idx !== -1) {
          const result = [...nodes];
          if (position === "inside" && !isRoute(result[idx])) {
            const folder = result[idx] as ApiFolder;
            result[idx] = {
              ...folder,
              children: [...(folder.children || []), draggedNode!],
            };
          } else if (position === "before") {
            result.splice(idx, 0, draggedNode!);
          } else {
            result.splice(idx + 1, 0, draggedNode!);
          }
          return result;
        }

        return nodes.map((n) => {
          if (!isRoute(n) && Array.isArray(n.children)) {
            return { ...n, children: insertNode(n.children) as (ApiFolder | ApiRoute)[] };
          }
          return n;
        });
      };

      let next: ApiFolder[];
      if (targetNodeId === null) {
        next = [...treeWithoutDragged, draggedNode as ApiFolder];
      } else {
        next = insertNode(treeWithoutDragged) as ApiFolder[];
      }

      saveTreeCache(next);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. PROJECT SCAN SELECTOR */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between mb-1 select-none">
          <button
            onClick={toggleScannersExpanded}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground tracking-wider uppercase flex items-center gap-1.5 transition-colors focus:outline-none"
          >
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform duration-200",
                !isScannersExpanded && "-rotate-90"
              )}
            />
            <span>Route Scanners</span>
          </button>
          
          <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/80 border border-border/80 rounded transition-all"
                title="Add API Project Folder to scan"
              >
                <Plus size={12} />
                <span>Link API</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[280px] bg-popover border-border text-foreground p-3 space-y-3 z-50 shadow-xl">
              <div className="text-xs font-semibold text-foreground">
                Link Backend Route Scanner
              </div>
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground">Select local server project</div>
                <Select
                  value={addProjectId ?? ""}
                  onValueChange={(v) => setAddProjectId(v)}
                >
                  <SelectTrigger className="bg-input border-border/80 text-xs text-foreground h-8">
                    <SelectValue placeholder="Choose project..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-foreground">
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
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
                    className="h-7 text-xs bg-primary text-primary-foreground font-semibold"
                  >
                    Open
                  </Button>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground">Or pick directories manually</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent border-border hover:bg-white/5 text-xs h-8"
                  onClick={addTabFromFolderPick}
                >
                  Browse Folder...
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* List of scanned projects */}
        {isScannersExpanded && (
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1 animate-in fade-in slide-in-from-top-1 duration-200">
            {tabs.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-2 select-none">
                No API directories linked.
              </div>
            ) : (
                  tabs.map((t) => {
                    const active = t.id === activeTabId;
                    const project = projects.find((p) => p.id === t.id);
                    const pState = projectState?.[t.id];
                    const serverStatus = pState?.status || "stopped";
                    const isRunning = serverStatus === "running";
                    const isStarting = serverStatus === "starting";
                    const isStopping = serverStatus === "stopping";

                    return (
                      <div
                        key={t.id}
                        onClick={() => setActiveTabId(t.id)}
                        className={cn(
                           "group px-2.5 py-1.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all duration-150 text-xs",
                          active
                            ? "bg-card border-border/80 text-foreground"
                            : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                        )}
                        title={t.path}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {project && (
                            <div
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300",
                                isRunning
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                                  : isStarting
                                  ? "bg-amber-500 animate-pulse"
                                  : isStopping
                                  ? "bg-rose-500 animate-pulse"
                                  : "bg-zinc-500"
                              )}
                              title={`Server: ${serverStatus}`}
                            />
                          )}
                          <span className="truncate max-w-[130px] font-medium">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Server controls for registered projects */}
                          {project && (
                            <div className="flex items-center shrink-0">
                              {isStarting || isStopping ? (
                                <RefreshCw size={10} className="animate-spin text-amber-400" />
                              ) : (
                                <button
                                  className={cn(
                                    "flex items-center justify-center p-0.5 rounded hover:bg-white/5 transition-all text-muted-foreground",
                                    isRunning ? "hover:text-rose-400" : "hover:text-emerald-400",
                                    isRunning ? "opacity-60 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  )}
                                  title={isRunning ? "Stop Server" : "Start Server"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    apiClient.toggleServer(project);
                                  }}
                                >
                                  {isRunning ? (
                                    <Square size={10} fill="currentColor" />
                                  ) : (
                                    <Play size={10} fill="currentColor" />
                                  )}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Delete button (only show for manual folders) */}
                          {!project && (
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-white/5"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTab(t.id);
                              }}
                              title="Unlink Folder"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-border/50 shrink-0" />

      {/* 2. DETECTED ROUTES */}
      <div className="flex-1 flex flex-col min-h-0 select-none">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
            Detected Endpoints
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-muted-foreground/15 text-muted-foreground rounded-full leading-none font-mono">
              {detectedCount}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-white/5"
              onClick={() => activeTab && scan(activeTab, { force: true })}
              disabled={loading || !activeTab}
              title="Rescan project routes"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {activeTab && (
          <div className="space-y-3 shrink-0 mb-3">
            <div className="space-y-1">
              {/* <div className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase">
                Base URL for request paths
              </div> */}
              <Input
                value={activeTab.baseUrl}
                onChange={(e) => updateActiveBaseUrl(e.target.value)}
                placeholder="Base URL (e.g. http://localhost:3000)"
                className="h-8 bg-input border-border text-xs text-foreground font-mono focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddRequest(null)}
                className="h-8 bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/15 hover:border-emerald-500/30 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1.5 rounded-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                title="Add a new custom request at the root level"
              >
                <FileCode size={11} className="text-emerald-400" />
                New Request
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddFolder(null)}
                className="h-8 bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/15 hover:border-blue-500/30 text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1.5 rounded-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                title="Add a new folder at the root level"
              >
                <FolderPlus size={11} className="text-blue-400" />
                New Folder
              </Button>
            </div>
          </div>
        )}

        <div className="flex-grow overflow-y-auto pr-1 bg-card/20 rounded-lg border border-border/40 p-2">
          {loading ? (
            <div className="p-4 text-xs text-primary flex items-center justify-center gap-2">
              <RefreshCw size={12} className="animate-spin" /> Scanning files...
            </div>
          ) : tree.length > 0 ? (
            <Sidebar
              tree={tree}
              selectedKey={selectedRouteKey || undefined}
              onSelect={handleRouteClick}
              onRenameNode={handleRenameNode}
              onDeleteNode={handleDeleteNode}
              onAddFolder={handleAddFolder}
              onAddRequest={handleAddRequest}
              onMoveNode={handleMoveNode}
              expandedFolderIds={expandedFolderIds}
              onToggleFolderExpanded={handleToggleFolderExpanded}
              newlyCreatedNodeId={newlyCreatedNodeId}
              onClearNewlyCreatedNodeId={() => setNewlyCreatedNodeId(null)}
              onDuplicateNode={handleDuplicateNode}
              onCopyNode={handleCopyNode}
            />
          ) : (
            <div className="p-4 space-y-2 select-none text-center">
              <p className="text-xs text-muted-foreground">No APIs detected.</p>
              {logs.length > 0 && (
                <div className="bg-black/30 rounded p-2 text-[9px] font-mono text-muted-foreground overflow-x-auto text-left whitespace-pre-wrap select-text max-h-32">
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
