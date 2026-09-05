import { useState, useEffect, useMemo, useRef } from "react";
import {
  Project,
  Group,
  ProjectStatus,
  Workspace,
  AppWorkspace,
  WorkspaceSettings,
  GitSummary,
  Method,
  ApiRoute,
  ApiFolder,
  ApiHttpResponse,
} from "@/../types";
import { AddProjectModal } from "@/components/AddProjectModal";
import { EditProjectModal } from "@/components/EditProjectModal";
import { EditWorkspaceNameModal } from "@/components/EditWorkspaceNameModal";
import { AppWorkspaceConfigModal as CreateAppWorkspaceModal } from "@/components/CreateAppWorkspaceModal";
import { DevToolsModal } from "@/components/DevToolsModal";
import { DashboardLayout, SidebarTab } from "@/layouts/DashboardLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/apiClient";
import { Toaster, toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Compass, Plus, Server, Zap, Hourglass, FolderCode, Send } from "lucide-react";

import { ApiExplorerSidebarPanel, mergeTrees } from "@/views/ApiExplorerView";
import { AutomationsPanel } from "@/components/api-explorer/AutomationsPanel";
import { SettingsSidebarPanel } from "@/components/api-explorer/SettingsSidebarPanel";

// Main workspace panels
import { WorkspaceTabs, RequestTab } from "@/components/api-explorer/WorkspaceTabs";
import { RequestPanel } from "@/components/api-explorer/RequestPanel";
import { ResponsePanel } from "@/components/api-explorer/ResponsePanel";
import { ManageEnvironmentsModal, ApiEnvironment } from "@/components/api-explorer/ManageEnvironmentsModal";
import { ManageCookiesModal } from "@/components/api-explorer/ManageCookiesModal";
import { OnboardingView } from "@/components/onboarding/OnboardingView";
import GhostHunter from "@/components/game/GhostHunter";
import GamingHUDCursor from "@/components/game/GamingHUDCursor";

const defaultTab = (projectId?: string | null): RequestTab => ({
  id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  name: "Untitled Request",
  method: "GET",
  url: "",
  params: [],
  headers: [],
  auth: { type: "none" },
  bodyMode: "none",
  bodyText: "{\n\n}",
  formFields: [],
  urlencodedFields: [],
  binaryFilePath: "",
  lastCompletedAt: 0,
  response: null,
  projectId: projectId || undefined,
  preRequestScript: "",
  postResponseScript: "",
  activeScriptSubTab: "prerequest",
  pathVariables: [],
  splitPercent: 50,
});

// State variables initialTabs and initialActiveId removed. Persisted in Electron Store.

// Early Access Beta Expiration Configuration
const BETA_EXPIRY_DATE_STR = "2026-09-28T23:59:59Z"; // GMT / UTC time format

