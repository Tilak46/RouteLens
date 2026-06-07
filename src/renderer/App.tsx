import { useState, useEffect } from "react";
import {
  Project,
  Group,
  ProjectStatus,
  Workspace,
  AppWorkspace,
  WorkspaceSettings,
  GitSummary,
} from "@/../types";
import { AddProjectModal } from "@/components/AddProjectModal";
import { EditProjectModal } from "@/components/EditProjectModal";
import { LogViewer } from "@/components/LogViewer";
import { AddGroupModal } from "@/components/AddGroupModal";
import { ManageGroupsModal } from "@/components/ManageGroupsModal";
import { WorkspacesView } from "@/views/WorkspacesView";
import { ProjectsView } from "@/views/ProjectsView";
import { ApiExplorerView } from "@/views/ApiExplorerView";
import { EditWorkspaceNameModal } from "@/components/EditWorkspaceNameModal";
import { AppWorkspaceConfigModal as CreateAppWorkspaceModal } from "@/components/CreateAppWorkspaceModal"; // Import
import { DashboardLayout, ActiveView } from "@/layouts/DashboardLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import apiClient from "@/lib/apiClient";
import { Toaster, toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type ProjectState = {
  [id: string]: {
    status: ProjectStatus;
    logs: string;
    url?: string;
  };
};

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [appWorkspaces, setAppWorkspaces] = useState<AppWorkspace[]>([]);
  const [projectState, setProjectState] = useState<ProjectState>({});
  const [gitSummaries, setGitSummaries] = useState<Record<string, GitSummary>>(
    {},
  );
  const [settings, setSettings] = useState<WorkspaceSettings>({
    manageWorkspaces: false,
    workspaceSavePath: null,
  });
  const [currentView, setCurrentView] = useState<ActiveView>("projects");
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [isCreateAppWorkspaceModalOpen, setIsCreateAppWorkspaceModalOpen] =
    useState(false); // New State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingLogsFor, setViewingLogsFor] = useState<Project | null>(null);
  const [isManageGroupsModalOpen, setIsManageGroupsModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [editingAppWorkspace, setEditingAppWorkspace] =
    useState<AppWorkspace | null>(null);

  useEffect(() => {
    apiClient.getSettings();
    apiClient.onGroupsLoaded(setGroups);
    // ... rest of the existing useEffect code
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
    apiClient.onAppWorkspacesLoaded(setAppWorkspaces); // App Workspaces
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

  const handleGitSummaryChange = (projectId: string, summary: GitSummary) => {
    setGitSummaries((prev) => ({ ...prev, [projectId]: summary }));
  };

  // --- Handlers ---
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
    setViewingLogsFor(project);
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
    toast.success("God Mode Workspace Created", {
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
    toast.success("God Mode Workspace Updated", {
      description: workspace.name,
    });
  };

  const handleEditAppWorkspace = (workspace: AppWorkspace) => {
    setEditingAppWorkspace(workspace);
    setIsCreateAppWorkspaceModalOpen(true);
  };

  // Workspace Edit Name Handlers
  const handleOpenEditWorkspaceNameModal = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
  };
  const handleSaveWorkspaceName = (
    workspaceId: string,
    newDisplayName: string | null,
  ) => {
    apiClient.updateWorkspace({ id: workspaceId, displayName: newDisplayName });
    setEditingWorkspace(null); // Close modal
  };
  // Workspace Pin Handler
  const handleToggleWorkspacePin = (workspace: Workspace) => {
    apiClient.updateWorkspace({
      id: workspace.id,
      isPinned: !workspace.isPinned,
    });
  };
  // Workspace Reveal File Handler
  const handleRevealWorkspaceFile = (workspacePath: string) => {
    apiClient.showItemInFolder(workspacePath);
  };
  // Workspace Remove Handler
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

  return (
    <TooltipProvider>
      <Toaster position="top-right" richColors closeButton theme="dark" />
      <ErrorBoundary>
        <DashboardLayout
          activeView={currentView}
          onViewChange={setCurrentView}
          onManageGroupsClick={() => setIsManageGroupsModalOpen(true)}
        >
          {/* Modals */}
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
          <LogViewer
            isOpen={!!viewingLogsFor}
            onClose={() => setViewingLogsFor(null)}
            projectName={viewingLogsFor?.name || ""}
            projectId={viewingLogsFor?.id || ""}
            logs={
              viewingLogsFor ? projectState[viewingLogsFor.id]?.logs || "" : ""
            }
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

          {/* Main Content Area */}
          {currentView === "projects" && (
            <ProjectsView
              projects={projects}
              groups={groups}
              projectState={projectState}
              gitSummaries={gitSummaries}
              settings={settings}
              onAddProjectClick={() => setIsAddProjectModalOpen(true)}
              onAddGroupClick={() => setIsAddGroupModalOpen(true)}
              onEditProject={handleOpenEditModal}
              onViewLogs={handleViewLogs}
              onDeleteGroup={handleDeleteGroup}
              onOpenWorkspace={handleOpenWorkspace}
              onToggleWorkspaces={handleToggleWorkspaces}
              onSelectWorkspacePath={handleSelectWorkspacePath}
              onGitSummaryChange={handleGitSummaryChange}
            />
          )}
          {currentView === "workspaces" && (
            <WorkspacesView
              workspaces={workspaces}
              appWorkspaces={appWorkspaces}
              projects={projects} // Helper for selection
              onAddWorkspace={handleAddWorkspaceFile}
              onNewAutomation={() => {
                setEditingAppWorkspace(null);
                setIsCreateAppWorkspaceModalOpen(true);
              }}
              onLaunchAppWorkspace={handleLaunchAppWorkspace}
              onDeleteAppWorkspace={apiClient.deleteAppWorkspace}
              onEditWorkspaceName={handleOpenEditWorkspaceNameModal} // Pass handler
              onTogglePin={handleToggleWorkspacePin} // Pass handler
              onRevealFile={handleRevealWorkspaceFile} // Pass handler
              onRemoveWorkspace={handleRemoveWorkspace} // Pass handler
              onEditAppWorkspace={handleEditAppWorkspace}
            />
          )}
          {currentView === "api-explorer" && (
            <ApiExplorerView projects={projects} />
          )}
        </DashboardLayout>
      </ErrorBoundary>
    </TooltipProvider>
  );
}

export default App;
