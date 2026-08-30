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
  ApiHttpResponse,
} from "@/../types";
import { AddProjectModal } from "@/components/AddProjectModal";
import { EditProjectModal } from "@/components/EditProjectModal";
import { AddGroupModal } from "@/components/AddGroupModal";
import { ManageGroupsModal } from "@/components/ManageGroupsModal";
import { EditWorkspaceNameModal } from "@/components/EditWorkspaceNameModal";
import { AppWorkspaceConfigModal as CreateAppWorkspaceModal } from "@/components/CreateAppWorkspaceModal";
import { DevToolsModal } from "@/components/DevToolsModal";
import { DashboardLayout, SidebarTab } from "@/layouts/DashboardLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/apiClient";
import { Toaster, toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Compass, Plus, Server, Zap, Hourglass } from "lucide-react";

// Sidebar tab panels
import { ApiExplorerSidebarPanel } from "@/views/ApiExplorerView";
import { ServersPanel } from "@/components/api-explorer/ServersPanel";
import { AutomationsPanel } from "@/components/api-explorer/AutomationsPanel";
import { SettingsSidebarPanel } from "@/components/api-explorer/SettingsSidebarPanel";

// Main workspace panels
import { WorkspaceTabs, RequestTab } from "@/components/api-explorer/WorkspaceTabs";
import { RequestPanel } from "@/components/api-explorer/RequestPanel";
import { ResponsePanel } from "@/components/api-explorer/ResponsePanel";
import { ConsoleLogsDrawer } from "@/components/api-explorer/ConsoleLogsDrawer";
import { ManageEnvironmentsModal, ApiEnvironment } from "@/components/api-explorer/ManageEnvironmentsModal";

type ProjectState = {
  [id: string]: {
    status: ProjectStatus;
    logs: string;
    url?: string;
  };
};

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
});

// State variables initialTabs and initialActiveId removed. Persisted in Electron Store.

// Early Access Beta Expiration Configuration
const BETA_EXPIRY_DATE_STR = "2026-10-30T23:59:59Z"; // GMT / UTC time format

