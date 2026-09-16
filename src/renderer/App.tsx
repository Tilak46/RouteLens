import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  isRoute,
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
import { Compass, Plus, Server, Zap, Hourglass, FolderCode, Send, RefreshCw, ArrowRight, FolderOpen, Layers, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { ApiExplorerSidebarPanel, mergeTrees, extractRoutePath, toRouteKey } from "@/views/ApiExplorerView";
import { BackendSelectorDropdown } from "@/components/api-explorer/BackendSelectorDropdown";
import { AutomationsPanel } from "@/components/api-explorer/AutomationsPanel";
import { SettingsSidebarPanel } from "@/components/api-explorer/SettingsSidebarPanel";

// Main workspace panels
import { WorkspaceTabs, RequestTab } from "@/components/api-explorer/WorkspaceTabs";
import { RequestPanel } from "@/components/api-explorer/RequestPanel";
import { ResponsePanel } from "@/components/api-explorer/ResponsePanel";
import { ResponseIdleMascot } from "@/components/api-explorer/ResponseIllustrations";
import { ManageCookiesModal } from "@/components/api-explorer/ManageCookiesModal";
import { OnboardingView } from "@/components/onboarding/OnboardingView";
import { ProjectIdleView } from "@/components/project/ProjectIdleView";
// Temporary Demo Video: GhostHunter mini-game commented out in favor of ScanningFactsOverlay
// import GhostHunter from "@/components/game/GhostHunter";
// import GamingHUDCursor from "@/components/game/GamingHUDCursor";
import { ScanningFactsOverlay } from "@/components/scanner/ScanningFactsOverlay";
import { UpdateGraceBanner, UpdateEnforcementData } from "@/components/updates/UpdateGraceBanner";
import { MandatoryUpdateModal } from "@/components/updates/MandatoryUpdateModal";
import { GlobalContextMenu } from "@/components/ui/GlobalContextMenu";

// Environments system imports
import {
  ApiEnvironment,
  ApiVariable,
  GLOBALS_ENV_ID,
  createDefaultGlobals,
  createNewVariable,
  normalizeEnvironment,
  normalizeVariable,
} from "./types/environments";
import { mergeScopedVariables } from "./lib/interpolationEngine";
import { EnvironmentsSidebarPanel } from "./components/environments/EnvironmentsSidebarPanel";
import { EnvironmentEditorView } from "./components/environments/EnvironmentEditorView";
import { CopyVariablesModal } from "./components/environments/CopyVariablesModal";

const defaultTab = (projectId?: string | null): RequestTab => ({
  id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  name: "New Request",
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
  isNew: true,
  preRequestScript: "",
  postResponseScript: "",
  activeScriptSubTab: "prerequest",
  pathVariables: [],
  splitPercent: 50,
});

// State variables initialTabs and initialActiveId removed. Persisted in Electron Store.

// Early Access Beta Expiration Configuration
const BETA_EXPIRY_DATE_STR = "2026-09-28T23:59:59Z"; // GMT / UTC time format

// Development Diagnostic Tool: Live scan stopwatch & completion timing toast.
// Guarded for development testing; will not be included in production releases.
const IS_DEV_SCAN_BENCHMARK = true;
const showDevScanTimer = IS_DEV_SCAN_BENCHMARK || import.meta.env.DEV;

function formatScanDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s (${ms}ms)`;
}

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

  // Mandatory Auto-Update Enforcement State
  const [enforcementStatus, setEnforcementStatus] = useState<UpdateEnforcementData | null>(null);
  const [appVersion, setAppVersion] = useState<string>("0.1.0");
  const [isApplyingUpdate, setIsApplyingUpdate] = useState<boolean>(false);

  // Layout UI state
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("explorer");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // Map of project ID -> RequestTab[]
  const [projectTabsMap, setProjectTabsMap] = useState<Record<string, RequestTab[]>>({});
  // Map of project ID -> activeRequestTabId
  const [projectActiveTabIdMap, setProjectActiveTabIdMap] = useState<Record<string, string | null>>({});

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [scanningProjectId, setScanningProjectId] = useState<string | null>(null);
  // Development scan benchmark stopwatch
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);
  const [scanElapsedMs, setScanElapsedMs] = useState<number>(0);

  // Live stopwatch ticker for development scan timer
  useEffect(() => {
    if (!scanStartTime) {
      setScanElapsedMs(0);
      return;
    }
    const interval = setInterval(() => {
      setScanElapsedMs(Date.now() - scanStartTime);
    }, 50);
    return () => clearInterval(interval);
  }, [scanStartTime]);

  const scanGameContainerRef = useRef<HTMLDivElement>(null);
  const [isTabsRestored, setIsTabsRestored] = useState(false);
  const [isProjectsLoaded, setIsProjectsLoaded] = useState(false);
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

  // Environment variables state (Globals + Per-Backend Environments)
  const [globals, setGlobals] = useState<ApiEnvironment>(createDefaultGlobals());
  const [backendEnvironments, setBackendEnvironments] = useState<Record<string, ApiEnvironment[]>>({});
  const [activeBackendEnvMap, setActiveBackendEnvMap] = useState<Record<string, string | null>>({});
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(GLOBALS_ENV_ID);
  const [copyModalSourceEnvId, setCopyModalSourceEnvId] = useState<string | null>(null);
  const [treeCache, setTreeCache] = useState<Record<string, any>>({});

  // 1. Load persisted states from Electron Store on mount
  useEffect(() => {
    Promise.all([
      apiClient.storeGet("projectTabsMap").catch(() => null),
      apiClient.storeGet("projectActiveTabIdMap").catch(() => null),
      apiClient.storeGet("activeProjectId").catch(() => null),
      apiClient.storeGet("globalsEnvironment").catch(() => null),
      apiClient.storeGet("backendEnvironments").catch(() => null),
      apiClient.storeGet("activeBackendEnvMap").catch(() => null),
      apiClient.storeGet("environments").catch(() => null), // Legacy fallback
      apiClient.storeGet("activeSidebarTab").catch(() => null),
      apiClient.storeGet("isSidebarExpanded").catch(() => null),
      apiClient.storeGet("apiScannerTreeCache").catch(() => null),
    ]).then(([
      storedMap,
      storedActiveIdMap,
      storedActiveProjectId,
      storedGlobals,
      storedBackendEnvs,
      storedActiveBackendEnvMap,
      storedLegacyEnvs,
      storedSidebarTab,
      storedSidebarExpanded,
      storedTreeCache,
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

      // 3. Restore environments (Globals + Per-Backend)
      if (storedGlobals && typeof storedGlobals === "object") {
        setGlobals(normalizeEnvironment(storedGlobals));
      } else if (Array.isArray(storedLegacyEnvs) && storedLegacyEnvs.length > 0) {
        // Migrate first legacy environment to Globals
        const first = storedLegacyEnvs[0];
        setGlobals({
          ...normalizeEnvironment(first),
          id: GLOBALS_ENV_ID,
          name: "Globals",
          projectId: null,
        });
      }

      if (storedBackendEnvs && typeof storedBackendEnvs === "object") {
        setBackendEnvironments(storedBackendEnvs);
      }

      if (storedActiveBackendEnvMap && typeof storedActiveBackendEnvMap === "object") {
        setActiveBackendEnvMap(storedActiveBackendEnvMap);
      }

      // 4. Restore layout
      if (storedSidebarTab) {
        if (!import.meta.env.DEV && storedSidebarTab === "settings") {
          setActiveSidebarTab("explorer");
        } else {
          setActiveSidebarTab(storedSidebarTab as SidebarTab);
        }
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
    if (activeProjectId && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects[0]?.id || null);
    }
  }, [projects, activeProjectId]);

  // Sync environment variables state to Electron Store
  useEffect(() => {
    if (!isEnvsRestored) return;
    apiClient.storeSet("globalsEnvironment", globals);
  }, [globals, isEnvsRestored]);

  useEffect(() => {
    if (!isEnvsRestored) return;
    apiClient.storeSet("backendEnvironments", backendEnvironments);
  }, [backendEnvironments, isEnvsRestored]);

  useEffect(() => {
    if (!isEnvsRestored) return;
    apiClient.storeSet("activeBackendEnvMap", activeBackendEnvMap);
  }, [activeBackendEnvMap, isEnvsRestored]);

  // Sync layout configuration state to Electron Store
  useEffect(() => {
    if (!isLayoutRestored) return;
    apiClient.storeSet("activeSidebarTab", activeSidebarTab);
  }, [activeSidebarTab, isLayoutRestored]);

  useEffect(() => {
    if (!isLayoutRestored) return;
    apiClient.storeSet("isSidebarExpanded", isSidebarExpanded);
  }, [isSidebarExpanded, isLayoutRestored]);

  // Dismiss initial splash screen once projects and tabs are hydrated
  useEffect(() => {
    const launchTime = Date.now();
    let dismissed = false;

    const tryDismiss = () => {
      if (dismissed) return;
      if (isTabsRestored && isProjectsLoaded) {
        dismissed = true;
        const elapsed = Date.now() - launchTime;
        const delay = Math.max(0, 1000 - elapsed);
        setTimeout(() => {
          (window as any).__routeLensDismissSplash?.();
        }, delay);
      }
    };

    tryDismiss();

    // Safety fallback: guaranteed dismissal after 1.5s even if an event is delayed
    const fallbackTimer = setTimeout(() => {
      if (!dismissed) {
        dismissed = true;
        (window as any).__routeLensDismissSplash?.();
      }
    }, 1500);

    return () => clearTimeout(fallbackTimer);
  }, [isTabsRestored, isProjectsLoaded]);

  const handleInstallUpdate = useCallback(async () => {
    try {
      setIsApplyingUpdate(true);
      setTimeout(async () => {
        try {
          await window.api?.updates?.install?.();
        } catch (err: any) {
          setIsApplyingUpdate(false);
          toast.error("Failed to apply update: " + (err?.message || err));
        }
      }, 600);
    } catch (err: any) {
      setIsApplyingUpdate(false);
      toast.error("Failed to apply update: " + (err?.message || err));
    }
  }, []);

  // Load initial configurations from Electron Store
  useEffect(() => {
    apiClient.getSettings();
    apiClient.onGroupsLoaded(setGroups);
    apiClient.onProjectsLoaded((loadedProjects) => {
      setProjects(loadedProjects);
      setIsProjectsLoaded(true);

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

    // Proactively fetch projects to avoid race condition with did-finish-load
    apiClient.getProjects?.()?.then((projs) => {
      if (Array.isArray(projs)) {
        setProjects(projs);
        setIsProjectsLoaded(true);
      }
    }).catch(() => {});

    apiClient.onGitSummaryUpdated(({ projectId, summary }) => {
      setGitSummaries((prev) => ({ ...prev, [projectId]: summary }));
    });
    apiClient.onWorkspacesLoaded(setWorkspaces);
    apiClient.onAppWorkspacesLoaded(setAppWorkspaces);
    apiClient.onSettingsLoaded(setSettings);
    apiClient.onSettingsUpdated(setSettings);

    // Auto-update notifications
    window.api?.updates?.onUpdateAvailable?.((info) => {
      toast.info(`Update Available (v${info.version})`, {
        description: "Downloading the latest version in the background...",
        duration: 8000,
      });
    });

    window.api?.updates?.onUpdateDownloaded?.((info) => {
      toast.success(`RouteLens v${info.version} Ready`, {
        description: "Update downloaded! Restart anytime to apply automatically.",
        action: {
          label: "Restart & Update",
          onClick: handleInstallUpdate,
        },
        duration: 45000,
      });
    });

    // Mandatory update enforcement status
    window.api?.updates?.getEnforcementStatus?.()
      .then((status) => {
        if (status) setEnforcementStatus(status);
      })
      .catch(() => {});

    window.api?.updates?.onEnforcementUpdated?.((status) => {
      setEnforcementStatus(status);
    });

    // Fetch app version
    window.api?.updates?.getVersion?.()
      .then((ver) => {
        if (ver) setAppVersion(ver);
      })
      .catch(() => {});
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

    const targetId = updatedTab.routeId || updatedTab.id;
    if (!targetId) return;

    // Synchronize tab state to the sidebar treeCache
    setTreeCache((prev) => {
      let cacheChanged = false;
      const nextCache = { ...prev };

      // Derive clean relative path from URL if present
      const derivedPath = updatedTab.url
        ? extractRoutePath(updatedTab.url)
        : undefined;

      for (const projectPath of Object.keys(prev)) {
        const cached = prev[projectPath];
        if (!cached || !cached.tree) continue;

        const updateRecursive = (nodes: any[]): { tree: any[]; updated: boolean } => {
          let updated = false;
          const nextNodes = nodes.map((n) => {
            if (n.id === targetId) {
              updated = true;
              return {
                ...n,
                name: updatedTab.name,
                method: updatedTab.method,
                url: updatedTab.url,
                path: derivedPath !== undefined && derivedPath !== "" ? derivedPath : n.path,
                params: updatedTab.params,
                headers: updatedTab.headers,
                auth: updatedTab.auth,
                bodyMode: updatedTab.bodyMode,
                bodyText: updatedTab.bodyText,
                formFields: updatedTab.formFields,
                urlencodedFields: updatedTab.urlencodedFields,
                binaryFilePath: updatedTab.binaryFilePath,
                preRequestScript: updatedTab.preRequestScript,
                postResponseScript: updatedTab.postResponseScript,
                pathVariables: updatedTab.pathVariables,
              };
            }
            if (n.children && Array.isArray(n.children)) {
              const res = updateRecursive(n.children);
              if (res.updated) {
                updated = true;
                return { ...n, children: res.tree };
              }
            }
            return n;
          });
          return { tree: nextNodes, updated };
        };

        const result = updateRecursive(cached.tree);
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
  };

  const handleSaveTabToTree = (targetTab: RequestTab, parentFolderId: string | null = null) => {
    const projId = targetTab.projectId || activeProjectId;
    const project = projects.find((p) => p.id === projId) || projects[0];
    if (!project) {
      toast.error("No active project to save request to");
      return;
    }

    const routeId = targetTab.routeId || `request_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const derivedPath = targetTab.url
      ? extractRoutePath(targetTab.url)
      : "";

    const newRoute: ApiRoute = {
      id: routeId,
      name: targetTab.name || "New Request",
      method: targetTab.method || "GET",
      url: targetTab.url || "",
      path: derivedPath || "",
      isManual: true,
      params: targetTab.params || [],
      headers: targetTab.headers || [],
      auth: targetTab.auth || { type: "none" },
      bodyMode: targetTab.bodyMode || "none",
      bodyText: targetTab.bodyText || "{\n  \n}",
      formFields: targetTab.formFields || [],
      urlencodedFields: targetTab.urlencodedFields || [],
      binaryFilePath: targetTab.binaryFilePath || "",
      preRequestScript: targetTab.preRequestScript || "",
      postResponseScript: targetTab.postResponseScript || "",
      pathVariables: targetTab.pathVariables || [],
    };

    const updatedTab: RequestTab = {
      ...targetTab,
      routeId,
      projectId: projId,
    };
    setTabs((prev) => prev.map((t) => (t.id === targetTab.id ? updatedTab : t)));

    setTreeCache((prev) => {
      const cached = prev[project.path];
      const currentTree = cached?.tree || [];

      let found = false;
      const updateRecursive = (nodes: any[]): any[] => {
        return nodes.map((n) => {
          if (n.id === routeId) {
            found = true;
            return { ...n, ...newRoute };
          }
          if (!isRoute(n) && Array.isArray(n.children)) {
            return { ...n, children: updateRecursive(n.children) };
          }
          return n;
        });
      };

      let newTree = updateRecursive(currentTree);
      if (!found) {
        if (parentFolderId === null) {
          newTree = [...newTree, newRoute];
        } else {
          const insertIntoFolder = (nodes: any[]): any[] => {
            return nodes.map((n) => {
              if (n.id === parentFolderId && !isRoute(n)) {
                return { ...n, children: [...(n.children || []), newRoute] };
              }
              if (!isRoute(n) && Array.isArray(n.children)) {
                return { ...n, children: insertIntoFolder(n.children) };
              }
              return n;
            });
          };
          newTree = insertIntoFolder(newTree);
        }
      }

      const nextCache = {
        ...prev,
        [project.path]: {
          ...(cached || { logs: [], cachedAt: Date.now() }),
          tree: newTree,
        },
      };
      apiClient.storeSet("apiScannerTreeCache", nextCache);
      return nextCache;
    });

    toast.success(`Saved "${newRoute.name}" to project requests!`);
  };

  const handleSaveAsTabToTree = (targetTab: RequestTab) => {
    const copyTab: RequestTab = {
      ...targetTab,
      id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: `${targetTab.name} Copy`,
      routeId: undefined,
    };
    handleSaveTabToTree(copyTab);
    setTabs((prev) => [...prev, copyTab]);
    setActiveTabId(copyTab.id);
  };

  const handleSidebarRenameNode = (nodeId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.routeId === nodeId || t.id === nodeId ? { ...t, name: newName } : t
      )
    );
  };

  const handleSidebarDeleteNode = (nodeIds: string | string[]) => {
    const idSet = new Set(Array.isArray(nodeIds) ? nodeIds : [nodeIds]);
    setTabs((prev) => {
      const next = prev.filter((t) => !idSet.has(t.routeId || "") && !idSet.has(t.id));
      if (activeTabId && (idSet.has(activeTab?.routeId || "") || idSet.has(activeTabId))) {
        setActiveTabId(next[next.length - 1]?.id || null);
      }
      return next;
    });
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
      (t) =>
        (route.id && t.routeId === route.id) ||
        (Boolean(t.routePath) && t.routePath === route.path && t.method === route.method && !t.routeId)
    );

    if (existing) {
      // Do NOT overwrite existing.url if the user already has a URL in the tab!
      // Only set a fallback URL if existing tab has no URL at all
      if (!existing.url) {
        const cleanBase = baseUrl.replace(/\/+$/, "");
        const fallbackUrl =
          route.url !== undefined && route.url !== ""
            ? route.url
            : (route.path
                ? (route.path.startsWith("http://") || route.path.startsWith("https://")
                    ? route.path
                    : `${cleanBase}${route.path.startsWith("/") ? route.path : `/${route.path}`}`)
                : (cleanBase ? `${cleanBase}/` : ""));
        if (fallbackUrl) {
          setProjectTabsMap((prevMap) => ({
            ...prevMap,
            [projectId]: (prevMap[projectId] || []).map((t) =>
              t.id === existing.id ? { ...t, url: fallbackUrl } : t
            ),
          }));
        }
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
    const initialUrl =
      route.url !== undefined && route.url !== ""
        ? route.url
        : (route.path
            ? (route.path.startsWith("http://") || route.path.startsWith("https://")
                ? route.path
                : `${cleanBase}${route.path.startsWith("/") ? route.path : `/${route.path}`}`)
            : (cleanBase ? `${cleanBase}/` : ""));

    const newTab: RequestTab = {
      id: `scanned_${projectId}_${route.id}`,
      name: route.name || pathCleaned || "New Request",
      method: finalMethod,
      url: initialUrl,
      params: route.params && route.params.length > 0 ? route.params : queryRows,
      headers: route.headers || [],
      auth: route.auth || { type: "none" },
      bodyMode: route.bodyMode || (finalMethod === "GET" || finalMethod === "HEAD" ? "none" : "json"),
      bodyText: route.bodyText !== undefined ? route.bodyText : bodyText,
      formFields: route.formFields || [],
      urlencodedFields: route.urlencodedFields || [],
      binaryFilePath: route.binaryFilePath || "",
      lastCompletedAt: 0,
      response: null,
      projectId,
      routePath: route.path,
      routeId: route.id,
      isNew: (route as any).isNew || false,
      preRequestScript: route.preRequestScript || "",
      postResponseScript: route.postResponseScript || "",
      activeScriptSubTab: (route as any).activeScriptSubTab || "prerequest",
      pathVariables: route.pathVariables || [],
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
        const queryAndHash = (t.url.match(/[?#].*$/) || [""])[0];
        if (t.routePath) {
          const pathWithSlash = t.routePath.startsWith("/") ? t.routePath : `/${t.routePath}`;
          return { ...t, url: `${cleanNoSlash}${pathWithSlash}${queryAndHash}` };
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

  const handleAddBackendFolder = async (folderPath?: unknown) => {
    try {
      const folder =
        typeof folderPath === "string" && folderPath.trim().length > 0
          ? folderPath.trim()
          : await apiClient.openDirectoryDialog();
      if (!folder || typeof folder !== "string") return;

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
    const scanStartMs = Date.now();
    setScanningProjectId(project.id);
    setScanStartTime(scanStartMs);
    setScanElapsedMs(0);

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
                "[Route Scanner] Rescanned demo routes...",
                "[Route Scanner] Discovered 7 routes across 3 controllers",
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
        setScanStartTime(null);
        const elapsed = Date.now() - scanStartMs;
        toast.success("Scan complete", {
          description: showDevScanTimer
            ? `Discovered 7 routes in ${formatScanDuration(elapsed)} • ${project.name}`
            : `Discovered 7 routes in ${project.name}`,
        });
      }, scanDuration);
      return;
    }

    try {
      const result = await apiClient.scanProject(project.path);
      const elapsed = Date.now() - scanStartMs;

      if (result?.cancelled) {
        toast.info("Scan cancelled", {
          description: showDevScanTimer
            ? `Route scan stopped after ${formatScanDuration(elapsed)} • ${project.name}`
            : `Route scan was stopped for ${project.name}`,
        });
        return;
      }

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

      const discoveredCount = result?.detectedRoutesCount || merged.length;
      toast.success("Scan complete", {
        description: showDevScanTimer
          ? `Discovered ${discoveredCount} routes in ${formatScanDuration(elapsed)} • ${project.name}`
          : `Discovered ${discoveredCount} routes in ${project.name}`,
      });
    } catch (err: any) {
      const elapsed = Date.now() - scanStartMs;
      if (err?.message?.includes("cancelled") || err?.message?.includes("aborted")) {
        toast.info("Scan cancelled", {
          description: showDevScanTimer
            ? `Route scan stopped after ${formatScanDuration(elapsed)} • ${project.name}`
            : `Route scan was stopped for ${project.name}`,
        });
      } else {
        toast.error("Scan failed", {
          description: showDevScanTimer
            ? `${err?.message || "Please verify backend directory access or rescan."} (after ${formatScanDuration(elapsed)})`
            : (err?.message || "Please verify backend directory access or rescan."),
        });
      }
    } finally {
      setScanningProjectId(null);
      setScanStartTime(null);
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  };

  const handleCancelScan = async (project: Project) => {
    try {
      await apiClient.cancelScanProject(project.path);
      setScanningProjectId(null);
      setScanStartTime(null);
      toast.info("Scan cancelled", {
        description: `Route scan was stopped for ${project.name}`,
      });
    } catch {
      setScanningProjectId(null);
      setScanStartTime(null);
    }
  };

  const handleQuickRequest = () => {
    const tab: RequestTab = {
      ...defaultTab(activeProjectId),
      name: "Quick Request",
      url: "https://httpbin.org/get",
      isNew: false,
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
              "[Route Scanner] Scanning demo routes...",
              "[Route Scanner] Parsed express router in /controllers/auth.ts",
              "[Route Scanner] Parsed express router in /controllers/products.ts",
              "[Route Scanner] Parsed health check endpoint in /server.ts",
              "[Route Scanner] Discovered 7 routes across 3 controllers",
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

      toast.success("Scan complete", {
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

    const startMs = Date.now();
    setScanningProjectId(targetProject.id);
    setScanStartTime(startMs);
    setScanElapsedMs(0);
    toast.info("Scanning backend routes...");

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
      setScanStartTime(null);
      const elapsed = Date.now() - startMs;
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
      toast.success("Scan complete!", {
        description: showDevScanTimer ? `Finished in ${formatScanDuration(elapsed)}` : undefined,
      });
    } else {
      setTimeout(() => {
        setScanningProjectId(null);
        setScanStartTime(null);
        const elapsed = Date.now() - startMs;
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
        toast.success("Scan complete!", {
          description: showDevScanTimer ? `Finished in ${formatScanDuration(elapsed)}` : undefined,
        });
      }, 5000);
    }
  };

  const activeRouteKey = useMemo(() => {
    if (!activeTab) return null;
    if (activeTab.routeId) return activeTab.routeId;
    if (activeTab.method && activeTab.routePath) {
      return toRouteKey({ method: activeTab.method, path: activeTab.routePath });
    }
    return null;
  }, [activeTab]);

  // Compute the currently selected environment for the Environment Editor View
  const currentSelectedEnv = useMemo<ApiEnvironment>(() => {
    if (selectedEnvId === GLOBALS_ENV_ID || !selectedEnvId) {
      return globals || createDefaultGlobals();
    }
    for (const envs of Object.values(backendEnvironments || {})) {
      if (Array.isArray(envs)) {
        const match = envs.find((e) => e && e.id === selectedEnvId);
        if (match) return match;
      }
    }
    return globals || createDefaultGlobals();
  }, [selectedEnvId, globals, backendEnvironments]);

  // Compute active environment variables for the current workspace request
  const { activeVariables, activeEnvName } = useMemo(() => {
    const projId = activeProjectId;
    const backendEnvId = projId ? activeBackendEnvMap?.[projId] : null;
    const backendEnvs = projId && Array.isArray(backendEnvironments?.[projId]) ? backendEnvironments[projId] : [];
    const activeBackendEnv = backendEnvs.find((e) => e && e.id === backendEnvId) || null;

    const scoped = mergeScopedVariables(
      globals?.variables || [],
      activeBackendEnv ? activeBackendEnv.variables || [] : [],
      activeBackendEnv ? activeBackendEnv.name : "Globals"
    );

    const envName = activeBackendEnv
      ? `${activeBackendEnv.name}`
      : "Globals";

    return {
      activeVariables: scoped,
      activeEnvName: envName,
    };
  }, [globals, backendEnvironments, activeBackendEnvMap, activeProjectId]);

  // Script & UI variable update handler
  const handleAddOrUpdateVariable = (
    key: string,
    value: string,
    scope: "global" | "environment" = "environment"
  ) => {
    const projId = activeProjectId;
    const backendEnvId = projId ? activeBackendEnvMap[projId] : null;

    if (scope === "global" || !projId || !backendEnvId) {
      setGlobals((prev) => {
        const nextVars = [...prev.variables];
        const existingIdx = nextVars.findIndex((v) => v.key === key);
        if (existingIdx !== -1) {
          nextVars[existingIdx] = {
            ...nextVars[existingIdx],
            currentValue: value,
            value,
          };
        } else {
          nextVars.push(createNewVariable(key, value));
        }
        return {
          ...prev,
          variables: nextVars,
          updatedAt: Date.now(),
        };
      });
      toast.success(`Saved to Globals: ${key}`);
    } else {
      setBackendEnvironments((prev) => {
        const envs = prev[projId] || [];
        const nextEnvs = envs.map((env) => {
          if (env.id === backendEnvId) {
            const nextVars = [...env.variables];
            const existingIdx = nextVars.findIndex((v) => v.key === key);
            if (existingIdx !== -1) {
              nextVars[existingIdx] = {
                ...nextVars[existingIdx],
                currentValue: value,
                value,
              };
            } else {
              nextVars.push(createNewVariable(key, value));
            }
            return {
              ...env,
              variables: nextVars,
              updatedAt: Date.now(),
            };
          }
          return env;
        });
        return {
          ...prev,
          [projId]: nextEnvs,
        };
      });
      toast.success(`Saved to Environment: ${key}`);
    }
  };

  const handleCreateEnvironment = (projectId?: string | null) => {
    const newId = `env_${Date.now()}`;
    const targetProjId = projectId ?? null;
    const newEnv: ApiEnvironment = {
      id: newId,
      name: "New Environment",
      projectId: targetProjId,
      variables: [createNewVariable("baseUrl", "http://localhost:3000")],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (targetProjId) {
      setBackendEnvironments((prev) => ({
        ...prev,
        [targetProjId]: [...(prev[targetProjId] || []), newEnv],
      }));
      // If backend has no active env, activate this new one
      if (!activeBackendEnvMap[targetProjId]) {
        setActiveBackendEnvMap((prev) => ({ ...prev, [targetProjId]: newId }));
      }
    }
    setSelectedEnvId(newId);
    setActiveSidebarTab("environments");
    toast.success("Created new environment");
  };

  const handleSetActiveBackendEnv = (projectId: string, envId: string | null) => {
    setActiveBackendEnvMap((prev) => ({ ...prev, [projectId]: envId }));
    const env = (backendEnvironments[projectId] || []).find((e) => e.id === envId);
    if (env) {
      toast.success(`Activated ${env.name}`);
    } else {
      toast.info("Deactivated environment");
    }
  };

  const handleUpdateEnvironment = (updated: ApiEnvironment) => {
    if (updated.id === GLOBALS_ENV_ID) {
      setGlobals(updated);
    } else if (updated.projectId) {
      setBackendEnvironments((prev) => {
        const envs = prev[updated.projectId!] || [];
        return {
          ...prev,
          [updated.projectId!]: envs.map((e) => (e.id === updated.id ? updated : e)),
        };
      });
    }
  };

  const handleDuplicateEnvironment = (envId: string) => {
    let source: ApiEnvironment | null = null;
    if (envId === GLOBALS_ENV_ID) {
      source = globals;
    } else {
      for (const envs of Object.values(backendEnvironments)) {
        if (Array.isArray(envs)) {
          const match = envs.find((e) => e.id === envId);
          if (match) {
            source = match;
            break;
          }
        }
      }
    }

    if (!source) return;

    const newId = `env_${Date.now()}`;
    const clone: ApiEnvironment = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      variables: source.variables.map((v) => ({
        ...v,
        id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (source.projectId) {
      setBackendEnvironments((prev) => ({
        ...prev,
        [source.projectId!]: [...(prev[source.projectId!] || []), clone],
      }));
    } else {
      const targetProj = activeProjectId;
      if (targetProj) {
        clone.projectId = targetProj;
        setBackendEnvironments((prev) => ({
          ...prev,
          [targetProj]: [...(prev[targetProj] || []), clone],
        }));
      }
    }

    setSelectedEnvId(newId);
    toast.success(`Duplicated ${source.name}`);
  };

  const handleDeleteEnvironment = (envId: string) => {
    if (envId === GLOBALS_ENV_ID) {
      toast.error("Globals cannot be deleted.");
      return;
    }

    setBackendEnvironments((prev) => {
      const next = { ...prev };
      for (const [projId, envs] of Object.entries(next)) {
        if (Array.isArray(envs)) {
          next[projId] = envs.filter((e) => e.id !== envId);
        }
      }
      return next;
    });

    setActiveBackendEnvMap((prev) => {
      const next = { ...prev };
      for (const [projId, activeId] of Object.entries(next)) {
        if (activeId === envId) {
          next[projId] = null;
        }
      }
      return next;
    });

    if (selectedEnvId === envId) {
      setSelectedEnvId(GLOBALS_ENV_ID);
    }
    toast.success("Deleted environment");
  };

  const handleRenameEnvironment = (envId: string, newName: string) => {
    if (envId === GLOBALS_ENV_ID) return;
    setBackendEnvironments((prev) => {
      const next = { ...prev };
      for (const [projId, envs] of Object.entries(next)) {
        if (Array.isArray(envs)) {
          next[projId] = envs.map((e) => (e.id === envId ? { ...e, name: newName } : e));
        }
      }
      return next;
    });
  };

  const handleExportEnvironment = (env: ApiEnvironment) => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(env, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `${env.name.toLowerCase().replace(/\s+/g, "_")}.environment.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Exported ${env.name}`);
  };

  const handleExecuteCopy = (
    targetEnvId: string,
    variablesToCopy: ApiVariable[],
    conflictMode: "merge" | "overwrite"
  ) => {
    const applyCopy = (target: ApiEnvironment): ApiEnvironment => {
      const currentVars = [...target.variables];
      const copied = variablesToCopy.map((v) => ({
        ...v,
        id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      }));

      for (const c of copied) {
        const existingIdx = currentVars.findIndex((v) => v.key === c.key);
        if (existingIdx !== -1) {
          if (conflictMode === "overwrite") {
            currentVars[existingIdx] = c;
          }
        } else {
          currentVars.push(c);
        }
      }

      return {
        ...target,
        variables: currentVars,
        updatedAt: Date.now(),
      };
    };

    if (targetEnvId === GLOBALS_ENV_ID) {
      setGlobals((prev) => applyCopy(prev));
    } else {
      setBackendEnvironments((prev) => {
        const next = { ...prev };
        for (const [projId, envs] of Object.entries(next)) {
          if (Array.isArray(envs)) {
            next[projId] = envs.map((e) => (e.id === targetEnvId ? applyCopy(e) : e));
          }
        }
        return next;
      });
    }
  };

  const handleCreateTargetEnv = (projectId: string | null, name: string): string => {
    const newId = `env_${Date.now()}`;
    const newEnv: ApiEnvironment = {
      id: newId,
      name,
      projectId,
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (projectId) {
      setBackendEnvironments((prev) => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), newEnv],
      }));
    }
    return newId;
  };

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
            onCancelScanProject={handleCancelScan}
            onRenameNode={handleSidebarRenameNode}
            onDeleteNode={handleSidebarDeleteNode}
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
      case "environments":
        return (
          <EnvironmentsSidebarPanel
            globals={globals}
            backendEnvironments={backendEnvironments}
            activeBackendEnvMap={activeBackendEnvMap}
            projects={projects}
            selectedEnvId={selectedEnvId}
            onSelectEnv={setSelectedEnvId}
            onCreateEnvironment={handleCreateEnvironment}
            onSetActiveBackendEnv={handleSetActiveBackendEnv}
            onDuplicateEnvironment={handleDuplicateEnvironment}
            onDeleteEnvironment={handleDeleteEnvironment}
            onRenameEnvironment={handleRenameEnvironment}
            onOpenCopyModal={(id) => setCopyModalSourceEnvId(id)}
            onExportEnvironment={handleExportEnvironment}
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
    globals,
    backendEnvironments,
    activeBackendEnvMap,
    selectedEnvId,
  ]);

  return (
    <TooltipProvider>
      <Toaster position="top-right" richColors closeButton theme="dark" />

      {/* Development Diagnostic Tool: Live Top-Right Scan Stopwatch */}
      {showDevScanTimer && scanStartTime !== null && (
        <div
          className={cn(
            "fixed top-5 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#10121A]/95 border border-primary/50 shadow-xl shadow-primary/15 text-xs font-mono select-none backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-200 pointer-events-none transition-all",
            Boolean(scanningProjectId) ? "right-56" : "right-6"
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-zinc-400 text-[10px] font-semibold tracking-wider uppercase">Scan Timer</span>
          <span className="font-bold text-primary tabular-nums text-xs">
            {(scanElapsedMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}
      {/* Updating & Auto-Relaunch Screen */}
      {isApplyingUpdate && (
        <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-5 shadow-2xl shadow-primary/20">
            <RefreshCw size={28} className="animate-spin text-primary" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mb-2">
            Updating RouteLens...
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
            Applying the latest update. RouteLens will close and reopen automatically in a few moments.
          </p>
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="w-full h-full bg-primary animate-pulse rounded-full" />
          </div>
        </div>
      )}
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
          sidebarHeader={
            activeSidebarTab === "environments" ? (
              <span className="text-[12px] font-medium tracking-wide text-foreground/90">
                Environments
              </span>
            ) : (
              <BackendSelectorDropdown
                projects={projects}
                activeProject={projects.find((p) => p.id === activeProjectId)}
                onSelectProject={(id) => setActiveProjectId(id)}
                onAddProjectClick={handleAddBackendFolder}
                onCloseBackend={() => setActiveProjectId(null)}
                onRemoveProject={handleRemoveProject}
              />
            )
          }
          isSidebarExpanded={isSidebarExpanded}
          onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
          sidebarWidth={sidebarWidth}
          onSidebarResizeStart={startSidebarResize}
          onDevToolsClick={() => setIsDevToolsModalOpen(true)}
          onTestExpiryClick={() => setTestForceExpired(true)}
          onDevTriggerScanAnimation={handleDevTriggerScanAnimation}
          appVersion={appVersion}
          updateBanner={<UpdateGraceBanner enforcement={enforcementStatus} onInstall={handleInstallUpdate} />}
          hasUpdatePending={!!(enforcementStatus?.hasPendingUpdate)}
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
          <CopyVariablesModal
            isOpen={Boolean(copyModalSourceEnvId)}
            onClose={() => setCopyModalSourceEnvId(null)}
            sourceEnv={
              copyModalSourceEnvId === GLOBALS_ENV_ID
                ? globals
                : Object.values(backendEnvironments)
                    .flat()
                    .find((e) => e.id === copyModalSourceEnvId) || null
            }
            globals={globals}
            backendEnvironments={backendEnvironments}
            projects={projects}
            onExecuteCopy={handleExecuteCopy}
            onCreateTargetEnv={handleCreateTargetEnv}
          />
          <DevToolsModal
            isOpen={isDevToolsModalOpen}
            onClose={() => setIsDevToolsModalOpen(false)}
            onProjectAdded={() => {}}
            projects={projects}
            treeCache={treeCache}
          />

          {/* Center Workspace Area: If scanning, cleanly display ScanningFactsOverlay as the primary center view */}
          {Boolean(scanningProjectId) ? (
            <ErrorBoundary fallback={null}>
              <ScanningFactsOverlay
                projectName={projects.find((p) => p.id === scanningProjectId)?.name}
                onDismiss={() => setScanningProjectId(null)}
              />
            </ErrorBoundary>
          ) : activeSidebarTab === "environments" ? (
            <EnvironmentEditorView
              environment={currentSelectedEnv}
              project={projects.find((p) => p.id === currentSelectedEnv.projectId)}
              isActiveForProject={
                Boolean(
                  currentSelectedEnv.projectId &&
                    activeBackendEnvMap[currentSelectedEnv.projectId] === currentSelectedEnv.id
                )
              }
              onUpdateEnvironment={handleUpdateEnvironment}
              onToggleActive={() => {
                if (currentSelectedEnv.projectId) {
                  const currentActive = activeBackendEnvMap[currentSelectedEnv.projectId];
                  handleSetActiveBackendEnv(
                    currentSelectedEnv.projectId,
                    currentActive === currentSelectedEnv.id ? null : currentSelectedEnv.id
                  );
                }
              }}
              onOpenCopyModal={(id) => setCopyModalSourceEnvId(id)}
              onDuplicateEnvironment={handleDuplicateEnvironment}
              onExportEnvironment={handleExportEnvironment}
            />
          ) : isProjectsLoaded && isTabsRestored && (projects.length === 0 || !activeProjectId) && tabs.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 select-none overflow-y-auto">
              <OnboardingView
                onOpenFolder={handleAddBackendFolder}
                onQuickRequest={handleQuickRequest}
                onLoadDemo={handleLoadDemoProject}
                onOpenManualModal={handleAddBackendFolder}
                appVersion={appVersion}
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
                      onSaveTab={handleSaveTabToTree}
                      onSaveAsTab={handleSaveAsTabToTree}
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
                  <div className="flex-1 flex flex-col min-h-[180px] overflow-hidden">
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
                // Visual-rich Project Command Deck with Victor
                (() => {
                  const activeProject = projects.find((p) => p.id === activeProjectId);
                  if (!activeProject) return null;
                  const isScanning = scanningProjectId === activeProject.id;
                  const cacheEntry = treeCache[activeProject.path];
                  const totalEndpoints = cacheEntry?.detectedRoutesCount ?? (cacheEntry?.tree?.length || 0);

                  return (
                    <ProjectIdleView
                      project={activeProject}
                      totalEndpoints={totalEndpoints}
                      isScanning={isScanning}
                      onNewTab={handleNewTab}
                      onRescan={() => handleRescanProject(activeProject)}
                      onCancelScan={() => handleCancelScan(activeProject)}
                      onRevealInExplorer={() => apiClient.showItemInFolder(activeProject.path)}
                      onCloseProject={() => setActiveProjectId(null)}
                    />
                  );
                })()
              ) : !activeProjectId ? (
                <div className="flex-grow flex flex-col items-center justify-center p-8 select-none overflow-y-auto">
                  <OnboardingView
                    onOpenFolder={handleAddBackendFolder}
                    onQuickRequest={handleQuickRequest}
                    onLoadDemo={handleLoadDemoProject}
                    onOpenManualModal={handleAddBackendFolder}
                    appVersion={appVersion}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card/5 select-none animate-in fade-in duration-200">
                  <div className="flex items-center justify-center mb-3">
                    <ResponseIdleMascot size={80} />
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

      <MandatoryUpdateModal
        enforcement={enforcementStatus}
        onInstall={handleInstallUpdate}
      />

      <GlobalContextMenu />
    </TooltipProvider>
  );
}

export default App;
