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
  onCancelScanProject?: (project: Project) => void;
  onRenameNode?: (nodeId: string, newName: string) => void;
  onDeleteNode?: (nodeIds: string | string[]) => void;
  isScanning?: boolean;
  scanningProjectId?: string | null;
};

function guessNameFromPath(p: string) {
  const normalized = String(p || "").replace(/\\+/g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  return parts[parts.length - 1] || "Project";
}

export function extractRoutePath(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let s = rawUrl.trim();
  // Strip protocol (http://, https://)
  s = s.replace(/^https?:\/\//i, "");
  // Strip environment variable host placeholders, e.g. {{baseUrl}}, {{host}}:{{port}}
  s = s.replace(/^(\{\{[^}]+\}\}:?)+/, "");
  // Strip host/port
  s = s.replace(/^[a-zA-Z0-9.-]+(:\d+)?/, "");
  // Strip query string and fragment
  s = s.replace(/[?#].*$/, "");
  // Ensure leading slash if not empty
  if (s && !s.startsWith("/")) {
    s = "/" + s;
  }
  return s;
}

export const toRouteKey = (route: Pick<ApiRoute, "method" | "path">) => {
  const method = String(route.method || "GET").toUpperCase();
  let p = String(route.path || "").trim();
  if (p && !p.startsWith("/")) {
    p = "/" + p;
  }
  return `${method}:${p}`;
};

export function hasUserCustomization(route: ApiRoute): boolean {
  if (route.isManual) return true;
  if (route.id && route.id.startsWith("request_")) return true;
  if (Array.isArray(route.headers) && route.headers.length > 0) return true;
  if (route.auth && route.auth.type && route.auth.type !== "none") return true;
  if (route.preRequestScript && route.preRequestScript.trim() !== "") return true;
  if (route.postResponseScript && route.postResponseScript.trim() !== "") return true;
  if (route.bodyMode && route.bodyMode !== "none" && route.bodyMode !== "json") return true;
  if (
    route.bodyText &&
    route.bodyText.trim() !== "" &&
    route.bodyText.trim() !== "{\n  \n}" &&
    route.bodyText.trim() !== "{}"
  ) {
    return true;
  }
  if (Array.isArray(route.formFields) && route.formFields.length > 0) return true;
  if (Array.isArray(route.urlencodedFields) && route.urlencodedFields.length > 0) return true;
  if (route.binaryFilePath && route.binaryFilePath.trim() !== "") return true;
  if (Array.isArray(route.params) && route.params.some((p) => p.value && p.value.trim() !== "")) return true;
  return false;
}

const normKey = (r: Pick<ApiRoute, "method" | "path">) => {
  const method = String(r.method || "GET").toUpperCase();
  const p = String(r.path || "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .replace(/[:{][^/]+[}]?/g, ":param");
  return `${method}:${p || "/"}`;
};

export function mergeTrees(userTree: ApiFolder[], scannedTree: ApiFolder[]): ApiFolder[] {
  // 1. Index all user routes, custom folders, and manual requests
  const userRoutesById = new Map<string, ApiRoute>();
  const userRoutesByKey = new Map<string, ApiRoute>();
  const userRoutesByNormKey = new Map<string, ApiRoute>();
  const manualRequests: { route: ApiRoute; parentFolderPath: string[] }[] = [];

  function indexUserNodes(
    nodes: (ApiFolder | ApiRoute)[],
    currentFolderPath: string[]
  ) {
    for (const n of nodes) {
      if (isRoute(n)) {
        const isManual = Boolean(n.id?.startsWith("request_") || n.isManual);
        if (isManual) {
          manualRequests.push({
            route: { ...n, isManual: true },
            parentFolderPath: [...currentFolderPath],
          });
        } else {
          if (n.id) userRoutesById.set(n.id, n);
          userRoutesByKey.set(toRouteKey(n), n);
          userRoutesByNormKey.set(normKey(n), n);
        }
      } else {
        const nextPath = [...currentFolderPath, n.name];
        if (Array.isArray(n.children)) {
          indexUserNodes(n.children, nextPath);
        }
      }
    }
  }
  indexUserNodes(userTree, []);

  const matchedUserIds = new Set<string>();
  const matchedUserKeys = new Set<string>();

  // 2. Clone and enrich scannedTree with user request configurations
  function enrichScannedNodes(nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] {
    return nodes.map((node) => {
      if (isRoute(node)) {
        const key = toRouteKey(node);
        const nk = normKey(node);
        const userRoute =
          (node.id ? userRoutesById.get(node.id) : undefined) ||
          userRoutesByKey.get(key) ||
          userRoutesByNormKey.get(nk);

        if (userRoute) {
          if (userRoute.id) matchedUserIds.add(userRoute.id);
          matchedUserKeys.add(toRouteKey(userRoute));
          matchedUserKeys.add(normKey(userRoute));
        }

        let defaultBodyText = "{\n  \n}";
        if (Array.isArray(node.inferredBodyFields) && node.inferredBodyFields.length > 0) {
          const template: Record<string, string> = {};
          node.inferredBodyFields.forEach((field) => {
            template[field] = "";
          });
          defaultBodyText = JSON.stringify(template, null, 2);
        }

        const merged: ApiRoute = {
          ...node,
          id: userRoute?.id || node.id,
          name: node.name,
          method: node.method,
          path: node.path,
          url: userRoute?.url || node.url,
          params:
            userRoute?.params !== undefined
              ? userRoute.params
              : node.inferredQueryFields?.map((field) => ({
                  id: `query_${field}_${Math.random().toString(36).slice(2, 5)}`,
                  enabled: true,
                  key: field,
                  value: "",
                })) || [],
          headers: userRoute?.headers || [],
          auth: userRoute?.auth || { type: "none" },
          bodyMode:
            userRoute?.bodyMode ||
            (node.method === "GET" || node.method === "HEAD" ? "none" : "json"),
          bodyText:
            userRoute?.bodyText !== undefined ? userRoute.bodyText : defaultBodyText,
          formFields: userRoute?.formFields || [],
          urlencodedFields: userRoute?.urlencodedFields || [],
          binaryFilePath: userRoute?.binaryFilePath || "",
          preRequestScript: userRoute?.preRequestScript || "",
          postResponseScript: userRoute?.postResponseScript || "",
          pathVariables: userRoute?.pathVariables || [],
          isManual: false,
          isStale: false,
        };
        return merged;
      } else {
        return {
          ...node,
          children: enrichScannedNodes(node.children || []),
        };
      }
    });
  }

  const resultTree = enrichScannedNodes(scannedTree);

  // Helper to find folder in resultTree by path
  const findFolderByPath = (
    tree: (ApiFolder | ApiRoute)[],
    path: string[]
  ): ApiFolder | null => {
    if (path.length === 0) return null;
    let currentNodes = tree;
    let targetFolder: ApiFolder | null = null;
    for (const seg of path) {
      const found = currentNodes.find(
        (n) => !isRoute(n) && n.name.toLowerCase() === seg.toLowerCase()
      ) as ApiFolder | undefined;
      if (!found) return null;
      targetFolder = found;
      currentNodes = found.children;
    }
    return targetFolder;
  };

  // 3. Attach manual requests
  for (const item of manualRequests) {
    const parentFolder = findFolderByPath(resultTree, item.parentFolderPath);
    if (parentFolder) {
      parentFolder.children.push(item.route);
    } else {
      resultTree.push(item.route);
    }
  }

  // 4. Retain customized missing routes (only if genuinely customized)
  for (const [id, userRoute] of userRoutesById) {
    const key = toRouteKey(userRoute);
    const nk = normKey(userRoute);
    if (
      !matchedUserIds.has(id) &&
      !matchedUserKeys.has(key) &&
      !matchedUserKeys.has(nk)
    ) {
      if (hasUserCustomization(userRoute)) {
        resultTree.push({ ...userRoute, isStale: true });
      }
    }
  }

  // 5. Deterministic Sort: Folders A-Z first, then Routes by Method then Path
  const methodOrder: Record<string, number> = {
    GET: 1,
    POST: 2,
    PUT: 3,
    PATCH: 4,
    DELETE: 5,
    ALL: 9,
  };

  const sortNodes = (nodes: (ApiFolder | ApiRoute)[]) => {
    nodes.sort((a, b) => {
      const aIsRoute = isRoute(a);
      const bIsRoute = isRoute(b);
      if (aIsRoute !== bIsRoute) return aIsRoute ? 1 : -1;

      if (!aIsRoute && !bIsRoute) {
        return a.name.localeCompare(b.name);
      }

      const am = String((a as ApiRoute).method || "");
      const bm = String((b as ApiRoute).method || "");
      const byMethod = (methodOrder[am] ?? 99) - (methodOrder[bm] ?? 99);
      if (byMethod !== 0) return byMethod;
      return String((a as ApiRoute).path || "").localeCompare(String((b as ApiRoute).path || ""));
    });

    for (const child of nodes) {
      if (!isRoute(child) && Array.isArray(child.children)) {
        sortNodes(child.children);
      }
    }
  };

  sortNodes(resultTree);

  return resultTree as ApiFolder[];
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
  onCancelScanProject,
  onRenameNode,
  onDeleteNode,
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
    onRenameNode?.(nodeId, newName);
  };

  const handleDeleteNode = (nodeId: string) => {
    // 1. Collect all descendant IDs to cleanly cascade tab closures
    const deletedIds: string[] = [];
    const collectIds = (n: ApiFolder | ApiRoute) => {
      deletedIds.push(n.id);
      if (!isRoute(n) && Array.isArray(n.children)) {
        n.children.forEach(collectIds);
      }
    };
    const target = findNode(nodeId, currentTree);
    if (target) {
      collectIds(target);
    } else {
      deletedIds.push(nodeId);
    }

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
    onDeleteNode?.(deletedIds);
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
            isManual: true,
            isStale: false,
            isNew: true,
            params: (n.params || []).map((p) => ({ ...p })),
            headers: (n.headers || []).map((h) => ({ ...h })),
            auth: n.auth ? JSON.parse(JSON.stringify(n.auth)) : { type: "none" },
            formFields: (n.formFields || []).map((f) => ({ ...f })),
            urlencodedFields: (n.urlencodedFields || []).map((u) => ({ ...u })),
            pathVariables: (n.pathVariables || []).map((pv) => ({ ...pv })),
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

    // Auto-expand parent folder so the new folder is visible
    handleToggleFolderExpanded(parentFolderId, true);

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
      isManual: true,
      isNew: true,
      params: [],
      headers: [],
      auth: { type: "none" },
      bodyMode: "none",
      bodyText: "{\n  \n}",
      formFields: [],
      urlencodedFields: [],
      binaryFilePath: "",
      preRequestScript: "",
      postResponseScript: "",
      pathVariables: [],
    };

    if (parentFolderId === null) {
      const next = [...currentTree, newRequest as any];
      saveTreeCache(next);
      handleRouteClick(newRequest);
      return;
    }

    // Auto-expand parent folder so the new request is visible
    handleToggleFolderExpanded(parentFolderId, true);

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

    let inserted = false;
    const insertNode = (nodes: (ApiFolder | ApiRoute)[]): (ApiFolder | ApiRoute)[] => {
      const idx = nodes.findIndex((n) => n.id === targetNodeId);
      if (idx !== -1) {
        inserted = true;
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
      // Fallback: if target wasn't found, keep node at root to prevent data loss
      if (!inserted) {
        next = [...treeWithoutDragged, draggedNode as ApiFolder];
      }
    }

    if (position === "inside" && targetNodeId) {
      handleToggleFolderExpanded(targetNodeId, true);
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
    <div className="flex flex-col flex-1 h-full min-h-0 space-y-3 isolate transform-gpu">
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
                      {isScanningThis ? (
                        <button
                          className="text-cyan-400 hover:text-rose-400 p-0.5 rounded hover:bg-rose-500/10 cursor-pointer flex items-center gap-1 text-[10px]"
                          title="Cancel active scan"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelScanProject?.(p);
                          }}
                        >
                          <RefreshCw size={11} className="animate-spin" />
                          <span className="text-[9px] text-muted-foreground hover:text-rose-400">Stop</span>
                        </button>
                      ) : (
                        onRescanProject && (
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
                        )
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
                  {detectedCount}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                {isScanning ? (
                  <button
                    className="text-cyan-400 hover:text-rose-400 p-0.5 px-1.5 rounded hover:bg-rose-500/10 cursor-pointer flex items-center gap-1 text-[10px]"
                    onClick={() => onCancelScanProject?.(activeProject)}
                    title="Stop active scan"
                  >
                    <RefreshCw size={11} className="animate-spin text-cyan-400" />
                    <span className="text-[9px] text-muted-foreground hover:text-rose-400 font-medium">Cancel</span>
                  </button>
                ) : (
                  <button
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-white/5 cursor-pointer"
                    onClick={() => onRescanProject?.(activeProject)}
                    title="Rescan project routes"
                  >
                    <RefreshCw size={11} />
                  </button>
                )}
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

            <div
              className="flex-1 min-h-0 overflow-y-auto pr-1 bg-card/20 rounded-lg border border-border/40 p-2 transform-gpu"
              style={{ transform: "translateZ(0)", willChange: "scroll-position" }}
            >
              {isScanning && scanningProjectId === activeProject?.id ? (
                <div className="p-4 text-xs text-cyan-400 flex items-center justify-center gap-2">
                  <RefreshCw size={12} className="animate-spin" /> Scanning endpoints...
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
                    {isScanning && activeProject ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCancelScanProject?.(activeProject)}
                        className="h-6 text-[11px] px-2.5 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 cursor-pointer"
                      >
                        <RefreshCw size={10} className="mr-1 animate-spin text-rose-400" />
                        Cancel Scan
                      </Button>
                    ) : onRescanProject && activeProject ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRescanProject(activeProject)}
                        className="h-6 text-[11px] px-2.5 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary cursor-pointer"
                      >
                        <RefreshCw size={10} className="mr-1" />
                        Rescan Routes
                      </Button>
                    ) : null}
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
