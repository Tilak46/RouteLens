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
  Terminal,
  Lock,
  Ghost,
  SlidersHorizontal,
  Minus,
  Square,
  X,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { cn } from "@/lib/utils";

export type SidebarTab = "explorer" | "environments" | "automations" | "settings";

type DashboardLayoutProps = {
  children: React.ReactNode;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  sidebarContent: React.ReactNode;
  sidebarHeader?: React.ReactNode;
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
  sidebarHeader,
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
              "group relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150 cursor-pointer",
              isActive
                ? "bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition-transform duration-150",
                isActive ? "scale-105" : "group-hover:scale-105"
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[#141416] border border-white/[0.08] text-foreground text-[11px] shadow-xl px-2 py-1 rounded">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-screen bg-[var(--bg-primary)] text-foreground overflow-hidden font-sans">
        
        {/* TOP TITLEBAR STRIP */}
        <header
          style={{ height: "42px", WebkitAppRegion: "drag" } as React.CSSProperties}
          className="w-full bg-[var(--bg-secondary)] border-b border-white/[0.06] flex items-center justify-between px-3 shrink-0 select-none z-50"
        >
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <img src={logoImg} alt="RouteLens" className="w-3.5 h-3.5 object-contain rounded" />
            <span className="text-[12px] font-medium text-foreground/80 tracking-wide">RouteLens</span>
          </div>

          {/* Custom Window Controls (Edge-to-Edge with full border continuity) */}
          <div className="flex items-center h-full -mr-3" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button
              onClick={() => window.api?.minimizeWindow?.()}
              className="h-full px-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={() => window.api?.maximizeWindow?.()}
              className="h-full px-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Maximize / Restore"
            >
              <Square size={11} />
            </button>
            <button
              onClick={() => window.api?.closeWindow?.()}
              className="h-full px-4 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-red-500 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 1. LEFT NARROW ICON TOOLBAR */}
          <div className="w-12 bg-[var(--bg-secondary)] border-r border-white/[0.06] flex flex-col justify-between items-center py-3.5 shrink-0 z-30">
            <div className="flex flex-col items-center gap-4 w-full">
            {/* Tabs */}
            <ToolbarButton tabId="explorer" icon={Compass} label="Backends & APIs" />
            <ToolbarButton tabId="environments" icon={SlidersHorizontal} label="Environments" />
          </div>

          <div className="flex flex-col items-center gap-3 w-full">
            {/* Dev Tools (Development Only) */}
            {import.meta.env.DEV && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onDevToolsClick}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-200 cursor-pointer"
                  >
                    <Terminal size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#141416] border border-white/[0.08] text-foreground text-[11px] shadow-xl px-2 py-1 rounded">
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
                    title="Dev: Test Scan Screen"
                  >
                    <Ghost size={16} className="group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#141416] border border-white/[0.08] text-cyan-300 text-[11px] font-medium shadow-xl px-2 py-1 rounded">
                  Dev: Test Scan Screen
                </TooltipContent>
              </Tooltip>
            )}

            {/* Expiry Test Button (Development Only) */}
            {import.meta.env.DEV && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onTestExpiryClick}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all duration-200 cursor-pointer"
                  >
                    <Lock size={15} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#141416] border border-white/[0.08] text-foreground text-[11px] shadow-xl px-2 py-1 rounded">
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
            "bg-[var(--bg-secondary)] border-r border-white/[0.06] flex flex-col shrink-0 relative z-30 isolate transform-gpu",
            isSidebarExpanded ? "" : "w-0 border-r-0 transition-all duration-300"
          )}
          style={isSidebarExpanded ? { width: `${sidebarWidth || 256}px`, transform: "translateZ(0)" } : undefined}
        >
          {isSidebarExpanded && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Sidebar Header: height h-10 and border-b matching request tabs bar */}
              <div className="h-10 px-3 bg-[var(--bg-secondary)] border-b border-white/[0.06] flex items-center justify-between shrink-0 select-none">
                <div className="flex-1 min-w-0 pr-2">
                  {sidebarHeader || (
                    <span className="text-[12px] font-medium tracking-wide text-foreground/80">
                      RouteLens
                    </span>
                  )}
                </div>
                <button
                  onClick={onToggleSidebar}
                  className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              {/* Sidebar Content */}
              <div
                className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden isolate transform-gpu"
                style={{ transform: "translateZ(0)" }}
              >
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
                  className="absolute left-0 top-1/2 -translate-y-1/2 bg-[#121214] border border-l-0 border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] h-14 w-3.5 flex items-center justify-center rounded-r-md transition-all shadow-lg z-30 cursor-pointer group"
                >
                  <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#141416] border border-white/[0.08] text-foreground text-[11px] shadow-xl px-2 py-1 rounded">
                Expand Sidebar (Backends & APIs)
              </TooltipContent>
            </Tooltip>
          )}
        </aside>

        {/* 3. MAIN WORKSPACE AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)] overflow-hidden relative">
          {updateBanner}
          {/* Main workspace container (no padding so request/response tab layouts can fit edge-to-edge) */}
          <main className="flex-grow flex flex-col min-h-0 relative overflow-hidden">
            {children}
          </main>

          {/* 4. BOTTOM LOGS CONSOLE */}
          {consoleDrawer}
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}
