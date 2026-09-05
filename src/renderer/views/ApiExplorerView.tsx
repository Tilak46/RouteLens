import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/apiClient";
import { Sidebar } from "../components/api-explorer/ApiSidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  RefreshCw,
  X,
  FolderPlus,
  FileCode,
  ChevronDown,
  Search,
  FolderCode,
} from "lucide-react";
import { ApiRoute, ApiFolder, Project, isRoute } from "../../types";

export type ApiExplorerScanCacheEntry = {
  tree: ApiFolder[];
  logs: string[];
  cachedAt: number;
  selectedRouteKey?: string | null;
  potentialRoutesCount?: number;
  detectedRoutesCount?: number;
};

export type ApiExplorerScanCache = Record<string, ApiExplorerScanCacheEntry>;

export type ApiExplorerSidebarPanelProps = {
  projects: Project[];
  activeProjectId?: string | null;
  onActiveProjectIdChange?: (id: string | null) => void;
  onSelectRoute: (route: ApiRoute, baseUrl: string, projectId: string) => void;
  onBaseUrlChange?: (projectId: string, baseUrl: string) => void;
  treeCache: ApiExplorerScanCache;
  setTreeCache: React.Dispatch<React.SetStateAction<ApiExplorerScanCache>>;
  activeRouteKey?: string | null;
  onAddProjectClick?: () => void;
  onRemoveProject?: (id: string) => void;
  onRescanProject?: (project: Project) => void;
  isScanning?: boolean;
  scanningProjectId?: string | null;
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

export function mergeTrees(userTree: ApiFolder[], scannedTree: ApiFolder[]): ApiFolder[] {
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
  activeProjectId,
  onActiveProjectIdChange,
  onSelectRoute,
  onBaseUrlChange,
  treeCache,
  setTreeCache,
  activeRouteKey,
  onAddProjectClick,
  onRemoveProject,
  onRescanProject,
  isScanning,
  scanningProjectId,
}: ApiExplorerSidebarPanelProps) {
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [expandedFolderMap, setExpandedFolderMap] = useState<Record<string, string[]>>({});
  const [newlyCreatedNodeId, setNewlyCreatedNodeId] = useState<string | null>(null);

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  useEffect(() => {
    setSelectedRouteKey(activeRouteKey || null);
  }, [activeRouteKey]);

  useEffect(() => {
    if (projects.length > 0 && (!activeProjectId || !projects.some((p) => p.id === activeProjectId))) {
      onActiveProjectIdChange?.(projects[0].id);
    }
  }, [projects, activeProjectId, onActiveProjectIdChange]);

  useEffect(() => {
    apiClient.storeGet("expandedFolderIds").then((val) => {
      if (val && typeof val === "object") setExpandedFolderMap(val);
    });
  }, []);

  const expandedFolderIds = activeProject ? (expandedFolderMap[activeProject.path] || []) : [];

  const handleToggleFolderExpanded = (folderId: string, isOpen: boolean) => {
    if (!activeProject) return;
    const currentList = expandedFolderMap[activeProject.path] || [];
    const nextList = isOpen
      ? [...currentList.filter((id) => id !== folderId), folderId]
      : currentList.filter((id) => id !== folderId);
      
    const nextMap = {
      ...expandedFolderMap,
      [activeProject.path]: nextList,
    };
    setExpandedFolderMap(nextMap);
    apiClient.storeSet("expandedFolderIds", nextMap);
  };

  const currentTree = useMemo(() => {
    if (!activeProject) return [];
    return treeCache[activeProject.path]?.tree || [];
  }, [activeProject, treeCache]);

  const currentLogs = useMemo(() => {
    if (!activeProject) return [];
    return treeCache[activeProject.path]?.logs || [];
  }, [activeProject, treeCache]);

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

  const saveTreeCache = (newTree: ApiFolder[]) => {
    if (activeProject) {
      saveScanCacheEntry(activeProject.path, {
        tree: newTree,
        cachedAt: Date.now(),
      });
    }
  };

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

  const detectedCount = useMemo(() => {
    return countRoutes(currentTree);
  }, [currentTree]);

  const potentialCount = useMemo(() => {
    if (!activeProject) return 0;
    const entry = treeCache[activeProject.path];
    return entry?.potentialRoutesCount ?? detectedCount;
  }, [activeProject, treeCache, detectedCount]);

  const handleRouteClick = (route: ApiRoute) => {
    const routeKey = route.id && route.id.startsWith("request_") ? route.id : toRouteKey(route);
    setSelectedRouteKey(routeKey);

    if (activeProject?.path) {
      saveScanCacheEntry(activeProject.path, {
        selectedRouteKey: routeKey,
      });
    }
    
    onSelectRoute(route, activeProject?.url || "http://localhost:3000", activeProject?.id || "");
  };

  const updateActiveBaseUrl = (baseUrl: string) => {
    if (!activeProject) return;
    if (onBaseUrlChange) {
      onBaseUrlChange(activeProject.id, baseUrl);
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
    const next = renameRecursive(currentTree) as ApiFolder[];
    saveTreeCache(next);
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
    const next = deleteRecursive(currentTree) as ApiFolder[];
    saveTreeCache(next);
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

    const next = findAndDuplicateRecursive(currentTree) as ApiFolder[];
    saveTreeCache(next);

    if (duplicatedRequest) {
      handleRouteClick(duplicatedRequest);
      toast.success("Request duplicated successfully!");
    }
  };

  const handleCopyNode = (route: ApiRoute) => {
    const fullUrl = route.path ? `${(activeProject?.url || "http://localhost:3000").replace(/\/+$/, "")}${route.path}` : "";
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
      const next = [...currentTree, newFolder];
      saveTreeCache(next);
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
    const next = addRecursive(currentTree) as ApiFolder[];
    saveTreeCache(next);
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
      const next = [...currentTree, newRequest as any];
      saveTreeCache(next);
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
    const next = addRecursive(currentTree) as ApiFolder[];
    saveTreeCache(next);
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
    if (isDescendant(draggedId, targetNodeId || "", currentTree)) return;

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

    const treeWithoutDragged = removeNode(currentTree) as ApiFolder[];
    if (!draggedNode) return;

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
  };

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return currentTree;
    const q = searchQuery.toLowerCase().trim();

    const filterNodes = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
      const results: (ApiFolder | ApiRoute)[] = [];
      for (const node of nodes) {
        if (isRoute(node)) {
          const matchesMethod = String(node.method || "").toLowerCase().includes(q);
          const matchesPath = String(node.path || "").toLowerCase().includes(q);
          const matchesName = String(node.name || "").toLowerCase().includes(q);
          if (matchesMethod || matchesPath || matchesName) {
            results.push(node);
          }
        } else {
          const matchingChildren = filterNodes(node.children || []);
          if (matchingChildren.length > 0 || node.name.toLowerCase().includes(q)) {
            results.push({
              ...node,
              children: matchingChildren,
            });
          }
        }
      }
      return results;
    };

    return filterNodes(currentTree) as ApiFolder[];
  }, [currentTree, searchQuery]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. BACKENDS LIST */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between mb-1 select-none">
          <button
            onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground tracking-wider uppercase flex items-center gap-1.5 transition-colors focus:outline-none cursor-pointer"
          >
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform duration-200",
                !isProjectsExpanded && "-rotate-90"
              )}
            />
            <span>Backends</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted/60 text-muted-foreground font-mono">
              {projects.length}
            </span>
          </button>
          
          <button
            onClick={onAddProjectClick}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/80 border border-border/80 rounded transition-all cursor-pointer"
            title="Add backend project folder"
          >
            <Plus size={12} />
            <span>Add Backend</span>
          </button>
        </div>

        {isProjectsExpanded && (
          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1 animate-in fade-in slide-in-from-top-1 duration-200">
            {projects.length === 0 ? (
              <div 
                onClick={onAddProjectClick}
                className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border/60 hover:border-border rounded-lg p-2 select-none cursor-pointer transition-colors"
              >
                No backends linked. Click <span className="text-primary font-medium">+ Add Backend</span>.
              </div>
            ) : (
              projects.map((p) => {
                const isActive = activeProject?.id === p.id;
                const isScanningThis = scanningProjectId === p.id;
                const pTree = treeCache[p.path]?.tree || [];
                const routeCount = countRoutes(pTree);

                return (
                  <div
                    key={p.id}
                    onClick={() => onActiveProjectIdChange?.(p.id)}
                    className={cn(
                      "group px-2.5 py-1.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all duration-150 text-xs",
                      isActive
                        ? "bg-card border-border/80 text-foreground shadow-sm"
                        : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                    title={p.path}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300",
                          isScanningThis
                            ? "bg-cyan-400 animate-breathe"
                            : isActive
                            ? "bg-primary"
                            : "bg-muted-foreground/40"
                        )}
                      />
                      <span className="truncate max-w-[120px] font-medium">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {routeCount}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isScanningThis && (
                        <RefreshCw size={11} className="animate-spin text-cyan-400 mr-1" />
                      )}
                      {onRescanProject && (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-white/10 cursor-pointer"
                          title="Rescan backend routes"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRescanProject(p);
                          }}
                        >
                          <RefreshCw size={11} />
                        </button>
                      )}
                      {onRemoveProject && (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-400 p-0.5 rounded hover:bg-rose-500/10 cursor-pointer"
                          title="Remove backend"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveProject(p.id);
                          }}
                        >
                          <X size={11} />
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

      {/* 2. ENDPOINTS TREE */}
      <div className="flex-1 flex flex-col min-h-0 select-none">
        {activeProject ? (
          <>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                Endpoints
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-muted-foreground/15 text-muted-foreground rounded-full leading-none font-mono">
                  {detectedCount}/{potentialCount}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-white/5 cursor-pointer"
                  onClick={() => onRescanProject?.(activeProject)}
                  disabled={isScanning}
                  title="Rescan project routes"
                >
                  <RefreshCw size={11} className={isScanning ? "animate-spin text-cyan-400" : ""} />
                </button>
              </div>
            </div>

            <div className="space-y-2 shrink-0 mb-2">
              <Input
                value={activeProject.url || "http://localhost:3000"}
                onChange={(e) => updateActiveBaseUrl(e.target.value)}
                placeholder="Base URL (e.g. http://localhost:3000)"
                className="h-7 bg-input border-border text-xs text-foreground font-mono focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              />

              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRequest(null)}
                  className="h-7 bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/15 hover:border-emerald-500/30 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1.5 rounded-md transition-all cursor-pointer"
                  title="Add a new custom request at the root level"
                >
                  <FileCode size={11} className="text-emerald-400" />
                  + Request
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddFolder(null)}
                  className="h-7 bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/15 hover:border-blue-500/30 text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1.5 rounded-md transition-all cursor-pointer"
                  title="Add a new folder at the root level"
                >
                  <FolderPlus size={11} className="text-blue-400" />
                  + Folder
                </Button>
              </div>

              {/* Search / Filter Input */}
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter endpoints..."
                  className="h-7 pl-7 bg-card/40 border-border/60 text-xs text-foreground placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary/40"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-1 bg-card/20 rounded-lg border border-border/40 p-2">
              {isScanning && scanningProjectId === activeProject.id ? (
                <div className="p-4 text-xs text-cyan-400 flex items-center justify-center gap-2">
                  <RefreshCw size={12} className="animate-spin" /> Scanning AST routes...
                </div>
              ) : filteredTree.length > 0 ? (
                <Sidebar
                  tree={filteredTree}
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
              ) : searchQuery ? (
                <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
                  <div className="w-10 h-10 rounded-xl bg-card/60 border border-dashed border-border/80 flex items-center justify-center text-muted-foreground/60 mb-2.5">
                    <Search size={16} className="text-muted-foreground/60" />
                  </div>
                  <p className="text-xs font-medium text-foreground/85 mb-1">
                    No matching endpoints
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 max-w-[200px] mb-3 truncate">
                    No routes found for <span className="text-primary font-mono font-semibold">"{searchQuery}"</span>
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                    className="h-6 text-[11px] px-2.5 bg-secondary/40 hover:bg-secondary/70 border-border/50 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear filter
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
                  <div className="w-10 h-10 rounded-xl bg-card/60 border border-dashed border-border/80 flex items-center justify-center text-muted-foreground/60 mb-2.5">
                    <FolderCode size={18} className="text-muted-foreground/60" />
                  </div>
                  <p className="text-xs font-semibold text-foreground/85 mb-1">
                    No APIs detected
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 max-w-[210px] mb-3 leading-relaxed">
                    No API routes were found in this directory. Rescan or create a manual request.
                  </p>
                  <div className="flex items-center gap-2">
                    {onRescanProject && activeProject && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRescanProject(activeProject)}
                        disabled={isScanning}
                        className="h-6 text-[11px] px-2.5 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary cursor-pointer"
                      >
                        <RefreshCw size={10} className={cn("mr-1", isScanning && "animate-spin")} />
                        Rescan AST
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddRequest(null)}
                      className="h-6 text-[11px] px-2.5 bg-secondary/40 hover:bg-secondary/70 border-border/50 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      + Request
                    </Button>
                  </div>
                  {currentLogs.length > 0 && (
                    <div className="mt-4 w-full bg-black/30 rounded p-2 text-[9px] font-mono text-muted-foreground overflow-x-auto text-left whitespace-pre-wrap select-text max-h-28 border border-border/30">
                      {currentLogs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-muted-foreground text-xs select-none">
            <FolderCode size={28} className="text-muted-foreground/40 mb-2" />
            <p className="font-medium text-foreground mb-1">No Backend Selected</p>
            <p className="text-[11px] max-w-[180px] mb-3">Add or select a backend above to view its endpoints.</p>
            <Button
              size="sm"
              onClick={onAddProjectClick}
              className="h-7 text-xs bg-primary text-primary-foreground font-semibold cursor-pointer"
            >
              <Plus size={12} className="mr-1" /> Add Backend
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