function App() {
  const [testForceExpired, setTestForceExpired] = useState(false);
  const isBetaExpired = (Date.now() > new Date(BETA_EXPIRY_DATE_STR).getTime()) || testForceExpired;
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [appWorkspaces, setAppWorkspaces] = useState<AppWorkspace[]>([]);
  const [gitSummaries, setGitSummaries] = useState<Record<string, GitSummary>>({});
  const [settings, setSettings] = useState<WorkspaceSettings>({
    manageWorkspaces: false,
    workspaceSavePath: null,
  });

  // Layout UI state
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("explorer");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // Map of project ID -> RequestTab[]
  const [projectTabsMap, setProjectTabsMap] = useState<Record<string, RequestTab[]>>({});
  // Map of project ID -> activeRequestTabId
  const [projectActiveTabIdMap, setProjectActiveTabIdMap] = useState<Record<string, string | null>>({});

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [scanningProjectId, setScanningProjectId] = useState<string | null>(null);
  const scanGameContainerRef = useRef<HTMLDivElement>(null);
  const [isTabsRestored, setIsTabsRestored] = useState(false);
  const [isEnvsRestored, setIsEnvsRestored] = useState(false);
  const [isLayoutRestored, setIsLayoutRestored] = useState(false);

  const currentProjId = activeProjectId || "global";

  const tabs = useMemo(() => {
    return projectTabsMap[currentProjId] || [];
  }, [projectTabsMap, currentProjId]);

  const activeTabId = useMemo(() => {
    const projActiveId = projectActiveTabIdMap[currentProjId];
    if (projActiveId && tabs.some((t) => t.id === projActiveId)) {
      return projActiveId;
    }
    return tabs[0]?.id || null;
  }, [projectActiveTabIdMap, currentProjId, tabs]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId]
  );

  const setTabs = (updater: RequestTab[] | ((prev: RequestTab[]) => RequestTab[])) => {
    setProjectTabsMap((prevMap) => {
      const prevTabs = prevMap[currentProjId] || [];
      const nextTabs = typeof updater === "function" ? updater(prevTabs) : updater;
      return {
        ...prevMap,
        [currentProjId]: nextTabs,
      };
    });
  };

  const setActiveTabId = (updater: string | null | ((prev: string | null) => string | null)) => {
    setProjectActiveTabIdMap((prevMap) => {
      const prevActiveId = prevMap[currentProjId] || null;
      const nextActiveId = typeof updater === "function" ? updater(prevActiveId) : updater;
      return {
        ...prevMap,
        [currentProjId]: nextActiveId,
      };
    });
  };

  // Cookie Jar modal state
  const [isCookiesModalOpen, setIsCookiesModalOpen] = useState(false);

  // Resizing states
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("devdash.sidebarWidth");
    return saved ? Math.max(270, parseInt(saved, 10)) : 270;
  });

  const workspaceRef = useRef<HTMLDivElement>(null);

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(270, Math.min(500, startWidth + deltaX));
      setSidebarWidth(newWidth);
      localStorage.setItem("devdash.sidebarWidth", String(newWidth));
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const startRequestResize = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!workspaceRef.current || !activeTabId) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    const containerTop = rect.top;
    const containerHeight = rect.height;
    if (containerHeight <= 0) return;

    const targetTabId = activeTabId;

    const doDrag = (moveEvent: MouseEvent) => {
      const offsetY = moveEvent.clientY - containerTop;
      const newPercent = Math.max(20, Math.min(80, (offsetY / containerHeight) * 100));
      setTabs((prev) =>
        prev.map((t) => (t.id === targetTabId ? { ...t, splitPercent: newPercent } : t))
      );
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const resetRequestSplit = () => {
    if (!activeTabId) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, splitPercent: 50 } : t))
    );
  };

  // Modals state
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isCreateAppWorkspaceModalOpen, setIsCreateAppWorkspaceModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editingAppWorkspace, setEditingAppWorkspace] = useState<AppWorkspace | null>(null);
  const [isDevToolsModalOpen, setIsDevToolsModalOpen] = useState(false);

  // Environment variables state
  const [environments, setEnvironments] = useState<ApiEnvironment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [isManageEnvsModalOpen, setIsManageEnvsModalOpen] = useState(false);
  const [treeCache, setTreeCache] = useState<Record<string, any>>({});

  // 1. Load persisted states from Electron Store on mount
  useEffect(() => {
    Promise.all([
      apiClient.storeGet("projectTabsMap").catch(() => null),
      apiClient.storeGet("projectActiveTabIdMap").catch(() => null),
      apiClient.storeGet("activeProjectId").catch(() => null),
      apiClient.storeGet("environments").catch(() => null),
      apiClient.storeGet("activeEnvId").catch(() => null),
      apiClient.storeGet("activeSidebarTab").catch(() => null),
      apiClient.storeGet("isSidebarExpanded").catch(() => null),
      apiClient.storeGet("apiScannerTreeCache").catch(() => null)
    ]).then(([
      storedMap,
      storedActiveIdMap,
      storedActiveProjectId,
      storedEnvs,
      storedEnvId,
      storedSidebarTab,
      storedSidebarExpanded,
      storedTreeCache
    ]) => {
      // 1. Restore tree cache
      if (storedTreeCache && typeof storedTreeCache === "object") {
        setTreeCache(storedTreeCache);
      }
      
      // 2. Restore tabs
      const finalMap = (storedMap && typeof storedMap === "object")
        ? (storedMap as Record<string, RequestTab[]>)
        : {};
      const finalActiveIdMap = (storedActiveIdMap && typeof storedActiveIdMap === "object")
        ? (storedActiveIdMap as Record<string, string | null>)
        : {};
      setProjectTabsMap(finalMap);
      setProjectActiveTabIdMap(finalActiveIdMap);
      const activeProj = typeof storedActiveProjectId === "string" ? storedActiveProjectId : null;
      setActiveProjectId(activeProj);

      // 3. Restore environments
      if (Array.isArray(storedEnvs)) {
        setEnvironments(storedEnvs);
      }
      if (typeof storedEnvId === "string") {
        setActiveEnvId(storedEnvId);
      }

      // 4. Restore layout
      if (storedSidebarTab) {
        setActiveSidebarTab(storedSidebarTab as SidebarTab);
      }
      if (typeof storedSidebarExpanded === "boolean") {
        setIsSidebarExpanded(storedSidebarExpanded);
      }

      // Mark all as restored
      setIsTabsRestored(true);
      setIsEnvsRestored(true);
      setIsLayoutRestored(true);
    });
  }, []);

  // Sync request tabs state to Electron Store
  useEffect(() => {
    if (!isTabsRestored) return;
    apiClient.storeSet("projectTabsMap", projectTabsMap);
  }, [projectTabsMap, isTabsRestored]);

  useEffect(() => {
    if (!isTabsRestored) return;
    apiClient.storeSet("projectActiveTabIdMap", projectActiveTabIdMap);
  }, [projectActiveTabIdMap, isTabsRestored]);

  useEffect(() => {
    if (!isTabsRestored) return;
    apiClient.storeSet("activeProjectId", activeProjectId);
  }, [activeProjectId, isTabsRestored]);

  // Ensure activeProjectId is valid whenever projects change or are loaded
  useEffect(() => {
    if (projects.length > 0) {
      if (!activeProjectId || !projects.some((p) => p.id === activeProjectId)) {
        setActiveProjectId(projects[0].id);
      }
    } else if (activeProjectId) {
      setActiveProjectId(null);
    }
  }, [projects, activeProjectId]);

  // Sync environment variables state to Electron Store
  useEffect(() => {
    if (!isEnvsRestored) return;
    apiClient.storeSet("environments", environments);
  }, [environments, isEnvsRestored]);

  useEffect(() => {
    if (!isEnvsRestored) return;
    apiClient.storeSet("activeEnvId", activeEnvId);
  }, [activeEnvId, isEnvsRestored]);

  // Sync layout configuration state to Electron Store
  useEffect(() => {
    if (!isLayoutRestored) return;
    apiClient.storeSet("activeSidebarTab", activeSidebarTab);
  }, [activeSidebarTab, isLayoutRestored]);

  useEffect(() => {
    if (!isLayoutRestored) return;
    apiClient.storeSet("isSidebarExpanded", isSidebarExpanded);
  }, [isSidebarExpanded, isLayoutRestored]);

  // Load initial configurations from Electron Store
  useEffect(() => {
    apiClient.getSettings();
    apiClient.onGroupsLoaded(setGroups);
    apiClient.onProjectsLoaded((loadedProjects) => {
      setProjects(loadedProjects);

      setGitSummaries((prev) => {
        const next: Record<string, GitSummary> = {};
        loadedProjects.forEach((p) => {
          if (prev[p.id]) next[p.id] = prev[p.id];
        });
        return next;
      });

      // Kick off git summary fetch for each project (non-blocking)
      loadedProjects.forEach((p) => {
        apiClient
          .getGitSummary(p.path)
          .then((summary) =>
            setGitSummaries((prev) => ({ ...prev, [p.id]: summary })),
          )
          .catch(() => {
            // ignore
          });
      });
    });

    apiClient.onGitSummaryUpdated(({ projectId, summary }) => {
      setGitSummaries((prev) => ({ ...prev, [projectId]: summary }));
    });
    apiClient.onWorkspacesLoaded(setWorkspaces);
    apiClient.onAppWorkspacesLoaded(setAppWorkspaces);
    apiClient.onSettingsLoaded(setSettings);
    apiClient.onSettingsUpdated(setSettings);
  }, []);


  const handleGitSummaryChange = (projectId: string, summary: GitSummary) => {
    setGitSummaries((prev) => ({ ...prev, [projectId]: summary }));
  };

  // --- Projects View Event Handlers ---
  const handleSaveProject = (
    projectName: string,
    startCommand: string,
    projectPath: string,
  ) => {
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: projectName,
      path: projectPath,
      startCommand: startCommand,
      groupId: null,
    };
    apiClient.addProject(newProject);
    setIsAddProjectModalOpen(false);
    toast.success("Project added", { description: newProject.name });
  };

  const handleUpdateProject = (project: Project) => {
    apiClient.updateProject(project);
    setEditingProject(null);
    toast.success("Project updated", { description: project.name });
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
  };

  const handleViewLogs = (project: Project) => {
    if (isConsoleOpen && (consoleProjectId === project.id || consoleProjectId === null)) {
      setIsConsoleOpen(false);
    } else {
      setConsoleProjectId(project.id);
      setIsConsoleOpen(true);
    }
  };

  const handleOpenWorkspace = (workspacePath: string) => {
    apiClient.openWorkspace(workspacePath);
  };

  const handleToggleWorkspaces = (enabled: boolean) => {
    apiClient.toggleWorkspaceManagement(enabled);
  };

  const handleSelectWorkspacePath = async () => {
    const newPath = await apiClient.selectWorkspacePath();
    if (newPath) {
      setSettings((prev) => ({ ...prev, workspaceSavePath: newPath }));
      toast.success("Workspace save path set");
    }
  };

  const handleAddWorkspaceFile = async () => {
    const path = await apiClient.selectWorkspaceFile();
    if (path) {
      apiClient.addWorkspace(path);
      toast.success("Workspace added");
    }
  };

  const handleCreateAppWorkspace = (workspace: AppWorkspace) => {
    apiClient.createAppWorkspace(workspace);
    toast.success("Stack Automation Created", {
      description: workspace.name,
    });
  };

  const handleLaunchAppWorkspace = (id: string) => {
    void (async () => {
      const launchResult = await apiClient.launchAppWorkspace(id);

      if (!launchResult?.success) {
        toast.error("Failed to launch automation", {
          description: launchResult?.error || "Unknown error",
        });
        return;
      }

      const workspace = appWorkspaces.find((w) => w.id === id);
      const runProjectIds = workspace?.runProjectIds || [];
      if (runProjectIds.length === 0) return;

      const runningSnapshot = await apiClient
        .getRunningServersSnapshot()
        .catch(() => ({}) as Record<string, ProjectStatus>);

      runProjectIds.forEach((projectId) => {
        const project = projects.find((p) => p.id === projectId);
        if (!project) return;

        const status = runningSnapshot[projectId];
        if (status && status !== "stopped") return;

        apiClient.toggleServer(project);
      });
    })();
  };

  const handleUpdateAppWorkspace = (workspace: AppWorkspace) => {
    apiClient.updateAppWorkspace(workspace);
    setEditingAppWorkspace(null);
    toast.success("Stack Automation Updated", {
      description: workspace.name,
    });
  };

  const handleEditAppWorkspace = (workspace: AppWorkspace) => {
    setEditingAppWorkspace(workspace);
    setIsCreateAppWorkspaceModalOpen(true);
  };

  const handleOpenEditWorkspaceNameModal = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
  };

  const handleSaveWorkspaceName = (
    workspaceId: string,
    newDisplayName: string | null,
  ) => {
    apiClient.updateWorkspace({ id: workspaceId, displayName: newDisplayName });
    setEditingWorkspace(null);
  };

  const handleToggleWorkspacePin = (workspace: Workspace) => {
    apiClient.updateWorkspace({
      id: workspace.id,
      isPinned: !workspace.isPinned,
    });
  };

  const handleRevealWorkspaceFile = (workspacePath: string) => {
    apiClient.showItemInFolder(workspacePath);
  };

  const handleRemoveWorkspace = (workspaceId: string) => {
    if (
      confirm(
        `Remove this workspace from the list?\n(This will NOT delete the actual file)`,
      )
    ) {
      apiClient.removeWorkspace(workspaceId);
      toast.success("Workspace removed");
    }
  };

  // --- Horizontal Request Tab Actions ---
  const handleNewTab = () => {
    const currentProj = projects.find((p) => p.id === activeProjectId);
    const initialUrl = currentProj?.url ? `${currentProj.url.replace(/\/+$/, "")}/` : "";
    const tab: RequestTab = {
      ...defaultTab(activeProjectId),
      url: initialUrl,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
  };

  const handleCloseTab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(next[next.length - 1]?.id || null);
      }
      return next;
    });
  };

  const handleDuplicateTab = (id: string) => {
    const tabToDup = tabs.find((t) => t.id === id);
    if (!tabToDup) return;
    const duplicated: RequestTab = {
      ...tabToDup,
      id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: `${tabToDup.name} (Copy)`,
      response: null,
      lastCompletedAt: 0,
    };
    
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, duplicated);
      return next;
    });
    setActiveTabId(duplicated.id);
  };

  const handleCloseOtherTabs = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id === id);
      setActiveTabId(id);
      return next;
    });
  };

  const handleCloseTabsToRight = (id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    setTabs((prev) => {
      const next = prev.slice(0, idx + 1);
      if (activeTabId && !next.some((t) => t.id === activeTabId)) {
        setActiveTabId(id);
      }
      return next;
    });
  };

  const handleCloseTabsToLeft = (id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    setTabs((prev) => {
      const next = prev.slice(idx);
      if (activeTabId && !next.some((t) => t.id === activeTabId)) {
        setActiveTabId(id);
      }
      return next;
    });
  };

  const handleCloseAllTabs = () => {
    setTabs([]);
    setActiveTabId(null);
  };

  // Global keyboard shortcuts (Ctrl+T for new tab, Ctrl+W for close tab, Ctrl+Tab/Alt+1-9 for navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "t" && !e.shiftKey) {
        e.preventDefault();
        handleNewTab();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "w" && !e.shiftKey) {
        const target = e.target as HTMLElement;
        const isCodeMirror = target?.closest(".cm-content");
        if (!isCodeMirror && activeTabId) {
          e.preventDefault();
          handleCloseTab(activeTabId);
        }
      } else if (isCmdOrCtrl && (e.key === "Tab" || e.key === "PageDown") && !e.shiftKey) {
        if (tabs.length > 1 && activeTabId) {
          e.preventDefault();
          const currIdx = tabs.findIndex((t) => t.id === activeTabId);
          const nextIdx = (currIdx + 1) % tabs.length;
          setActiveTabId(tabs[nextIdx].id);
        }
      } else if (isCmdOrCtrl && ((e.key === "Tab" && e.shiftKey) || e.key === "PageUp")) {
        if (tabs.length > 1 && activeTabId) {
          e.preventDefault();
          const currIdx = tabs.findIndex((t) => t.id === activeTabId);
          const prevIdx = (currIdx - 1 + tabs.length) % tabs.length;
          setActiveTabId(tabs[prevIdx].id);
        }
      } else if (e.altKey && !isCmdOrCtrl && e.key >= "1" && e.key <= "9") {
        const targetIdx = parseInt(e.key, 10) - 1;
        if (tabs[targetIdx]) {
          e.preventDefault();
          setActiveTabId(tabs[targetIdx].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, tabs, activeProjectId, projects]);

  const handleChangeTab = (updatedTab: RequestTab) => {
    setTabs((prev) => prev.map((t) => (t.id === updatedTab.id ? updatedTab : t)));

    // If tab name changed, sync it to the sidebar treeCache!
    const oldTab = tabs.find((t) => t.id === updatedTab.id);
    if (oldTab && oldTab.name !== updatedTab.name) {
      const targetId = updatedTab.routeId || updatedTab.id;
      if (targetId) {
        setTreeCache((prev) => {
          let cacheChanged = false;
          const nextCache = { ...prev };

          for (const projectPath of Object.keys(prev)) {
            const cached = prev[projectPath];
            if (!cached || !cached.tree) continue;

            const renameRecursive = (nodes: any[]): { tree: any[]; updated: boolean } => {
              let updated = false;
              const nextNodes = nodes.map((n) => {
                if (n.id === targetId) {
                  updated = true;
                  return { ...n, name: updatedTab.name };
                }
                if (n.children && Array.isArray(n.children)) {
                  const res = renameRecursive(n.children);
                  if (res.updated) {
                    updated = true;
                    return { ...n, children: res.tree };
                  }
                }
                return n;
              });
              return { tree: nextNodes, updated };
            };

            const result = renameRecursive(cached.tree);
            if (result.updated) {
              nextCache[projectPath] = { ...cached, tree: result.tree };
              cacheChanged = true;
              break;
            }
          }

          if (cacheChanged) {
            apiClient.storeSet("apiScannerTreeCache", nextCache);
            return nextCache;
          }
          return prev;
        });
      }
    }
  };

  const handleUpdateTabResponse = (tabId: string, response: ApiHttpResponse) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, response, loading: false, lastCompletedAt: Date.now() } : t))
    );
  };

  const handleSelectRoute = (route: ApiRoute, baseUrl: string, projectId: string) => {
    // 1. Ensure activeProjectId matches the selected route's project
    if (activeProjectId !== projectId) {
      setActiveProjectId(projectId);
    }

    // 2. Look up existing tab within this project's scoped tabs
    const currentProjTabs = projectTabsMap[projectId] || [];
    const existing = currentProjTabs.find(
      (t) => t.routeId === route.id || (t.routePath === route.path && !t.routeId)
    );

    if (existing) {
      const cleanBase = baseUrl.replace(/\/+$/, "");
      const newUrl = route.path ? `${cleanBase}${route.path}` : "";
      if (existing.url !== newUrl) {
        setProjectTabsMap((prevMap) => ({
          ...prevMap,
          [projectId]: (prevMap[projectId] || []).map((t) =>
            t.id === existing.id ? { ...t, url: newUrl } : t
          ),
        }));
      }
      setProjectActiveTabIdMap((prevActiveMap) => ({
        ...prevActiveMap,
        [projectId]: existing.id,
      }));
      return;
    }

    // Build inferred parameters
    const queryRows = Array.isArray(route.inferredQueryFields)
      ? route.inferredQueryFields.map((field) => ({
          id: `query_${field}_${Math.random().toString(36).slice(2, 5)}`,
          enabled: true,
          key: field,
          value: "",
        }))
      : [];

    let bodyText = "{\n  \n}";
    if (Array.isArray(route.inferredBodyFields) && route.inferredBodyFields.length > 0) {
      const template: Record<string, string> = {};
      route.inferredBodyFields.forEach((field) => {
        template[field] = "";
      });
      bodyText = JSON.stringify(template, null, 2);
    }

    const pathCleaned = route.path;
    const finalMethod = (route.method === "ALL" ? "GET" : route.method) as Method;

    const cleanBase = baseUrl.replace(/\/+$/, "");
    const initialUrl = route.path
      ? `${cleanBase}${route.path.startsWith("/") ? route.path : `/${route.path}`}`
      : `${cleanBase}/`;

    const newTab: RequestTab = {
      id: `scanned_${projectId}_${route.id}`,
      name: route.name || pathCleaned || "New Request",
      method: finalMethod,
      url: initialUrl,
      params: queryRows,
      headers: [],
      auth: { type: "none" },
      bodyMode: finalMethod === "GET" || finalMethod === "HEAD" ? "none" : "json",
      bodyText: bodyText,
      formFields: [],
      urlencodedFields: [],
      binaryFilePath: "",
      lastCompletedAt: 0,
      response: null,
      projectId,
      routePath: route.path,
      routeId: route.id,
      isNew: (route as any).isNew || false,
      preRequestScript: "",
      postResponseScript: "",
      activeScriptSubTab: "prerequest",
      pathVariables: [],
      splitPercent: 50,
    };

    setProjectTabsMap((prevMap) => ({
      ...prevMap,
      [projectId]: [...(prevMap[projectId] || []), newTab],
    }));
    setProjectActiveTabIdMap((prevActiveMap) => ({
      ...prevActiveMap,
      [projectId]: newTab.id,
    }));
  };

  const handleBaseUrlChange = (projectId: string, newBaseUrl: string) => {
    const cleanBase = newBaseUrl.trim();
    const cleanNoSlash = cleanBase.replace(/\/+$/, "");

    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, url: cleanBase } : p))
    );
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      apiClient.updateProject({ ...proj, url: cleanBase });
    }

    setProjectTabsMap((prevMap) => {
      const projTabs = prevMap[projectId] || [];
      const updated = projTabs.map((t) => {
        if (t.routePath) {
          const pathWithSlash = t.routePath.startsWith("/") ? t.routePath : `/${t.routePath}`;
          return { ...t, url: `${cleanNoSlash}${pathWithSlash}` };
        }
        if (proj?.url) {
          const oldClean = proj.url.replace(/\/+$/, "");
          if (oldClean && t.url.startsWith(oldClean)) {
            return { ...t, url: `${cleanNoSlash}${t.url.slice(oldClean.length)}` };
          }
        }
        return t;
      });
      return {
        ...prevMap,
        [projectId]: updated,
      };
    });
  };

  const handleAddBackendFolder = async () => {
    try {
      const folder = await apiClient.openDirectoryDialog();
      if (!folder) return;

      const existing = projects.find((p) => p.path === folder);
      if (existing) {
        setActiveProjectId(existing.id);
        toast.info(`Backend "${existing.name}" is already linked.`);
        return;
      }

      const parts = folder.split(/[\\/]/).filter(Boolean);
      const folderName = parts[parts.length - 1] || "My API Project";

      const port = await apiClient.detectProjectPort(folder).catch(() => null);
      const finalPort = port || 3000;
      const baseUrl = `http://localhost:${finalPort}`;

      const newProject: Project = {
        id: `proj_${Date.now()}`,
        name: folderName,
        path: folder,
        startCommand: "",
        url: baseUrl,
        groupId: null,
      };

      apiClient.addProject(newProject);
      setProjects((prev) => [...prev, newProject]);
      setActiveProjectId(newProject.id);

      void handleRescanProject(newProject);
    } catch (err) {
      console.error("Failed to add project folder:", err);
      toast.error("Failed to select backend folder");
    }
  };

  const handleRemoveProject = (id: string) => {
    const proj = projects.find((p) => p.id === id);
    apiClient.removeProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));

    // Clean up tabs
    setProjectTabsMap((prevMap) => {
      const nextMap = { ...prevMap };
      delete nextMap[id];
      return nextMap;
    });
    setProjectActiveTabIdMap((prevActiveMap) => {
      const nextActiveMap = { ...prevActiveMap };
      delete nextActiveMap[id];
      return nextActiveMap;
    });

    if (proj) {
      setTreeCache((prev) => {
        const next = { ...prev };
        delete next[proj.path];
        apiClient.storeSet("apiScannerTreeCache", next);
        return next;
      });
    }

    if (activeProjectId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      setActiveProjectId(remaining[0]?.id || null);
    }

    toast.success("Backend removed from workspace");
  };

  const getDemoRoutesTree = (): ApiFolder[] => [
    {
      id: "folder_auth",
      name: "Authentication",
      children: [
        {
          id: "route_login",
          name: "User Login",
          method: "POST",
          path: "/api/v1/auth/login",
          inferredHeaders: ["Content-Type"],
          inferredBodyFields: ["username", "password"],
          description: "Authenticate user credentials and receive session cookie & JWT token",
        },
        {
          id: "route_me",
          name: "Current Profile",
          method: "GET",
          path: "/api/v1/auth/me",
          inferredHeaders: ["Authorization"],
          description: "Get authenticated user profile details",
        },
        {
          id: "route_logout",
          name: "User Logout",
          method: "POST",
          path: "/api/v1/auth/logout",
          description: "Clear auth cookie and terminate active session",
        },
      ],
    },
    {
      id: "folder_products",
      name: "Products & Catalog",
      children: [
        {
          id: "route_list_products",
          name: "List Products",
          method: "GET",
          path: "/api/v1/products",
          inferredQueryFields: ["category", "limit", "sort"],
          description: "Retrieve paginated products with category filtering",
        },
        {
          id: "route_create_product",
          name: "Create Product",
          method: "POST",
          path: "/api/v1/products",
          inferredBodyFields: ["title", "price", "category", "inStock"],
          description: "Add a new product listing to the inventory",
        },
        {
          id: "route_delete_product",
          name: "Delete Product",
          method: "DELETE",
          path: "/api/v1/products/:id",
          description: "Remove product by ID",
        },
      ],
    },
    {
      id: "folder_system",
      name: "Health & System",
      children: [
        {
          id: "route_health",
          name: "Health Check",
          method: "GET",
          path: "/api/v1/health",
          description: "System health and database connectivity probe",
        },
      ],
    },
  ];

  const handleQuickOpenFolder = handleAddBackendFolder;

  const handleRescanProject = async (project: Project) => {
    setScanningProjectId(project.id);

    // Mock Demo project rescan handler (preserves routes and simulates realistic scan)
    if (project.path.startsWith("mock://") || project.id === "proj_demo_store") {
      const scanDuration = Math.floor(Math.random() * 2000) + 4000; // 4 to 6 seconds
      setTimeout(() => {
        const demoTree = getDemoRoutesTree();
        setTreeCache((prev) => {
          const next = {
            ...prev,
            [project.path]: {
              tree: demoTree,
              logs: [
                "[AST Scanner] Rescanned demo routes...",
                "[AST Scanner] Discovered 7 routes across 3 controllers",
              ],
              cachedAt: Date.now(),
              potentialRoutesCount: 7,
              detectedRoutesCount: 7,
            },
          };
          apiClient.storeSet("apiScannerTreeCache", next);
          return next;
        });
        setScanningProjectId(null);
        toast.success("AST scan complete", {
          description: `Discovered 7 routes in ${project.name}`,
        });
      }, scanDuration);
      return;
    }

    try {
      const result = await apiClient.scanProject(project.path);
      const existing = treeCache[project.path];
      const currentTree = existing?.tree || [];
      const merged = currentTree.length > 0
        ? mergeTrees(currentTree, result?.tree || [])
        : (result?.tree || []);
      const scannedLogs = result?.logs || [];

      setTreeCache((prev) => {
        const next = {
          ...prev,
          [project.path]: {
            tree: merged,
            logs: scannedLogs,
            cachedAt: Date.now(),
            potentialRoutesCount: result?.potentialRoutesCount,
            detectedRoutesCount: result?.detectedRoutesCount,
          },
        };
        apiClient.storeSet("apiScannerTreeCache", next);
        return next;
      });

      toast.success("AST scan complete", {
        description: `Discovered ${result?.detectedRoutesCount || merged.length} routes in ${project.name}`,
      });
    } catch (err) {
      toast.error("Scan failed");
    } finally {
      setScanningProjectId(null);
    }
  };

  const handleQuickRequest = () => {
    const tab: RequestTab = {
      ...defaultTab(activeProjectId),
      name: "Quick Request",
      url: "https://httpbin.org/get",
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const handleLoadDemoProject = () => {
    const demoId = "proj_demo_store";
    const demoPath = "mock://routelens-demo-store";
    const demoProject: Project = {
      id: demoId,
      name: "RouteLens Demo API",
      path: demoPath,
      startCommand: "npm run dev",
      url: "http://localhost:3000",
      groupId: null,
    };

    // Add demo project
    apiClient.addProject(demoProject);
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === demoId);
      return exists ? prev : [...prev, demoProject];
    });
    setActiveProjectId(demoProject.id);
    setActiveSidebarTab("explorer");

    // Realistic scanning experience (5 to 8 seconds with Ghost Hunter mini-game)
    setScanningProjectId(demoProject.id);
    const scanDuration = Math.floor(Math.random() * 3000) + 5000; // 5 to 8 seconds

    setTimeout(() => {
      const demoTree = getDemoRoutesTree();
      setTreeCache((prev) => {
        const next = {
          ...prev,
          [demoPath]: {
            tree: demoTree,
            logs: [
              "[AST Scanner] Scanning demo routes...",
              "[AST Scanner] Parsed express router in /controllers/auth.ts",
              "[AST Scanner] Parsed express router in /controllers/products.ts",
              "[AST Scanner] Parsed health check endpoint in /server.ts",
              "[AST Scanner] Discovered 7 routes across 3 controllers",
            ],
            cachedAt: Date.now(),
            potentialRoutesCount: 7,
            detectedRoutesCount: 7,
          },
        };
        apiClient.storeSet("apiScannerTreeCache", next);
        return next;
      });

      setScanningProjectId(null);

      // Open first route (User Login) in a tab for instant interaction
      const firstRoute = demoTree[0]?.children?.[0] as ApiRoute;
      if (firstRoute) {
        handleSelectRoute(firstRoute, "http://localhost:3000", demoId);
      }

      toast.success("AST scan complete", {
        description: "Discovered 7 routes in RouteLens Demo API",
      });
    }, scanDuration);
  };

  const handleDevTriggerScanAnimation = async () => {
    let targetProject = projects.find((p) => p.id === activeProjectId);

    if (!targetProject) {
      if (projects.length > 0) {
        targetProject = projects[0];
        setActiveProjectId(targetProject.id);
      } else {
        handleLoadDemoProject();
        targetProject = {
          id: "proj_demo_store",
          name: "RouteLens Demo API",
          path: "mock://routelens-demo-store",
          startCommand: "npm run dev",
          groupId: null,
        };
        setProjects([targetProject]);
      }
    }

    setScanningProjectId(targetProject.id);
    toast.info("Hunt phantom bugs while AST scans your backend!");

    if (!targetProject.path.startsWith("mock://")) {
      const scanPromise = apiClient
        .scanProject(targetProject.path)
        .then((result) => {
          const scannedTree = result?.tree || [];
          const scannedLogs = result?.logs || [];
          setTreeCache((prev) => ({
            ...prev,
            [targetProject!.path]: {
              tree: scannedTree,
              logs: scannedLogs,
              cachedAt: Date.now(),
              potentialRoutesCount: result?.potentialRoutesCount,
              detectedRoutesCount: result?.detectedRoutesCount,
            },
          }));
        })
        .catch(() => {});

      await Promise.all([
        scanPromise,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      setScanningProjectId(null);
      toast.success("AST scan complete!");
    } else {
      setTimeout(() => {
        setScanningProjectId(null);
        toast.success("AST scan complete!");
      }, 5000);
    }
  };

  const activeRouteKey = useMemo(() => {
    if (!activeTab) return null;
    if (activeTab.routeId) return activeTab.routeId;
    if (activeTab.method && activeTab.routePath) {
      return `${String(activeTab.method).toUpperCase()}:${activeTab.routePath}`;
    }
    return null;
  }, [activeTab]);

  // Render secondary sidebar based on selected vertical tab
  const sidebarContent = useMemo(() => {
    switch (activeSidebarTab) {
      case "explorer":
        return (
          <ApiExplorerSidebarPanel
            projects={projects}
            activeProjectId={activeProjectId}
            onActiveProjectIdChange={setActiveProjectId}
            onSelectRoute={handleSelectRoute}
            onBaseUrlChange={handleBaseUrlChange}
            treeCache={treeCache}
            setTreeCache={setTreeCache}
            activeRouteKey={activeRouteKey}
            onAddProjectClick={handleAddBackendFolder}
            onRemoveProject={handleRemoveProject}
            onRescanProject={handleRescanProject}
            isScanning={Boolean(scanningProjectId)}
            scanningProjectId={scanningProjectId}
          />
        );
      case "automations":
        return (
          <AutomationsPanel
            appWorkspaces={appWorkspaces}
            workspaces={workspaces}
            onNewAutomation={() => {
              setEditingAppWorkspace(null);
              setIsCreateAppWorkspaceModalOpen(true);
            }}
            onAddWorkspace={handleAddWorkspaceFile}
            onLaunchAppWorkspace={handleLaunchAppWorkspace}
            onDeleteAppWorkspace={apiClient.deleteAppWorkspace}
            onEditAppWorkspace={handleEditAppWorkspace}
            onOpenWorkspace={handleOpenWorkspace}
            onTogglePin={handleToggleWorkspacePin}
            onRemoveWorkspace={handleRemoveWorkspace}
          />
        );
      case "settings":
        return (
          <SettingsSidebarPanel
            settings={settings}
            onToggleWorkspaces={handleToggleWorkspaces}
            onSelectWorkspacePath={handleSelectWorkspacePath}
          />
        );
      default:
        return null;
    }
  }, [
    activeSidebarTab,
    projects,
    appWorkspaces,
    workspaces,
    settings,
    activeProjectId,
    activeRouteKey,
    scanningProjectId,
    treeCache,
  ]);

  // Compute active environment variables
  const activeVariables = useMemo(() => {
    const activeEnv = environments.find((e) => e.id === activeEnvId);
    return activeEnv ? activeEnv.variables : [];
  }, [environments, activeEnvId]);

  const activeEnvName = useMemo(() => {
    const activeEnv = environments.find((e) => e.id === activeEnvId);
    return activeEnv ? activeEnv.name : null;
  }, [environments, activeEnvId]);

  const handleAddOrUpdateVariable = (key: string, value: string) => {
    // 1. Determine target environment ID and creation config synchronously.
    let targetEnvId = activeEnvId;
    let isNewEnvCreated = false;
    let newEnvObj: ApiEnvironment | null = null;

    const envExists = targetEnvId ? environments.some((e) => e.id === targetEnvId) : false;

    if (!targetEnvId || !envExists) {
      if (!targetEnvId) {
        if (environments.length > 0) {
          targetEnvId = environments[0].id;
        } else {
          targetEnvId = `env_${Date.now()}`;
          isNewEnvCreated = true;
        }
      } else {
        isNewEnvCreated = true;
      }

      if (isNewEnvCreated) {
        newEnvObj = {
          id: targetEnvId,
          name: "Default Environment",
          variables: [],
        };
      }
      
      // Update active environment ID safely outside the pure setEnvironments callback.
      setActiveEnvId(targetEnvId);
    }

    // 2. Perform functional environments update
    setEnvironments((prevEnvs) => {
      let updatedEnvs = [...prevEnvs];

      if (isNewEnvCreated && newEnvObj) {
        if (!updatedEnvs.some((e) => e.id === targetEnvId)) {
          updatedEnvs.push(newEnvObj);
        }
      }

      return updatedEnvs.map((env) => {
        if (env.id === targetEnvId) {
          const existingVarIdx = env.variables.findIndex((v) => v.key === key);
          let nextVars = [...env.variables];
          
          // If there's only one variable and it's empty, replace it
          if (nextVars.length === 1 && !nextVars[0].key && !nextVars[0].value) {
            nextVars[0] = {
              ...nextVars[0],
              key,
              value,
              enabled: true,
            };
          } else if (existingVarIdx !== -1) {
            nextVars[existingVarIdx] = {
              ...nextVars[existingVarIdx],
              value,
              enabled: true,
            };
          } else {
            nextVars.push({
              id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              enabled: true,
              key,
              value,
            });
          }
          return {
            ...env,
            variables: nextVars,
          };
        }
        return env;
      });
    });

    toast.success(`Variable saved: ${key}`);
  };

  return (
    <TooltipProvider>
      <Toaster position="top-right" richColors closeButton theme="dark" />
      {isBetaExpired ? (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[9999] backdrop-blur-md text-foreground select-none p-6">
          <div className="max-w-md w-full bg-bg-card border border-border-main rounded-xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto animate-pulse">
              <Hourglass size={32} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Testing Period Ended</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Thank you for participating in the **RouteLens** early access program! The testing period for this beta build has expired.
              </p>
            </div>

            <div className="bg-black/20 border border-border/40 rounded-lg p-4 text-xs font-mono text-zinc-300 leading-normal text-left space-y-2">
              <div className="font-semibold text-zinc-400">To get the next build or extend access:</div>
              <div>• Send a DM on Reddit to: <span className="text-primary font-semibold">u/OutrageousSalt8997</span></div>
              <div>• Or contact Tilak via Email: <span className="text-primary font-semibold">tilakbuilds@gmail.com</span></div>
            </div>

            <div className="text-[10px] text-muted-foreground flex justify-between items-center px-1">
              <span>Build expiration: {new Date(BETA_EXPIRY_DATE_STR).toLocaleDateString()}</span>
              {testForceExpired && (
                <button
                  onClick={() => setTestForceExpired(false)}
                  className="text-rose-500 hover:text-rose-400 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Close Preview
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <ErrorBoundary>
          <DashboardLayout
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
          sidebarContent={sidebarContent}
          isSidebarExpanded={isSidebarExpanded}
          onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
          sidebarWidth={sidebarWidth}
          onSidebarResizeStart={startSidebarResize}
          onDevToolsClick={() => setIsDevToolsModalOpen(true)}
          onTestExpiryClick={() => setTestForceExpired(true)}
          onDevTriggerScanAnimation={handleDevTriggerScanAnimation}
        >
          {/* Settings Modals */}
          <AddProjectModal
            isOpen={isAddProjectModalOpen}
            onClose={() => setIsAddProjectModalOpen(false)}
            onSave={handleSaveProject}
          />
          <EditProjectModal
            project={editingProject}
            onClose={() => setEditingProject(null)}
            onSave={handleUpdateProject}
          />
          <EditWorkspaceNameModal
            workspace={editingWorkspace}
            onClose={() => setEditingWorkspace(null)}
            onSave={handleSaveWorkspaceName}
          />
          <CreateAppWorkspaceModal
            isOpen={isCreateAppWorkspaceModalOpen}
            onClose={() => {
              setIsCreateAppWorkspaceModalOpen(false);
              setEditingAppWorkspace(null);
            }}
            onSave={handleCreateAppWorkspace}
            onEdit={handleUpdateAppWorkspace}
            editingWorkspace={editingAppWorkspace}
            projects={projects}
            workspaces={workspaces}
          />
          <ManageEnvironmentsModal
            isOpen={isManageEnvsModalOpen}
            onClose={() => setIsManageEnvsModalOpen(false)}
            environments={environments}
            onUpdateEnvironments={setEnvironments}
          />
          <DevToolsModal
            isOpen={isDevToolsModalOpen}
            onClose={() => setIsDevToolsModalOpen(false)}
            onProjectAdded={() => {}}
            projects={projects}
            treeCache={treeCache}
          />

          {/* Interactive AST Scan Mini-Game: Only visible on the right workspace during scanning */}
          {Boolean(scanningProjectId) && (
            <div
              id="scan-game-container"
              ref={scanGameContainerRef}
              className="absolute inset-0 z-50 overflow-hidden pointer-events-auto bg-black/40 backdrop-blur-[2px]"
            >
              <GamingHUDCursor containerRef={scanGameContainerRef} />
              <GhostHunter
                containerRef={scanGameContainerRef}
                isScanning={true}
                scanningProjectName={projects.find((p) => p.id === scanningProjectId)?.name}
                onDismiss={() => setScanningProjectId(null)}
              />
            </div>
          )}

          {/* Center Request Workspace Area */}
          {projects.length === 0 && tabs.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 select-none overflow-y-auto">
              <OnboardingView
                onOpenFolder={handleAddBackendFolder}
                onQuickRequest={handleQuickRequest}
                onLoadDemo={handleLoadDemoProject}
                onOpenManualModal={handleAddBackendFolder}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
              {/* Request Tabs Row */}
              <WorkspaceTabs
                tabs={tabs}
                activeTabId={activeTabId}
                onSelectTab={handleSelectTab}
                onCloseTab={handleCloseTab}
                onNewTab={handleNewTab}
                environments={environments}
                activeEnvId={activeEnvId}
                onSelectEnv={setActiveEnvId}
                onManageEnvsClick={() => setIsManageEnvsModalOpen(true)}
                onReorderTabs={setTabs}
                onDuplicateTab={handleDuplicateTab}
                onCloseOtherTabs={handleCloseOtherTabs}
                onCloseAllTabs={handleCloseAllTabs}
                onCloseTabsToRight={handleCloseTabsToRight}
                onCloseTabsToLeft={handleCloseTabsToLeft}
              />
              
              {activeTab ? (
                /* Resizable Split Request Panels Content */
                <div 
                  ref={workspaceRef}
                  className="flex-grow flex flex-col min-h-0 overflow-hidden relative"
                >
                  {/* Top Request Panel */}
                  <div 
                    style={{ height: `${activeTab?.splitPercent ?? 50}%`, flexBasis: `${activeTab?.splitPercent ?? 50}%` }} 
                    className="flex flex-col shrink-0 min-h-[200px] overflow-hidden"
                  >
                    <RequestPanel
                      tab={activeTab}
                      onChangeTab={handleChangeTab}
                      onRun={(res) => handleUpdateTabResponse(activeTab.id, res)}
                      activeVariables={activeVariables}
                      activeEnvName={activeEnvName || undefined}
                      onAddOrUpdateVariable={handleAddOrUpdateVariable}
                      projects={projects}
                      treeCache={treeCache}
                    />
                  </div>

                  {/* Horizontal Drag Handle */}
                  <div
                    onMouseDown={startRequestResize}
                    onDoubleClick={resetRequestSplit}
                    className="h-[6px] hover:bg-primary/50 active:bg-primary/70 cursor-row-resize transition-colors shrink-0 z-30 border-y border-border/40"
                    title="Drag to resize panels (Double-click to reset 50/50)"
                  />

                  {/* Bottom Response Panel */}
                  <div className="flex-1 flex flex-col min-h-[180px] p-4 pt-0 overflow-hidden">
                    <ResponsePanel
                      response={activeTab.response}
                      loading={activeTab.loading}
                      tabId={activeTab.id}
                      url={activeTab.url}
                      lastCompletedAt={activeTab.lastCompletedAt}
                      onOpenCookies={() => setIsCookiesModalOpen(true)}
                    />
                  </div>
                </div>
              ) : activeProjectId && projects.find((p) => p.id === activeProjectId) ? (
                // Clean project overview command center when all tabs are closed
                (() => {
                  const activeProject = projects.find((p) => p.id === activeProjectId)!;
                  const isScanning = scanningProjectId === activeProject.id;
                  const projectTree = treeCache[activeProject.path]?.tree || [];
                  const countRoutes = (nodes: any[]): number => {
                    let count = 0;
                    for (const n of nodes) {
                      if (!n) continue;
                      if ((n as any).method) count++;
                      else if (Array.isArray(n.children)) count += countRoutes(n.children);
                    }
                    return count;
                  };
                  const totalEndpoints = countRoutes(projectTree);

                  return (
                    <div className="flex-grow flex flex-col items-center justify-center p-8 select-none overflow-y-auto">
                      <div className="max-w-lg w-full border border-border/40 bg-card/20 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-center animate-in fade-in duration-300">
                        <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center text-primary mb-4 shadow-[0_0_20px_rgba(75,144,226,0.15)]">
                          <FolderCode size={26} />
                        </div>
                        <h2 className="text-xl font-bold text-foreground tracking-tight mb-2">
                          {activeProject.name}
                        </h2>
                        <div className="flex items-center justify-center gap-2 mb-4">
                          <div className="text-xs text-muted-foreground font-mono bg-background/60 px-3 py-1.5 rounded-lg border border-border/40 max-w-sm truncate">
                            <span className="text-foreground">{activeProject.path}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 mb-6">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-muted/40 border border-border/40 text-muted-foreground font-mono">
                            {totalEndpoints} Endpoints Discovered
                          </span>
                          {activeProject.url && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono">
                              {activeProject.url}
                            </span>
                          )}
                          {isScanning && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono animate-pulse">
                              Scanning AST...
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-center gap-3">
                          <Button
                            onClick={handleNewTab}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-4 h-8 cursor-pointer shadow-sm"
                          >
                            + Manual Request
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleRescanProject(activeProject)}
                            disabled={isScanning}
                            className="bg-transparent border-border hover:bg-white/5 text-muted-foreground hover:text-foreground px-4 h-8 cursor-pointer"
                          >
                            {isScanning ? "Scanning..." : "Rescan AST"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => apiClient.showItemInFolder(activeProject.path)}
                            className="bg-transparent border-border hover:bg-white/5 text-muted-foreground hover:text-foreground px-4 h-8 cursor-pointer"
                          >
                            Reveal in Folder
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card/5 select-none">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-lg shadow-primary/5">
                    <Send size={22} className="translate-x-0.5" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">No Request Open</h3>
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-5">
                    Select an endpoint from the left sidebar or create a new request tab to start testing.
                  </p>
                  <Button onClick={handleNewTab} size="sm" className="gap-2 text-xs font-semibold px-4 h-8">
                    <Plus size={14} />
                    <span>New Request</span>
                    <kbd className="ml-1 text-[10px] font-mono bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded">Ctrl+T</kbd>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DashboardLayout>
      </ErrorBoundary>
      )}

      <ManageCookiesModal
        isOpen={isCookiesModalOpen}
        onClose={() => setIsCookiesModalOpen(false)}
        initialDomain={activeTab?.url}
      />
    </TooltipProvider>
  );
}

export default App;
