import React, { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FolderKanban,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ListTree,
  Briefcase,
  Ghost,
  Radio,
} from "lucide-react";
import apiClient from "@/lib/apiClient";

export type ActiveView = "projects" | "workspaces" | "api-explorer";

type DashboardLayoutProps = {
  children: React.ReactNode;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  onManageGroupsClick: () => void;
};

export function DashboardLayout({
  children,
  activeView,
  onViewChange,
  onManageGroupsClick,
}: DashboardLayoutProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper component for navigation buttons
  const NavButton = ({
    viewId,
    currentView,
    setView,
    icon: Icon,
    label,
    tooltip,
  }: {
    viewId: ActiveView;
    currentView: ActiveView;
    setView: (view: ActiveView) => void;
    icon: React.ElementType;
    label: string;
    tooltip: string;
  }) => {
    const isActive = viewId === currentView;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setView(viewId)}
            className={`group relative flex items-center gap-4 h-12 rounded-xl transition-all duration-300 overflow-hidden ${
              isActive
                ? "bg-primary/10 text-primary shadow-[0_0_20px_rgba(192,132,252,0.15)] ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            } ${
              isExpanded ? "w-full px-4 justify-start" : "w-12 justify-center"
            }`}
          >
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_10px_var(--primary)]" />
            )}
            <Icon
              className={`h-5 w-5 flex-shrink-0 transition-transform duration-300 ${
                isActive ? "scale-110" : "group-hover:scale-110"
              }`}
            />
            {isExpanded && (
              <span className="font-medium truncate tracking-wide text-sm">
                {label}
              </span>
            )}
            <span className="sr-only">{tooltip}</span>
          </button>
        </TooltipTrigger>
        {!isExpanded && (
          <TooltipContent side="right" className="bg-popover/90 backdrop-blur border-white/10 text-popover-foreground">
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20 selection:text-primary">
        {/* Glassmorphism Sidebar */}
        <aside
          className={`relative h-screen flex flex-col justify-between transition-all duration-500 ease-spring ${
            isExpanded ? "w-72" : "w-20"
          } bg-card/30 backdrop-blur-xl border-r border-white/5 z-50`}
        >
          {/* Top Sections Wrapper */}
          <div className="flex flex-col w-full p-4 gap-6">
            {/* Logo & Toggle */}
            <div
              className={`flex items-center ${
                isExpanded ? "justify-between" : "justify-center"
              }`}
            >
              {isExpanded && (
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-300 to-accent bg-clip-text text-transparent pl-1 animate-pulse-slow">
                  DevDash
                </h1>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                {isExpanded ? (
                  <PanelLeftClose size={20} />
                ) : (
                  <PanelLeftOpen size={20} />
                )}
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-2 w-full">
              <NavButton
                viewId="projects"
                currentView={activeView}
                setView={onViewChange}
                icon={FolderKanban}
                label="Projects"
                tooltip="All XML Projects"
              />
              <NavButton
                viewId="workspaces"
                currentView={activeView}
                setView={onViewChange}
                icon={Briefcase}
                label="Workspaces"
                tooltip="VS Code Workspaces"
              />
              <NavButton
                viewId="api-explorer"
                currentView={activeView}
                setView={onViewChange}
                icon={Radio}
                label="API Explorer"
                tooltip="Auto-Discovery Client"
              />
            </nav>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />

            {/* Actions */}
            <nav className="flex flex-col gap-2 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onManageGroupsClick}
                    className={`group flex items-center gap-4 h-12 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-300 ${
                      isExpanded
                        ? "w-full px-4 justify-start"
                        : "w-12 justify-center"
                    }`}
                  >
                    <ListTree className="h-5 w-5 flex-shrink-0 group-hover:text-accent transition-colors" />
                    {isExpanded && (
                      <span className="font-medium truncate text-sm">Organize</span>
                    )}
                  </button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="bg-popover/90 backdrop-blur border-white/10">Organize Groups</TooltipContent>
                )}
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => apiClient.toggleGhostMode()}
                    className={`group flex items-center gap-4 h-12 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-300 ${
                      isExpanded
                        ? "w-full px-4 justify-start"
                        : "w-12 justify-center"
                    }`}
                  >
                    <Ghost className="h-5 w-5 flex-shrink-0 group-hover:text-accent transition-colors" />
                    {isExpanded && (
                      <span className="font-medium truncate text-sm">Ghost Mode</span>
                    )}
                  </button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="bg-popover/90 backdrop-blur border-white/10">Ghost Mode</TooltipContent>
                )}
              </Tooltip>
            </nav>
          </div>

          {/* Bottom Section (Settings) */}
          <div className="p-4 w-full">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`group flex items-center gap-4 h-12 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-300 ${
                    isExpanded
                      ? "w-full px-4 justify-start"
                      : "w-12 justify-center"
                  }`}
                >
                  <Settings className="h-5 w-5 flex-shrink-0 group-hover:rotate-90 transition-transform duration-500" />
                  {isExpanded && (
                    <span className="font-medium truncate text-sm">Settings</span>
                  )}
                </button>
              </TooltipTrigger>
              {!isExpanded && (
                <TooltipContent side="right" className="bg-popover/90 backdrop-blur border-white/10">Settings</TooltipContent>
              )}
            </Tooltip>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-background to-background">
          {/* Subtle glow effect in the top right corner */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[100px] pointer-events-none rounded-full" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 blur-[100px] pointer-events-none rounded-full" />
          
          <div className="relative z-10 p-8 h-full">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
