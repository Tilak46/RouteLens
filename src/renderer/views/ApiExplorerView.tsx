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
  potentialRoutesCount?: number;
  detectedRoutesCount?: number;
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

function indexTree(
  nodes: (ApiFolder | ApiRoute)[],
  parentId: string | null,
  state: {
    manualRequests: Map<string, ApiRoute & { parentId: string | null }>;
    customFolders: Map<string, ApiFolder & { parentId: string | null }>;
    scannedRoutes: Map<string, ApiRoute & { parentId: string | null }>;
    folderNames: Map<string, string>;
    sortOrder: Map<string | null, string[]>;
  }
) {
  const childKeys: string[] = [];
  
  for (const n of nodes) {
    if (isRoute(n)) {
      const isManual = n.id && n.id.startsWith("request_");
      const key = isManual ? n.id : toRouteKey(n);
      childKeys.push(key);
      
      if (isManual) {
        state.manualRequests.set(key, { ...n, parentId });
      } else {
        state.scannedRoutes.set(key, { ...n, parentId });
      }
    } else {
      childKeys.push(n.id);
      state.folderNames.set(n.id, n.name);
      state.customFolders.set(n.id, { ...n, parentId });
      indexTree(n.children, n.id, state);
    }
  }
  
  state.sortOrder.set(parentId, childKeys);
}

function indexScannedTree(
  nodes: (ApiFolder | ApiRoute)[],
  defaultParentPath: string[],
  state: {
    routes: Map<string, ApiRoute & { defaultParentPath: string[] }>;
  }
) {
  for (const n of nodes) {
    if (isRoute(n)) {
      const key = toRouteKey(n);
      state.routes.set(key, { ...n, defaultParentPath });
    } else {
      const folderPath = [...defaultParentPath, n.name];
      indexScannedTree(n.children, folderPath, state);
    }
  }
}

