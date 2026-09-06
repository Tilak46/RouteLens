import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Compass,
  Server,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderCode,
  Terminal,
  Lock,
  Ghost,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarTab = "explorer" | "automations" | "settings";

type DashboardLayoutProps = {
  children: React.ReactNode;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  sidebarContent: React.ReactNode;
  consoleDrawer?: React.ReactNode;
  isSidebarExpanded: boolean;
  onToggleSidebar: () => void;
  sidebarWidth?: number;
  onSidebarResizeStart?: (e: React.MouseEvent) => void;
  onDevToolsClick?: () => void;
  onTestExpiryClick?: () => void;
  onDevTriggerScanAnimation?: () => void;
  appVersion?: string;
  updateBanner?: React.ReactNode;
  hasUpdatePending?: boolean;
};

export function DashboardLayout({
  children,
  activeTab,
  onTabChange,
  sidebarContent,
  consoleDrawer,
  isSidebarExpanded,
  onToggleSidebar,
  sidebarWidth,
  onSidebarResizeStart,
  onDevToolsClick,
  onTestExpiryClick,
  onDevTriggerScanAnimation,
  appVersion,
  updateBanner,
  hasUpdatePending,
}: DashboardLayoutProps) {
  // Helper for leftmost toolbar icons
  const ToolbarButton = ({
    tabId,
    icon: Icon,
    label,
  }: {
    tabId: SidebarTab;
    icon: React.ElementType;
    label: string;
  }) => {
    const isActive = activeTab === tabId;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              if (!isSidebarExpanded) {
                onToggleSidebar();
              }
              onTabChange(tabId);
            }}
            className={cn(
              "group relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 cursor-pointer",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            {isActive && (
              <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r-md" />
            )}
            <Icon
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isActive ? "scale-110" : "group-hover:scale-110"
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
        
        {/* 1. LEFT NARROW ICON TOOLBAR */}
        <div className="w-12 bg-[hsl(240,6%,4%)] border-r border-border/80 flex flex-col justify-between items-center py-3.5 shrink-0 z-30">
          <div className="flex flex-col items-center gap-4 w-full">
            {/* Logo Icon - click to toggle sidebar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleSidebar}
                  className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2 shadow-[0_0_15px_rgba(255,108,55,0.1)] hover:bg-primary/20 hover:scale-105 transition-all cursor-pointer"
                >
                  <FolderCode size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-xs">
                {isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
              </TooltipContent>
            </Tooltip>

            {/* Tabs */}
            <ToolbarButton tabId="explorer" icon={Compass} label="Backends & APIs" />
          </div>

          <div className="flex flex-col items-center gap-3 w-full">
            {/* Dev Tools (Development Only) */}
            {import.meta.env.DEV && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onDevToolsClick}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-200"
                  >
                    <Terminal size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border text-xs">
                  Developer Panel
                </TooltipContent>
              </Tooltip>
            )}

            {/* Dev: Scan & Ghost Hunter Mini-Game Trigger (Development Only) */}
            {import.meta.env.DEV && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onDevTriggerScanAnimation}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-cyan-400 hover:bg-cyan-500/15 hover:text-cyan-300 transition-all duration-200 group cursor-pointer"
                    title="Dev: Test Scan & Ghost Mini-Game"
                  >
                    <Ghost size={16} className="group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border text-xs font-medium text-cyan-300">
                  Dev: Test Scan & Ghost Mini-Game
                </TooltipContent>
              </Tooltip>
            )}

            {/* Expiry Test Button (Development Only) */}
            {import.meta.env.DEV && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onTestExpiryClick}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all duration-200"
                  >
                    <Lock size={15} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border text-xs">
                  Test Expiry Screen
                </TooltipContent>
              </Tooltip>
            )}

            {/* Settings (Development Only) */}
            {import.meta.env.DEV && (
              <div className="relative">
                <ToolbarButton tabId="settings" icon={Settings} label="Settings (Dev Only)" />
                {hasUpdatePending && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. SECONDARY COLLAPSIBLE SIDEBAR */}
        <aside
          className={cn(
            "bg-[hsl(240,5%,9%)] border-r border-border/60 flex flex-col shrink-0 relative z-20",
            isSidebarExpanded ? "" : "w-0 border-r-0 transition-all duration-300"
          )}
          style={isSidebarExpanded ? { width: `${sidebarWidth || 256}px` } : undefined}
        >
          {isSidebarExpanded && (
            <div className="flex flex-col h-full p-3.5 overflow-hidden">
              {/* App Brand Header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-sm font-bold tracking-wider text-foreground">
                    Route<span className="text-primary">Lens</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                    v{appVersion || "0.1.0"}
                  </span>
                </div>
                <button
                  onClick={onToggleSidebar}
                  className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto">
                {sidebarContent}
              </div>
            </div>
          )}

          {/* Col resize handle centered on border */}
          {isSidebarExpanded && onSidebarResizeStart && (
            <div
              onMouseDown={onSidebarResizeStart}
              className="absolute right-[-2px] top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-primary/50 active:bg-primary/70 transition-colors z-30"
            />
          )}

          {/* Toggle sidebar handle when collapsed */}
          {!isSidebarExpanded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleSidebar}
                  className="absolute left-0 top-1/2 -translate-y-1/2 bg-[hsl(240,6%,8%)] border border-l-0 border-border/80 text-muted-foreground hover:text-primary hover:bg-primary/15 hover:border-primary/40 h-14 w-4 flex items-center justify-center rounded-r-md transition-all shadow-lg z-30 cursor-pointer group"
                >
                  <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover border-border text-popover-foreground text-xs">
                Expand Sidebar (Backends & APIs)
              </TooltipContent>
            </Tooltip>
          )}
        </aside>

        {/* 3. MAIN WORKSPACE AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-[hsl(240,5%,11%)] overflow-hidden relative">
          {updateBanner}
          {/* Main workspace container (no padding so request/response tab layouts can fit edge-to-edge) */}
          <main className="flex-grow flex flex-col min-h-0 relative overflow-hidden">
            {children}
          </main>

          {/* 4. BOTTOM LOGS CONSOLE */}
          {consoleDrawer}
        </div>
      </div>
    </TooltipProvider>
  );
}
