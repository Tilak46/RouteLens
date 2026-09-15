import { useState, useRef, useEffect } from "react";
import { Method, RequestTab } from "../../../types";
import { Plus, X, Globe, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiEnvironment } from "./ManageEnvironmentsModal";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type WorkspaceTabsProps = {
  tabs: RequestTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e?: React.MouseEvent) => void;
  onNewTab: () => void;
  environments?: any[];
  activeEnvId?: string | null;
  onSelectEnv?: (id: string | null) => void;
  onManageEnvsClick?: () => void;
  onReorderTabs: (newTabs: RequestTab[]) => void;
  onDuplicateTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseAllTabs: () => void;
  onCloseTabsToRight: (id: string) => void;
  onCloseTabsToLeft: (id: string) => void;
};

type SortableTabProps = {
  tab: RequestTab;
  isActive: boolean;
  colorClass: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e?: React.MouseEvent) => void;
  onContextMenu: (tabId: string, x: number, y: number) => void;
};

function SortableTab({
  tab,
  isActive,
  colorClass,
  onSelectTab,
  onCloseTab,
  onContextMenu,
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-active={isActive}
      {...attributes}
      {...listeners}
      onClick={() => onSelectTab(tab.id)}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          onCloseTab(tab.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(tab.id, e.clientX, e.clientY);
      }}
      className={cn(
        "group h-8 px-3 rounded-t-md border-t border-l border-r flex items-center gap-2 cursor-pointer transition-all duration-150 shrink-0 select-none text-xs font-medium relative top-[1px]",
        isActive
          ? "bg-[hsl(240,5%,11%)] border-border/80 text-foreground"
          : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5",
        isDragging && "shadow-md"
      )}
    >
      <span
        className={cn("font-bold text-[9.5px] w-7 shrink-0 text-center tracking-tight inline-block select-none", colorClass)}
        title={tab.method}
      >
        {tab.method === "DELETE"
          ? "DEL"
          : tab.method === "PATCH"
            ? "PAT"
            : tab.method === "OPTIONS"
              ? "OPT"
              : (tab.method?.length || 0) > 4
                ? tab.method.slice(0, 3)
                : tab.method}
      </span>
      <span className="max-w-[100px] truncate" title={tab.name}>
        {tab.name || "Untitled Request"}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCloseTab(tab.id, e);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        className="opacity-0 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded transition-all shrink-0 text-muted-foreground hover:text-foreground"
        title="Close Tab"
      >
        <X size={10} />
      </button>
    </div>
  );
}

export function WorkspaceTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  environments,
  activeEnvId,
  onSelectEnv,
  onManageEnvsClick,
  onReorderTabs,
  onDuplicateTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onCloseTabsToRight,
  onCloseTabsToLeft,
}: WorkspaceTabsProps) {
  const methodColors: Record<string, string> = {
    GET: "text-emerald-500",
    POST: "text-amber-500",
    PUT: "text-blue-500",
    DELETE: "text-rose-500",
    DEL: "text-rose-500",
    PATCH: "text-purple-500",
    PAT: "text-purple-500",
    OPTIONS: "text-pink-500",
    OPT: "text-pink-500",
    HEAD: "text-emerald-400",
    ALL: "text-zinc-500",
  };

  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  // Auto-dismiss context menu whenever tabs change or active tab switches
  useEffect(() => {
    setContextMenu(null);
  }, [activeTabId, tabs.length]);

  // Dismiss context menu on Escape key or window blur
  useEffect(() => {
    if (!contextMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    const handleBlur = () => setContextMenu(null);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
    };
  }, [contextMenu]);

  const tabsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTabId || !tabsContainerRef.current) return;
    const container = tabsContainerRef.current;
    
    // Defer slightly to allow layout and DOM components to finish updating
    const timeout = setTimeout(() => {
      const activeEl = container.querySelector(`[data-active="true"]`);
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      }
    }, 50);
    
    return () => clearTimeout(timeout);
  }, [activeTabId]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && e.deltaX === 0 && tabsContainerRef.current) {
      e.preventDefault();
      tabsContainerRef.current.scrollLeft += e.deltaY * 2.5;
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);
      onReorderTabs(arrayMove(tabs, oldIndex, newIndex));
    }
  };

  const menuWidth = 195;
  const menuHeight = 220; // Streamlined context menu
  
  let menuX = contextMenu ? contextMenu.x : 0;
  let menuY = contextMenu ? contextMenu.y : 0;
  
  if (contextMenu) {
    if (menuX + menuWidth > window.innerWidth) {
      menuX = window.innerWidth - menuWidth - 8;
    }
    if (menuY + menuHeight > window.innerHeight) {
      menuY = window.innerHeight - menuHeight - 8;
    }
  }

  return (
    <div className="h-10 bg-[var(--bg-secondary)] border-b border-border/80 flex items-center justify-between px-2 shrink-0 select-none z-15 relative">
      {/* Scrollable Tabs List on Left */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={tabsContainerRef}
          onWheel={handleWheel}
          className="flex-1 flex items-center overflow-x-auto overflow-y-hidden h-full pt-1.5 pr-2 tabs-scroll"
        >
          <SortableContext
            items={tabs.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const colorClass =
                methodColors[tab.method?.toUpperCase()] || "text-zinc-400";
              
              return (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={isActive}
                  colorClass={colorClass}
                  onSelectTab={onSelectTab}
                  onCloseTab={onCloseTab}
                  onContextMenu={(tabId, x, y) => setContextMenu({ tabId, x, y })}
                />
              );
            })}
          </SortableContext>

          {/* Plus Button */}
          <button
            onClick={onNewTab}
            className="w-6 h-6 rounded-md hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shrink-0 ml-1 mb-0.5"
            title="New Request"
          >
            <Plus size={14} />
          </button>
        </div>
      </DndContext>

      {/* Custom Right-Click Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            className="fixed z-50 min-w-[190px] bg-[hsl(240,6%,10%)] border border-border/80 rounded-md shadow-2xl p-1 text-xs select-none text-foreground/90 font-medium animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5"
            style={{ top: `${menuY}px`, left: `${menuX}px` }}
          >
            <button
              onClick={() => {
                onNewTab();
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 rounded text-left transition-colors"
            >
              <span>New Request</span>
              <span className="text-[10px] text-muted-foreground font-mono">Ctrl+T</span>
            </button>
            <button
              onClick={() => {
                onDuplicateTab(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 rounded text-left transition-colors"
            >
              <span>Duplicate Tab</span>
            </button>

            <div className="h-px bg-border/40 my-1" />

            <button
              onClick={() => {
                onCloseTab(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 rounded text-left transition-colors"
            >
              <span>Close Tab</span>
              <span className="text-[10px] text-muted-foreground font-mono">Ctrl+W</span>
            </button>
            <button
              onClick={() => {
                onCloseOtherTabs(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 rounded text-left transition-colors"
            >
              <span>Close Other Tabs</span>
            </button>
            <button
              onClick={() => {
                onCloseTabsToRight(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 rounded text-left transition-colors"
            >
              <span>Close Tabs to the Right</span>
            </button>
            <button
              onClick={() => {
                onCloseTabsToLeft(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 rounded text-left transition-colors"
            >
              <span>Close Tabs to the Left</span>
            </button>
            <div className="h-px bg-border/40 my-1" />
            <button
              onClick={() => {
                onCloseAllTabs();
                setContextMenu(null);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/5 rounded text-left transition-colors text-rose-400 hover:text-rose-300"
            >
              <span>Close All Tabs</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