function App() {
  const [testForceExpired, setTestForceExpired] = useState(false);
  const isBetaExpired = (Date.now() > new Date(BETA_EXPIRY_DATE_STR).getTime()) || testForceExpired;
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [appWorkspaces, setAppWorkspaces] = useState<AppWorkspace[]>([]);
  const [projectState, setProjectState] = useState<ProjectState>({});
  const [gitSummaries, setGitSummaries] = useState<Record<string, GitSummary>>({});
  const [settings, setSettings] = useState<WorkspaceSettings>({
    manageWorkspaces: false,
    workspaceSavePath: null,
  });

  // Layout UI state
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("explorer");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleProjectId, setConsoleProjectId] = useState<string | null>(null);

  // Map of project ID -> RequestTab[]
  const [projectTabsMap, setProjectTabsMap] = useState<Record<string, RequestTab[]>>({});
  // Map of project ID -> activeRequestTabId
  const [projectActiveTabIdMap, setProjectActiveTabIdMap] = useState<Record<string, string | null>>({});

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isTabsRestored, setIsTabsRestored] = useState(false);
  const [isEnvsRestored, setIsEnvsRestored] = useState(false);
  const [isLayoutRestored, setIsLayoutRestored] = useState(false);

  const currentProjId = activeProjectId || "global";

  const tabs = useMemo(() => {
    return projectTabsMap[currentProjId] || [defaultTab(currentProjId)];
  }, [projectTabsMap, currentProjId]);

  const activeTabId = useMemo(() => {
    const projActiveId = projectActiveTabIdMap[currentProjId];
    if (projActiveId && tabs.some((t) => t.id === projActiveId)) {
      return projActiveId;
    }
    return tabs[0]?.id || null;
  }, [projectActiveTabIdMap, currentProjId, tabs]);

  const setTabs = (updater: RequestTab[] | ((prev: RequestTab[]) => RequestTab[])) => {
    setProjectTabsMap((prevMap) => {
      const prevTabs = prevMap[currentProjId] || [defaultTab(currentProjId)];
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

  // Resizing states
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("devdash.sidebarWidth");
    return saved ? Math.max(270, parseInt(saved, 10)) : 270;
  });

  const [requestHeight, setRequestHeight] = useState<number>(() => {
    const saved = localStorage.getItem("devdash.requestHeight");
    return saved ? Math.max(220, parseInt(saved, 10)) : 320;
  });

  const [consoleHeight, setConsoleHeight] = useState<number>(() => {
    const saved = localStorage.getItem("devdash.consoleHeight");
    return saved ? Math.max(120, parseInt(saved, 10)) : 288;
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
    const startY = e.clientY;
    const startHeight = requestHeight;
    const totalHeight = workspaceRef.current ? workspaceRef.current.getBoundingClientRect().height : 600;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(220, Math.min(totalHeight - 180 - 6, startHeight + deltaY));
      setRequestHeight(newHeight);
      localStorage.setItem("devdash.requestHeight", String(newHeight));
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const startConsoleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = consoleHeight;

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(120, Math.min(550, startHeight - deltaY));
      setConsoleHeight(newHeight);
      localStorage.setItem("devdash.consoleHeight", String(newHeight));
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  // Modals state
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [isCreateAppWorkspaceModalOpen, setIsCreateAppWorkspaceModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isManageGroupsModalOpen, setIsManageGroupsModalOpen] = useState(false);
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
      apiClient.storeGet("isConsoleOpen").catch(() => null),
      apiClient.storeGet("consoleProjectId").catch(() => null),
      apiClient.storeGet("apiScannerTreeCache").catch(() => null)
    ]).then(([
      storedMap,
      storedActiveIdMap,
      storedActiveProjectId,
      storedEnvs,
      storedEnvId,
      storedSidebarTab,
      storedSidebarExpanded,
      storedConsoleOpen,
      storedConsoleProjectId,
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
      if (typeof storedConsoleOpen === "boolean") {
        setIsConsoleOpen(storedConsoleOpen);
      }
      if (storedConsoleProjectId !== undefined) {
        setConsoleProjectId(storedConsoleProjectId);
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

  // Sync console drawer state to Electron Store
  useEffect(() => {
    if (!isLayoutRestored) return;
    apiClient.storeSet("isConsoleOpen", isConsoleOpen);
  }, [isConsoleOpen, isLayoutRestored]);

  useEffect(() => {
    if (!isLayoutRestored) return;
    apiClient.storeSet("consoleProjectId", consoleProjectId);
  }, [consoleProjectId, isLayoutRestored]);

  // Load initial configurations from Electron Store
  useEffect(() => {
    apiClient.getSettings();
    apiClient.onGroupsLoaded(setGroups);
    apiClient.onProjectsLoaded((loadedProjects) => {
      setProjects(loadedProjects);

      setProjectState((prev) => {
        const next: ProjectState = {};
        loadedProjects.forEach((p) => {
          next[p.id] = prev[p.id] || {
            status: "stopped",
            logs: "",
            url: undefined,
          };
        });
        return next;
      });

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
    apiClient.onServerStatusChanged(({ projectId, status }) => {
      setProjectState((prevState) => ({
        ...prevState,
        [projectId]: {
          ...prevState[projectId],
          status: status,
          url: status === "stopped" ? undefined : prevState[projectId]?.url,
        },
      }));
    });
    apiClient.onTerminalLog(({ projectId, log }) => {
      setProjectState((prevState) => {
        if (!prevState[projectId]) return prevState;
        return {
          ...prevState,
          [projectId]: {
            ...prevState[projectId],
            logs: prevState[projectId].logs + log,
          },
        };
      });
    });
    apiClient.onServerUrlFound(({ projectId, url }) => {
      setProjectState((prevState) => ({
        ...prevState,
        [projectId]: { ...prevState[projectId], url: url },
      }));
    });
    apiClient.onClearLogs(({ projectId }) => {
      setProjectState((prevState) => {
        if (!prevState[projectId]) return prevState;
        return {
          ...prevState,
          [projectId]: { ...prevState[projectId], logs: "" },
        };
      });
    });
    apiClient.onSettingsLoaded(setSettings);
    apiClient.onSettingsUpdated(setSettings);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + T (New Request)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleNewTab();
      }
      // Ctrl + W (Close Active Tab)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activeTabId) {
          handleCloseTab(activeTabId);
        }
      }
      // Alt + Ctrl + W (Force Close Active Tab)
      if (e.altKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activeTabId) {
          handleCloseTab(activeTabId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTabId, tabs]);

  const handleGitSummaryChange = (projectId: string, summary: GitSummary) => {
    setGitSummaries((prev) => ({ ...prev, [projectId]: summary }));
  };

  // --- Projects View Event Handlers ---
  const handleSaveProject = async (
    projectName: string,
    startCommand: string,
    groupId: string | null,
  ) => {
    try {
      const path = await apiClient.openDirectoryDialog();
      if (path) {
        const newProject: Project = {
          id: `proj_${Date.now()}`,
          name: projectName,
          path: path,
          startCommand: startCommand,
          groupId: groupId,
        };
        apiClient.addProject(newProject);
        setIsAddProjectModalOpen(false);
        toast.success("Project added", { description: newProject.name });
      }
    } catch (error) {
      console.error("Failed to open directory dialog:", error);
      alert("Failed to open folder picker. Please try again.");
      toast.error("Failed to add project");
    }
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
    setConsoleProjectId(project.id);
    setIsConsoleOpen(true);
  };

  const handleSaveGroup = (groupName: string) => {
    apiClient.addGroup(groupName);
    setIsAddGroupModalOpen(false);
    toast.success("Group added", { description: groupName });
  };

  const handleDeleteGroup = (groupId: string) => {
    apiClient.deleteGroup(groupId);
    toast.success("Group deleted");
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

  const handleAssignProjectGroup = (
    projectId: string,
    groupId: string | null,
  ) => {
    apiClient.assignProjectToGroup(projectId, groupId);
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
    const tab = defaultTab();
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
    // Check if we already have an open tab for this specific scanned route path or routeId
    const existing = tabs.find(
      (t) => t.projectId === projectId && (t.routeId === route.id || (t.routePath === route.path && !t.routeId))
    );
    if (existing) {
      // Dynamic URL update on click to respect any newly set Base URL
      const cleanBase = baseUrl.replace(/\/+$/, "");
      const newUrl = route.path ? `${cleanBase}${route.path}` : "";
      if (existing.url !== newUrl) {
        setTabs((prev) =>
          prev.map((t) => (t.id === existing.id ? { ...t, url: newUrl } : t))
        );
      }
      setActiveTabId(existing.id);
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

    const newTab: RequestTab = {
      id: `scanned_${projectId}_${route.id}`,
      name: route.name || pathCleaned,
      method: finalMethod,
      url: route.path ? `${baseUrl.replace(/\/+$/, "")}${route.path}` : "",
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
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleBaseUrlChange = (projectId: string, newBaseUrl: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.projectId === projectId && t.routePath) {
          const cleanBase = newBaseUrl.replace(/\/+$/, "");
          const newUrl = `${cleanBase}${t.routePath}`;
          return { ...t, url: newUrl };
        }
        return t;
      })
    );
  };

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || null,
    [tabs, activeTabId]
  );

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
            projectState={projectState}
            onSelectRoute={handleSelectRoute}
            onBaseUrlChange={handleBaseUrlChange}
            treeCache={treeCache}
            setTreeCache={setTreeCache}
            activeProjectId={activeProjectId}
            onActiveProjectIdChange={setActiveProjectId}
            activeRouteKey={activeRouteKey}
          />
        );
      case "servers":
        return (
          <ServersPanel
            projects={projects}
            projectState={projectState}
            onAddProjectClick={() => setIsAddProjectModalOpen(true)}
            onEditProject={handleOpenEditModal}
            onViewLogs={handleViewLogs}
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
    projectState,
    appWorkspaces,
    workspaces,
    settings,
    tabs,
    activeProjectId,
    activeTabId,
    activeRouteKey,
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
          consoleDrawer={
            <ConsoleLogsDrawer
              isOpen={isConsoleOpen}
              onClose={() => setIsConsoleOpen(!isConsoleOpen)}
              projects={projects}
              projectState={projectState}
              activeProjectId={consoleProjectId}
              onSelectProject={setConsoleProjectId}
              consoleHeight={consoleHeight}
              onConsoleResizeStart={startConsoleResize}
            />
          }
        >
          {/* Settings Modals */}
          <AddProjectModal
            isOpen={isAddProjectModalOpen}
            onClose={() => setIsAddProjectModalOpen(false)}
            onSave={handleSaveProject}
            groups={groups}
          />
          <EditProjectModal
            project={editingProject}
            onClose={() => setEditingProject(null)}
            onSave={handleUpdateProject}
            groups={groups}
          />
          <AddGroupModal
            isOpen={isAddGroupModalOpen}
            onClose={() => setIsAddGroupModalOpen(false)}
            onSave={handleSaveGroup}
          />
          <ManageGroupsModal
            isOpen={isManageGroupsModalOpen}
            onClose={() => setIsManageGroupsModalOpen(false)}
            projects={projects}
            groups={groups}
            onAssignProjectGroup={handleAssignProjectGroup}
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

          {/* Center Request Workspace Area */}
          {!activeTab ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 select-none overflow-y-auto">
              {activeProjectId && projects.find(p => p.id === activeProjectId) ? (
                // Scanned Project Workspace Placeholder
                (() => {
                  const activeScannedProject = projects.find(p => p.id === activeProjectId)!;
                  const pState = projectState?.[activeScannedProject.id];
                  const serverStatus = pState?.status || "stopped";
                  const isRunning = serverStatus === "running";
                  return (
                    <div className="max-w-md w-full border border-border/40 bg-card/20 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-center animate-in fade-in duration-200">
                      <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center text-primary mb-5 shadow-[0_0_20px_rgba(75,144,226,0.15)]">
                        <Compass size={24} className={isRunning ? "animate-spin-slow animate-pulse text-emerald-400" : ""} />
                      </div>
                      <h2 className="text-xl font-bold text-foreground mb-1">
                        {activeScannedProject.name} Scanned
                      </h2>
                      <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                        API scanner completed successfully. Select a route from the <strong>Detected Endpoints</strong> sidebar tree on the left to start testing.
                      </p>
                      
                      <div className="bg-muted/10 border border-border/30 rounded-lg p-3 text-left space-y-2 mb-6 font-mono text-[11px] text-muted-foreground">
                        <div className="flex justify-between items-center">
                          <span>Server Status:</span>
                          <span className={`font-bold uppercase ${isRunning ? "text-emerald-400" : "text-zinc-500"}`}>
                            {serverStatus}
                          </span>
                        </div>
                        <div className="truncate">
                          <span>Path: </span>
                          <span className="text-foreground">{activeScannedProject.path}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        <Button
                          onClick={() => apiClient.toggleServer(activeScannedProject)}
                          className={`font-semibold text-xs px-4 h-8 transition-all ${
                            isRunning ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-emerald-500 hover:bg-emerald-600 text-white"
                          }`}
                        >
                          {isRunning ? "Stop Server" : "Start Server"}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={handleNewTab} 
                          className="bg-transparent border-border hover:bg-white/5 text-muted-foreground hover:text-foreground px-4 h-8"
                        >
                          Manual Request
                        </Button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Onboarding welcome screen
                <div className="max-w-2xl w-full border border-border/40 bg-card/20 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-center animate-in fade-in duration-300">
                  <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center text-primary mb-5 shadow-[0_0_20px_rgba(75,144,226,0.15)]">
                    <Compass size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">Welcome to RouteLens</h2>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
                    RouteLens automatically parses your codebase to discover, execute, and monitor API routes. Zero manual collection setups, zero manual syncs.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left mb-8">
                    {/* Step 1 */}
                    <div className="flex flex-col p-4 bg-muted/20 border border-border/30 rounded-xl hover:border-primary/20 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 shrink-0">
                        <Server size={16} />
                      </div>
                      <h3 className="text-xs font-semibold text-foreground mb-1">1. Add Local Project</h3>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Go to <strong>Local Servers</strong> and import your folder. RouteLens supports Next.js, Express, etc.
                      </p>
                      <button
                        onClick={() => setActiveSidebarTab("servers")}
                        className="mt-auto pt-3 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors text-left focus:outline-none"
                      >
                        Go to Servers &rarr;
                      </button>
                    </div>

                    {/* Step 2 */}
                    <div className="flex flex-col p-4 bg-muted/20 border border-border/30 rounded-xl hover:border-primary/20 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shrink-0">
                        <Compass size={16} />
                      </div>
                      <h3 className="text-xs font-semibold text-foreground mb-1">2. Auto-Scan Routes</h3>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Switch back to <strong>API Discovery</strong>. Your project routes will scan and render instantly.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col p-4 bg-muted/20 border border-border/30 rounded-xl hover:border-primary/20 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 shrink-0">
                        <Zap size={16} />
                      </div>
                      <h3 className="text-xs font-semibold text-foreground mb-1">3. Start & Request</h3>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Click the Play icon on your server in the sidebar, select any endpoint, and hit Send!
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button 
                      onClick={() => setIsAddProjectModalOpen(true)} 
                      className="bg-primary text-primary-foreground font-semibold px-5 h-9"
                    >
                      <Plus size={14} className="mr-1.5" /> Add Project to Start
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleNewTab} 
                      className="bg-transparent border-border hover:bg-white/5 text-muted-foreground hover:text-foreground px-5 h-9"
                    >
                      Create Manual Request
                    </Button>
                  </div>
                </div>
              )}
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
              
              {/* Resizable Split Request Panels Content */}
              <div 
                ref={workspaceRef}
                className="flex-grow flex flex-col min-h-0 overflow-hidden relative"
              >
                {/* Top Request Panel */}
                <div 
                  style={{ height: `${requestHeight}px` }} 
                  className="flex flex-col shrink-0 min-h-[220px] overflow-hidden"
                >
                  <RequestPanel
                    tab={activeTab}
                    onChangeTab={handleChangeTab}
                    onRun={(res) => handleUpdateTabResponse(activeTab.id, res)}
                    activeVariables={activeVariables}
                    activeEnvName={activeEnvName || undefined}
                    onAddOrUpdateVariable={handleAddOrUpdateVariable}
                    projects={projects}
                    projectState={projectState}
                    treeCache={treeCache}
                  />
                </div>

                {/* Horizontal Drag Handle */}
                <div
                  onMouseDown={startRequestResize}
                  className="h-[6px] hover:bg-primary/50 active:bg-primary/70 cursor-row-resize transition-colors shrink-0 z-30 border-y border-border/40"
                  title="Drag to resize panels"
                />

                {/* Bottom Response Panel */}
                <div className="flex-1 flex flex-col min-h-[180px] p-4 pt-0 overflow-hidden">
                  <ResponsePanel
                    response={activeTab.response}
                    loading={activeTab.loading}
                    tabId={activeTab.id}
                    lastCompletedAt={activeTab.lastCompletedAt}
                  />
                </div>
              </div>
            </div>
          )}
        </DashboardLayout>
      </ErrorBoundary>
      )}
    </TooltipProvider>
  );
}

export default App;
