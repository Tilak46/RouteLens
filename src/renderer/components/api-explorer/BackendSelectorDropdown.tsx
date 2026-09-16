import React, { useState, useMemo } from "react";
import { Project } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Search, Plus, Check, Server, Home, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BackendSelectorDropdownProps = {
  projects: Project[];
  activeProject?: Project | null;
  onSelectProject: (projectId: string) => void;
  onAddProjectClick: () => void;
  onCloseBackend?: () => void;
  onRemoveProject?: (projectId: string) => void;
};

export function BackendSelectorDropdown({
  projects,
  activeProject,
  onSelectProject,
  onAddProjectClick,
  onCloseBackend,
  onRemoveProject,
}: BackendSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.path && p.path.toLowerCase().includes(query))
    );
  }, [projects, searchQuery]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 px-1.5 py-1 -ml-1 text-[12px] font-medium text-foreground/90 hover:bg-white/5 rounded-md transition-colors max-w-full truncate cursor-pointer group focus:outline-none"
          title={activeProject ? `${activeProject.name} (${activeProject.path})` : "Select Backend"}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                activeProject ? "bg-primary" : "bg-muted-foreground/40"
              )}
            />
            <span className="truncate max-w-[150px]">
              {activeProject?.name || "Backends"}
            </span>
          </div>
          <ChevronDown
            size={11}
            className={cn(
              "text-muted-foreground/60 group-hover:text-foreground transition-transform duration-200 shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-64 p-2 bg-[#121214] border border-white/[0.06] text-foreground rounded-lg shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Mini search bar */}
        <div className="relative mb-2">
          <Search
            size={11}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search backends..."
            className="w-full h-7 pl-7 pr-2.5 bg-white/[0.03] border-0 focus:bg-white/[0.05] rounded text-[11.5px] text-foreground placeholder:text-muted-foreground/45 focus:outline-none outline-none ring-0 transition-colors"
            autoFocus
          />
        </div>

        {/* Backends list */}
        <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
          {filteredProjects.length === 0 ? (
            <div className="text-[11px] text-muted-foreground/50 text-center py-3 select-none">
              No backends match "{searchQuery}"
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isActive = activeProject?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "group/item flex items-center justify-between px-2 py-1.5 rounded-md text-[11.5px] cursor-pointer transition-colors select-none",
                    isActive
                      ? "bg-white/[0.07] text-foreground font-medium"
                      : "text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.04]"
                  )}
                  title={p.path}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        isActive ? "bg-primary" : "bg-muted-foreground/40"
                      )}
                    />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isActive && (
                      <Check size={11} className="text-primary shrink-0" />
                    )}
                    {onRemoveProject && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveProject(p.id);
                        }}
                        className="opacity-0 group-hover/item:opacity-100 p-0.5 text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                        title={`Remove "${p.name}" from workspace`}
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

        {/* Separator & Actions */}
        <div className="border-t border-white/[0.06] mt-1.5 pt-1.5 space-y-0.5">
          <button
            onClick={() => {
              setIsOpen(false);
              onAddProjectClick();
            }}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] rounded-md transition-colors cursor-pointer"
          >
            <Plus size={11} />
            <span>Add Backend</span>
          </button>

          {activeProject && onCloseBackend && (
            <button
              onClick={() => {
                setIsOpen(false);
                onCloseBackend();
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] rounded-md transition-colors cursor-pointer"
              title="Close current backend and return to Home"
            >
              <Home size={11} className="text-muted-foreground/70" />
              <span>Close Backend (Home)</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
