import React, { useState } from "react";
import {
  Globe,
  Plus,
  Search,
  Check,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit2,
  Download,
  Server,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Project } from "@/../types";
import { ApiEnvironment, GLOBALS_ENV_ID } from "../../types/environments";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface EnvironmentsSidebarPanelProps {
  globals: ApiEnvironment;
  backendEnvironments: Record<string, ApiEnvironment[]>;
  activeBackendEnvMap: Record<string, string | null>;
  projects: Project[];
  selectedEnvId: string | null;
  onSelectEnv: (envId: string) => void;
  onCreateEnvironment: (projectId?: string | null) => void;
  onSetActiveBackendEnv: (projectId: string, envId: string | null) => void;
  onDuplicateEnvironment: (envId: string) => void;
  onDeleteEnvironment: (envId: string) => void;
  onRenameEnvironment: (envId: string, newName: string) => void;
  onOpenCopyModal: (sourceEnvId: string) => void;
  onExportEnvironment: (env: ApiEnvironment) => void;
}

export function EnvironmentsSidebarPanel({
  globals,
  backendEnvironments,
  activeBackendEnvMap,
  projects,
  selectedEnvId,
  onSelectEnv,
  onCreateEnvironment,
  onSetActiveBackendEnv,
  onDuplicateEnvironment,
  onDeleteEnvironment,
  onRenameEnvironment,
  onOpenCopyModal,
  onExportEnvironment,
}: EnvironmentsSidebarPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingEnvId, setRenamingEnvId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const q = searchQuery.trim().toLowerCase();

  // Globals variable count
  const globalsCount = globals.variables.length;
  const isGlobalsSelected = selectedEnvId === GLOBALS_ENV_ID;

  return (
    <div className="flex flex-col h-full bg-sidebar select-none overflow-hidden text-xs">
      {/* 1. HEADER */}
      <div className="p-3 border-b border-border/80 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-tight text-foreground">
              Environments
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title="Create New Environment"
              >
                <Plus size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-popover border-border text-foreground text-xs p-1">
              <DropdownMenuItem
                onClick={() => onCreateEnvironment(null)}
                className="py-1.5 px-2.5 cursor-pointer flex items-center gap-2"
              >
                <Globe size={13} className="text-primary" />
                <span>New Global Environment</span>
              </DropdownMenuItem>
              {projects.length > 0 && <DropdownMenuSeparator />}
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => onCreateEnvironment(p.id)}
                  className="py-1.5 px-2.5 cursor-pointer flex items-center gap-2 truncate"
                >
                  <Server size={12} className="text-muted-foreground shrink-0" />
                  <span className="truncate">Env for {p.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search environments..."
            className="h-7 pl-8 pr-2 text-xs bg-input/60 border-border/60 rounded-md placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
          />
        </div>
      </div>

      {/* 2. ENVIRONMENTS LIST */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* GLOBALS SECTION */}
        {(!q || "globals".includes(q)) && (
          <div className="space-y-1">
            <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Universal
            </div>

            <div
              onClick={() => onSelectEnv(GLOBALS_ENV_ID)}
              className={cn(
                "group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-medium relative",
                isGlobalsSelected
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Globe size={13} className={isGlobalsSelected ? "text-primary shrink-0" : "text-emerald-400 shrink-0"} />
                <span className="truncate font-semibold">Globals</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/5 border border-border/40 text-muted-foreground">
                  {globalsCount} {globalsCount === 1 ? "var" : "vars"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PER-BACKEND SECTIONS */}
        <div className="space-y-3">
          <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center justify-between">
            <span>Backends</span>
            <span className="text-[9px] font-normal lowercase tracking-normal text-muted-foreground/60">
              dedicated profiles
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="text-[11px] text-muted-foreground/50 italic px-3 py-4 text-center">
              No backend projects added yet.
            </div>
          ) : (
            projects.map((project) => {
              const envs = backendEnvironments[project.id] || [];
              const activeEnvId = activeBackendEnvMap[project.id] || null;
              const isCollapsed = collapsedProjects[project.id] || false;

              const filteredEnvs = q
                ? envs.filter((e) => e.name.toLowerCase().includes(q))
                : envs;

              if (q && filteredEnvs.length === 0 && !project.name.toLowerCase().includes(q)) {
                return null;
              }

              return (
                <div key={project.id} className="space-y-1">
                  {/* Backend Group Header */}
                  <div
                    onClick={() => toggleProjectCollapse(project.id)}
                    className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 cursor-pointer group text-muted-foreground hover:text-foreground"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
                      )}
                      <Server size={12} className="text-amber-500 shrink-0" />
                      <span className="font-semibold text-xs text-foreground/90 truncate max-w-[150px]">
                        {project.name}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateEnvironment(project.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                      title={`Add environment to ${project.name}`}
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  {/* Backend Environments List */}
                  {!isCollapsed && (
                    <div className="pl-3.5 space-y-0.5 border-l border-border/40 ml-2 mt-0.5">
                      {filteredEnvs.length === 0 ? (
                        <div
                          onClick={() => onCreateEnvironment(project.id)}
                          className="px-2 py-1 text-[10px] text-muted-foreground/60 italic hover:text-primary cursor-pointer transition-colors"
                        >
                          + Create environment for {project.name}
                        </div>
                      ) : (
                        filteredEnvs.map((env) => {
                          const isSelected = selectedEnvId === env.id;
                          const isActive = activeEnvId === env.id;
                          const isRenaming = renamingEnvId === env.id;

                          return (
                            <div
                              key={env.id}
                              onClick={() => !isRenaming && onSelectEnv(env.id)}
                              className={cn(
                                "group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all text-xs font-medium relative border",
                                isSelected
                                  ? "bg-primary/10 text-primary border-primary/25"
                                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground border-transparent"
                              )}
                            >
                              {/* Left: Checkmark & Name */}
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSetActiveBackendEnv(
                                      project.id,
                                      isActive ? null : env.id
                                    );
                                  }}
                                  className={cn(
                                    "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all shrink-0",
                                    isActive
                                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                                      : "border-border/60 hover:border-border text-transparent opacity-30 group-hover:opacity-100"
                                  )}
                                  title={
                                    isActive
                                      ? "Active Environment (Click to deactivate)"
                                      : "Set as Active Environment for this backend"
                                  }
                                >
                                  <Check size={9} strokeWidth={3} className={isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"} />
                                </button>

                                {isRenaming ? (
                                  <input
                                    type="text"
                                    value={renameVal}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setRenameVal(e.target.value)}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === "Enter") {
                                        if (renameVal.trim()) {
                                          onRenameEnvironment(env.id, renameVal.trim());
                                        }
                                        setRenamingEnvId(null);
                                      } else if (e.key === "Escape") {
                                        setRenamingEnvId(null);
                                      }
                                    }}
                                    onBlur={() => {
                                      if (renameVal.trim()) {
                                        onRenameEnvironment(env.id, renameVal.trim());
                                      }
                                      setRenamingEnvId(null);
                                    }}
                                    className="h-5 bg-input border border-primary text-xs px-1 rounded flex-1 min-w-[80px] max-w-[140px]"
                                  />
                                ) : (
                                  <span className="truncate flex-1" title={env.name}>
                                    {env.name}
                                  </span>
                                )}
                              </div>

                              {/* Right: Actions */}
                              <div
                                className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/10"
                                      title="Actions"
                                    >
                                      <MoreHorizontal size={12} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-44 bg-popover border-border text-foreground text-xs p-1"
                                  >
                                    <DropdownMenuItem
                                      onClick={() =>
                                        onSetActiveBackendEnv(
                                          project.id,
                                          isActive ? null : env.id
                                        )
                                      }
                                      className="py-1.5 px-2 cursor-pointer flex items-center gap-2"
                                    >
                                      <Check size={12} className={isActive ? "text-emerald-400" : "text-muted-foreground"} />
                                      <span>{isActive ? "Deactivate" : "Set as Active"}</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() => onOpenCopyModal(env.id)}
                                      className="py-1.5 px-2 cursor-pointer flex items-center gap-2 text-primary font-medium"
                                    >
                                      <Copy size={12} />
                                      <span>Copy Variables to...</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() => onDuplicateEnvironment(env.id)}
                                      className="py-1.5 px-2 cursor-pointer flex items-center gap-2"
                                    >
                                      <Sparkles size={12} />
                                      <span>Duplicate</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() => {
                                        setRenameVal(env.name);
                                        setRenamingEnvId(env.id);
                                      }}
                                      className="py-1.5 px-2 cursor-pointer flex items-center gap-2"
                                    >
                                      <Edit2 size={12} />
                                      <span>Rename</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() => onExportEnvironment(env)}
                                      className="py-1.5 px-2 cursor-pointer flex items-center gap-2"
                                    >
                                      <Download size={12} />
                                      <span>Export as JSON</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                      onClick={() => onDeleteEnvironment(env.id)}
                                      className="py-1.5 px-2 cursor-pointer flex items-center gap-2 text-rose-400 hover:text-rose-300"
                                    >
                                      <Trash2 size={12} />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