function mergeTrees(userTree: ApiFolder[], scannedTree: ApiFolder[]): ApiFolder[] {
  const userState = {
    manualRequests: new Map<string, ApiRoute & { parentId: string | null }>(),
    customFolders: new Map<string, ApiFolder & { parentId: string | null }>(),
    scannedRoutes: new Map<string, ApiRoute & { parentId: string | null }>(),
    folderNames: new Map<string, string>(),
    sortOrder: new Map<string | null, string[]>(),
  };
  indexTree(userTree, null, userState);

  const scannedState = {
    routes: new Map<string, ApiRoute & { defaultParentPath: string[] }>(),
  };
  indexScannedTree(scannedTree, [], scannedState);

  const folderPathToIdMap = new Map<string, string>();
  
  const mapFolderPaths = (nodes: (ApiFolder | ApiRoute)[], currentPath: string[]) => {
    for (const n of nodes) {
      if (!isRoute(n)) {
        const pathKey = [...currentPath, n.name].join("/");
        folderPathToIdMap.set(pathKey, n.id);
        mapFolderPaths(n.children, [...currentPath, n.name]);
      }
    }
  };
  mapFolderPaths(userTree, []);

  for (const [routeKey, userRoute] of userState.scannedRoutes) {
    const scannedRoute = scannedState.routes.get(routeKey);
    if (scannedRoute && scannedRoute.defaultParentPath.length > 0 && userRoute.parentId) {
      let userParentId: string | null = userRoute.parentId;
      if (userParentId.startsWith("folder_")) continue;
      
      for (let i = scannedRoute.defaultParentPath.length - 1; i >= 0; i--) {
        if (!userParentId) break;
        const prefixPath = scannedRoute.defaultParentPath.slice(0, i + 1).join("/");
        folderPathToIdMap.set(prefixPath, userParentId);
        const parentFolder = userState.customFolders.get(userParentId);
        userParentId = parentFolder?.parentId || null;
      }
    }
  }

  const mergedFolderChildren = new Map<string | null, (ApiFolder | ApiRoute)[]>();
  
  const addToParent = (parentId: string | null, node: ApiFolder | ApiRoute) => {
    if (!mergedFolderChildren.has(parentId)) {
      mergedFolderChildren.set(parentId, []);
    }
    mergedFolderChildren.get(parentId)!.push(node);
  };

  for (const [_, req] of userState.manualRequests) {
    addToParent(req.parentId, {
      id: req.id,
      name: req.name,
      method: req.method,
      path: req.path,
      file: req.file,
      handler: req.handler,
      middlewares: req.middlewares,
      pathParams: req.pathParams,
      inferredBodyFields: req.inferredBodyFields,
      inferredQueryFields: req.inferredQueryFields,
    } as ApiRoute);
  }

  for (const [routeKey, scannedRoute] of scannedState.routes) {
    const userRoute = userState.scannedRoutes.get(routeKey);
    let targetParentId: string | null = null;
    let finalName = scannedRoute.name;

    if (userRoute) {
      targetParentId = userRoute.parentId;
      finalName = userRoute.name;
    } else {
      let currentParentId: string | null = null;
      let pathAccumulator: string[] = [];
      
      for (const seg of scannedRoute.defaultParentPath) {
        pathAccumulator.push(seg);
        const pathKey = pathAccumulator.join("/");
        const existingId = folderPathToIdMap.get(pathKey);
        
        if (existingId) {
          currentParentId = existingId;
        } else {
          const newFolderId = `folder_scan_${Math.random().toString(36).substring(7)}`;
          const newFolder: ApiFolder = {
            id: newFolderId,
            name: seg,
            children: [],
          };
          
          userState.customFolders.set(newFolderId, { ...newFolder, parentId: currentParentId });
          folderPathToIdMap.set(pathKey, newFolderId);
          currentParentId = newFolderId;
        }
      }
      targetParentId = currentParentId;
    }

    addToParent(targetParentId, {
      ...scannedRoute,
      name: finalName,
    });
  }

  const activeFolders = new Set<string>();
  const markActive = (folderId: string) => {
    if (activeFolders.has(folderId)) return;
    activeFolders.add(folderId);
    const folder = userState.customFolders.get(folderId);
    if (folder && folder.parentId) {
      markActive(folder.parentId);
    }
  };

  for (const folderId of mergedFolderChildren.keys()) {
    if (folderId) markActive(folderId);
  }

  for (const [folderId, folder] of userState.customFolders) {
    if (folderId.startsWith("folder_")) {
      activeFolders.add(folderId);
      if (folder.parentId) markActive(folder.parentId);
    }
  }

  const folderNodes = new Map<string, ApiFolder>();
  for (const folderId of activeFolders) {
    const orig = userState.customFolders.get(folderId);
    folderNodes.set(folderId, {
      id: folderId,
      name: orig?.name || userState.folderNames.get(folderId) || "Folder",
      children: [],
    });
  }

  for (const [folderId, folder] of folderNodes) {
    const orig = userState.customFolders.get(folderId);
    const parentId = orig?.parentId || null;
    addToParent(parentId, folder);
  }

  for (const [folderId, folder] of folderNodes) {
    const children = mergedFolderChildren.get(folderId) || [];
    folder.children = children;
  }

  const rootChildren = mergedFolderChildren.get(null) || [];

  const methodOrder: Record<string, number> = {
    GET: 1,
    POST: 2,
    PUT: 3,
    PATCH: 4,
    DELETE: 5,
    ALL: 9,
  };

  const sortChildren = (nodes: (ApiFolder | ApiRoute)[], parentId: string | null) => {
    const originalOrder = userState.sortOrder.get(parentId) || [];
    
    nodes.sort((a, b) => {
      const keyA = isRoute(a) ? (a.id.startsWith("request_") ? a.id : toRouteKey(a)) : a.id;
      const keyB = isRoute(b) ? (b.id.startsWith("request_") ? b.id : toRouteKey(b)) : b.id;
      
      const idxA = originalOrder.indexOf(keyA);
      const idxB = originalOrder.indexOf(keyB);
      
      if (idxA !== -1 && idxB !== -1) {
        return idxA - idxB;
      }
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      
      const aIsRoute = isRoute(a);
      const bIsRoute = isRoute(b);
      if (aIsRoute !== bIsRoute) return aIsRoute ? 1 : -1;
      
      if (!aIsRoute && !bIsRoute) {
        return a.name.localeCompare(b.name);
      }
      
      const am = String((a as any).method);
      const bm = String((b as any).method);
      const byMethod = (methodOrder[am] ?? 99) - (methodOrder[bm] ?? 99);
      if (byMethod !== 0) return byMethod;
      return String((a as any).path).localeCompare(String((b as any).path));
    });

    for (const child of nodes) {
      if (!isRoute(child)) {
        sortChildren(child.children, child.id);
      }
    }
  };

  sortChildren(rootChildren, null);

  return rootChildren as ApiFolder[];
}

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
  const [activeTabId, setActiveTabId] = useState<string | null>(activeProjectId || null);
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [addProjectId, setAddProjectId] = useState<string | null>(null);

  const [isScannersExpanded, setIsScannersExpanded] = useState(true);
  const [isRestored, setIsRestored] = useState(false);

  // Electron Store backed treeCache is now a prop
  const [expandedFolderMap, setExpandedFolderMap] = useState<Record<string, string[]>>({});
  const [newlyCreatedNodeId, setNewlyCreatedNodeId] = useState<string | null>(null);
  const [hiddenProjectIds, setHiddenProjectIds] = useState<string[]>([]);

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
        potentialRoutesCount:
          patch.potentialRoutesCount !== undefined
            ? patch.potentialRoutesCount
            : existing?.potentialRoutesCount,
        detectedRoutesCount:
          patch.detectedRoutesCount !== undefined
            ? patch.detectedRoutesCount
            : existing?.detectedRoutesCount,
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

  const potentialCount = useMemo(() => {
    if (!activeTab) return 0;
    const entry = treeCache[activeTab.path];
    return entry?.potentialRoutesCount ?? detectedCount;
  }, [activeTab, treeCache, detectedCount]);

  // Restore state from Electron Store on mount
  useEffect(() => {
    apiClient.storeGet("expandedFolderIds").then((val) => {
      if (val && typeof val === "object") setExpandedFolderMap(val);
    });

    apiClient.storeGet("hiddenProjectIds").then((val) => {
      if (Array.isArray(val)) setHiddenProjectIds(val);
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

  // Sync internal active tab with activeProjectId prop restored from App
  useEffect(() => {
    if (activeProjectId && activeProjectId !== activeTabId && tabs.some((t) => t.id === activeProjectId)) {
      setActiveTabId(activeProjectId);
    }
  }, [activeProjectId, tabs]);

  // Propagate active project selection up to parent App
  useEffect(() => {
    if (onActiveProjectIdChange && activeTabId) {
      onActiveProjectIdChange(activeTabId);
    }
  }, [activeTabId, onActiveProjectIdChange]);

  // Sync projects with tabs: auto-add missing projects (except hidden ones), update existing project names/paths, and remove deleted projects
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

      // Add missing projects (excluding hidden ones)
      const missing = projects.filter((p) => !updated.some((t) => t.id === p.id) && !hiddenProjectIds.includes(p.id));
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
  }, [projects, isRestored, hiddenProjectIds]);

  // Auto-select tab if none is active
  useEffect(() => {
    if (isRestored && tabs.length > 0 && !activeTabId) {
      const preferred = (activeProjectId && tabs.some((t) => t.id === activeProjectId))
        ? activeProjectId
        : tabs[0].id;
      setActiveTabId(preferred);
    }
  }, [tabs, activeTabId, isRestored, activeProjectId]);

  // Run scan when switching scanned project tab
  useEffect(() => {
    if (!activeTab) {
      setSelectedRouteKey(null);
      setTree([]);
      setLogs([]);
      return;
    }
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
  }, [activeTabId, activeTab?.path, activeRouteKey, treeCache]);

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
      const existing = treeCache[tab.path];
      const currentTree = existing?.tree || [];
      const merged = currentTree.length > 0
        ? mergeTrees(currentTree, result.tree || [])
        : (result.tree || []);

      setTree(merged);
      setLogs(result.logs || []);

      saveScanCacheEntry(tab.path, {
        tree: merged,
        logs: result.logs || [],
        cachedAt: Date.now(),
        selectedRouteKey: existing?.selectedRouteKey,
        potentialRoutesCount: result.potentialRoutesCount,
        detectedRoutesCount: result.detectedRoutesCount,
      });
    } catch (err) {
      console.error("Scan failed", err);
      setLogs((prev) => [...prev, `Client Error: ${err}`]);
    } finally {
      setLoading(false);
    }
  };

  const addTabFromProject = async (p: Project) => {
    setHiddenProjectIds((prev) => {
      const next = prev.filter((x) => x !== p.id);
      apiClient.storeSet("hiddenProjectIds", next);
      return next;
    });
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
    const tabToRemove = tabs.find((t) => t.id === id);
    if (tabToRemove) {
      setTreeCache((prev) => {
        const next = { ...prev };
        delete next[tabToRemove.path];
        apiClient.storeSet("apiScannerTreeCache", next);
        return next;
      });
    }

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
    if (!id.startsWith("folder_")) {
      setHiddenProjectIds((prev) => {
        const next = [...prev.filter((x) => x !== id), id];
        apiClient.storeSet("hiddenProjectIds", next);
        return next;
      });
    }
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
                  <SelectContent className="bg-popover border-border text-foreground max-h-56 overflow-y-auto">
                    {projects.filter((p) => !tabs.some((t) => t.id === p.id)).map((p) => (
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
                          {active ? (
                            <div className="relative w-4 h-4 flex items-center justify-center">
                              {loading ? (
                                <RefreshCw size={11} className="animate-spin text-primary group-hover:hidden" />
                              ) : (
                                !project && <div className="w-1.5 h-1.5 rounded-full bg-primary group-hover:hidden" />
                              )}
                              <button
                                className="hidden group-hover:flex items-center justify-center text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-white/5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeTab(t.id);
                                }}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-white/5"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTab(t.id);
                              }}
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
              {activeTab ? `${detectedCount}/${potentialCount}` : detectedCount}
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
