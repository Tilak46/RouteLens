import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FileCode, Edit2, Trash, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiFolder, ApiRoute, isRoute } from "../../../types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SidebarProps = {
  tree: ApiFolder[];
  selectedKey?: string;
  onSelect: (route: ApiRoute) => void;
  onRenameNode?: (nodeId: string, newName: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddFolder?: (parentFolderId: string) => void;
  onAddRequest?: (parentFolderId: string) => void;
  onMoveNode?: (draggedId: string, targetNodeId: string | null, position: "inside" | "before" | "after") => void;
  expandedFolderIds?: string[];
  onToggleFolderExpanded?: (folderId: string, isOpen: boolean) => void;
  newlyCreatedNodeId?: string | null;
  onClearNewlyCreatedNodeId?: () => void;
  onDuplicateNode?: (nodeId: string) => void;
  onCopyNode?: (route: ApiRoute) => void;
};

const toRouteKey = (route: Pick<ApiRoute, "method" | "path">) => {
  return `${String(route.method).toUpperCase()}:${route.path}`;
};

const findNodeInTree = (id: string, nodes: (ApiFolder | ApiRoute)[]): ApiFolder | ApiRoute | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (!isRoute(n) && Array.isArray(n.children)) {
      const found = findNodeInTree(id, n.children);
      if (found) return found;
    }
  }
  return null;
};

export function Sidebar({
  tree,
  selectedKey,
  onSelect,
  onRenameNode,
  onDeleteNode,
  onAddFolder,
  onAddRequest,
  onMoveNode,
  expandedFolderIds = [],
  onToggleFolderExpanded,
  newlyCreatedNodeId,
  onClearNewlyCreatedNodeId,
  onDuplicateNode,
  onCopyNode,
}: SidebarProps) {
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [deleteConfirmNode, setDeleteConfirmNode] = useState<{ id: string; name: string; isFolder: boolean } | null>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOverRoot(true);
      }}
      onDragLeave={() => {
        setIsDragOverRoot(false);
      }}
      onDrop={(e) => {
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId) {
          onMoveNode && onMoveNode(draggedId, null, "inside");
        }
        setIsDragOverRoot(false);
      }}
      className={cn(
        "p-2 space-y-0.5 min-h-[300px] transition-all duration-200 border border-transparent rounded-lg relative group/sidebar",
        isDragOverRoot && "border-dashed border-primary/40 bg-primary/5"
      )}
    >
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          selectedKey={selectedKey}
          onSelect={onSelect}
          onRenameNode={onRenameNode}
          onDeleteNode={(nodeId) => {
            const found = findNodeInTree(nodeId, tree);
            if (found) {
              setDeleteConfirmNode({
                id: nodeId,
                name: found.name,
                isFolder: !isRoute(found),
              });
            }
          }}
          onAddFolder={onAddFolder}
          onAddRequest={onAddRequest}
          onMoveNode={onMoveNode}
          expandedFolderIds={expandedFolderIds}
          onToggleFolderExpanded={onToggleFolderExpanded}
          newlyCreatedNodeId={newlyCreatedNodeId}
          onClearNewlyCreatedNodeId={onClearNewlyCreatedNodeId}
          onDuplicateNode={onDuplicateNode}
          onCopyNode={onCopyNode}
        />
      ))}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deleteConfirmNode !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmNode(null);
        }}
      >
        <AlertDialogContent className="bg-popover border border-border text-foreground w-[90%] max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {deleteConfirmNode?.isFolder ? "Folder" : "Request"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs leading-normal">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">
                "{deleteConfirmNode?.name}"
              </strong>
              {deleteConfirmNode?.isFolder
                ? " and all of its contents? This will permanently delete everything inside it."
                : "? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel className="bg-transparent border border-border text-foreground hover:bg-white/5 text-xs h-9">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmNode && onDeleteNode) {
                  onDeleteNode(deleteConfirmNode.id);
                }
                setDeleteConfirmNode(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold h-9"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type TreeNodeProps = {
  node: ApiFolder | ApiRoute;
  level: number;
  selectedKey?: string;
  onSelect: (route: ApiRoute) => void;
  onRenameNode?: (nodeId: string, newName: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddFolder?: (parentFolderId: string) => void;
  onAddRequest?: (parentFolderId: string) => void;
  onMoveNode?: (draggedId: string, targetNodeId: string | null, position: "inside" | "before" | "after") => void;
  expandedFolderIds?: string[];
  onToggleFolderExpanded?: (folderId: string, isOpen: boolean) => void;
  newlyCreatedNodeId?: string | null;
  onClearNewlyCreatedNodeId?: () => void;
  onDuplicateNode?: (nodeId: string) => void;
  onCopyNode?: (route: ApiRoute) => void;
};

function TreeNode({
  node,
  level,
  selectedKey,
  onSelect,
  onRenameNode,
  onDeleteNode,
  onAddFolder,
  onAddRequest,
  onMoveNode,
  expandedFolderIds = [],
  onToggleFolderExpanded,
  newlyCreatedNodeId,
  onClearNewlyCreatedNodeId,
  onDuplicateNode,
  onCopyNode,
}: TreeNodeProps) {
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isOpen = onToggleFolderExpanded ? expandedFolderIds.includes(node.id) : localIsOpen;
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(node.name);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | "inside" | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (newlyCreatedNodeId === node.id) {
      setRenameVal(node.name);
      setIsRenaming(true);
      onClearNewlyCreatedNodeId?.();
    }
  }, [newlyCreatedNodeId, node.id]);
  
  const paddingLeft = level * 20 + 8; // Indent

  if (isRoute(node)) {
    const isSelected = selectedKey === node.id || selectedKey === toRouteKey(node);
    return (
      <div
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.id);
          e.stopPropagation();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const pos = relativeY < rect.height / 2 ? "before" : "after";
          if (dragOverPosition !== pos) {
            setDragOverPosition(pos);
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setDragOverPosition(null);
        }}
        onDrop={(e) => {
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId && draggedId !== node.id) {
            const rect = e.currentTarget.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const pos = relativeY < rect.height / 2 ? "before" : "after";
            onMoveNode && onMoveNode(draggedId, node.id, pos);
          }
          setDragOverPosition(null);
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={() => !isRenaming && onSelect(node)}
        className={cn(
          "group flex items-center gap-2 py-1.5 pr-2 rounded-md cursor-pointer transition-all duration-150 text-sm relative border border-transparent",
          "hover:pr-8 data-[menu-open=true]:pr-8",
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-white/5 text-muted-foreground hover:text-white",
        )}
        style={{ paddingLeft: paddingLeft + 22 }}
        data-menu-open={isMenuOpen}
      >
        {/* Drop Indicators */}
        {dragOverPosition === "before" && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-20 pointer-events-none">
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-primary" />
          </div>
        )}
        {dragOverPosition === "after" && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-20 pointer-events-none">
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-primary" />
          </div>
        )}

        <MethodBadge method={node.method} />
        
        {isRenaming ? (
          <input
            type="text"
            value={renameVal}
            ref={(el) => {
              if (el) {
                el.focus();
                el.select();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (renameVal.trim() && onRenameNode) {
                  onRenameNode(node.id, renameVal.trim());
                }
                setIsRenaming(false);
              } else if (e.key === "Escape") {
                setIsRenaming(false);
              }
            }}
            onBlur={() => {
              if (renameVal.trim() && onRenameNode) {
                onRenameNode(node.id, renameVal.trim());
              }
              setIsRenaming(false);
            }}
            className="h-5 bg-input border border-primary/45 text-xs px-1.5 rounded focus:outline-none focus:ring-1 focus:ring-primary w-[110px] font-medium text-foreground text-left"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-left">{node.name}</span>
        )}

        {!isRenaming && (
          <div
            className={cn(
              "absolute right-1.5 opacity-0 group-hover:opacity-100 flex items-center shrink-0 z-10 transition-opacity",
              isMenuOpen && "opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10"
                  title="Actions"
                >
                  <MoreHorizontal size={13} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border text-foreground w-[180px] z-50 p-1">
                <DropdownMenuItem
                  onClick={() => {
                    setRenameVal(node.name);
                    setIsRenaming(true);
                  }}
                  className="text-xs py-2 px-3 cursor-pointer flex items-center gap-2 font-medium"
                >
                  <Edit2 size={12} className="text-muted-foreground" />
                  Rename
                </DropdownMenuItem>

                {onCopyNode && (
                  <DropdownMenuItem
                    onClick={() => onCopyNode(node)}
                    className="text-xs py-2 px-3 cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    Copy URL
                  </DropdownMenuItem>
                )}

                {onDuplicateNode && (
                  <DropdownMenuItem
                    onClick={() => onDuplicateNode(node.id)}
                    className="text-xs py-2 px-3 cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground"
                    >
                      <rect width="14" height="14" x="4" y="4" rx="2" />
                      <rect width="14" height="14" x="9" y="9" rx="2" />
                    </svg>
                    Duplicate
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem
                  onClick={() => onDeleteNode && onDeleteNode(node.id)}
                  className="text-xs py-2 px-3 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 flex items-center gap-2 font-medium"
                >
                  <Trash size={12} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  }

  // It's a folder
  return (
    <div className="group/node relative">
      <div
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.id);
          e.stopPropagation();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          let pos: "before" | "after" | "inside" = "inside";
          if (relativeY < 6) {
            pos = "before";
          } else if (relativeY > rect.height - 6) {
            pos = "after";
          } else {
            pos = "inside";
          }
          if (dragOverPosition !== pos) {
            setDragOverPosition(pos);
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setDragOverPosition(null);
        }}
        onDrop={(e) => {
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId && draggedId !== node.id) {
            const rect = e.currentTarget.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            let pos: "before" | "after" | "inside" = "inside";
            if (relativeY < 6) {
              pos = "before";
            } else if (relativeY > rect.height - 6) {
              pos = "after";
            } else {
              pos = "inside";
            }
            onMoveNode && onMoveNode(draggedId, node.id, pos);
          }
          setDragOverPosition(null);
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={() => {
          if (!isRenaming) {
            if (onToggleFolderExpanded) {
              onToggleFolderExpanded(node.id, !isOpen);
            } else {
              setLocalIsOpen(!localIsOpen);
            }
          }
        }}
        className={cn(
          "group flex items-center gap-2 py-1.5 pr-2 text-sm text-foreground/80 hover:bg-white/5 rounded-md cursor-pointer select-none relative border border-transparent transition-all duration-150",
          "hover:pr-8 data-[menu-open=true]:pr-8",
          dragOverPosition === "inside" && "bg-primary/10 border-primary/20 text-foreground"
        )}
        style={{ paddingLeft }}
        data-menu-open={isMenuOpen}
      >
        {/* Drop Indicators */}
        {dragOverPosition === "before" && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-20 pointer-events-none">
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-primary" />
          </div>
        )}
        {dragOverPosition === "after" && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-20 pointer-events-none">
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-primary" />
          </div>
        )}

        {isOpen ? (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground shrink-0" />
        )}
        <Folder
          size={14}
          className={cn("text-blue-400/80 shrink-0", isOpen && "text-blue-400")}
        />

        {isRenaming ? (
          <input
            type="text"
            value={renameVal}
            ref={(el) => {
              if (el) {
                el.focus();
                el.select();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (renameVal.trim() && onRenameNode) {
                  onRenameNode(node.id, renameVal.trim());
                }
                setIsRenaming(false);
              } else if (e.key === "Escape") {
                setIsRenaming(false);
              }
            }}
            onBlur={() => {
              if (renameVal.trim() && onRenameNode) {
                onRenameNode(node.id, renameVal.trim());
              }
              setIsRenaming(false);
            }}
            className="h-5 bg-input border border-primary/45 text-xs px-1.5 rounded focus:outline-none focus:ring-1 focus:ring-primary w-[110px] font-medium text-foreground text-left"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-left font-medium">{node.name}</span>
        )}

        {!isRenaming && (
          <div
            className={cn(
              "absolute right-1.5 opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 z-10 transition-opacity",
              isMenuOpen && "opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (onToggleFolderExpanded) {
                  onToggleFolderExpanded(node.id, true);
                } else {
                  setLocalIsOpen(true);
                }
                onAddRequest && onAddRequest(node.id);
              }}
              className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10"
              title="Add request inside folder"
            >
              <Plus size={13} />
            </button>
            <DropdownMenu onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10"
                  title="Actions"
                >
                  <MoreHorizontal size={13} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border text-foreground w-[180px] z-50 p-1">
                <DropdownMenuItem
                  onClick={() => {
                    if (onToggleFolderExpanded) {
                      onToggleFolderExpanded(node.id, true);
                    } else {
                      setLocalIsOpen(true);
                    }
                    onAddRequest && onAddRequest(node.id);
                  }}
                  className="text-xs py-2 px-3 cursor-pointer flex items-center gap-2 font-medium"
                >
                  <FileCode size={12} className="text-muted-foreground" />
                  New Request
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (onToggleFolderExpanded) {
                      onToggleFolderExpanded(node.id, true);
                    } else {
                      setLocalIsOpen(true);
                    }
                    onAddFolder && onAddFolder(node.id);
                  }}
                  className="text-xs py-2 px-3 cursor-pointer flex items-center gap-2 font-medium"
                >
                  <Folder className="h-3 w-3 text-muted-foreground" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRenameVal(node.name);
                    setIsRenaming(true);
                  }}
                  className="text-xs py-2 px-3 cursor-pointer flex items-center gap-2 font-medium"
                >
                  <Edit2 size={12} className="text-muted-foreground" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem
                  onClick={() => onDeleteNode && onDeleteNode(node.id)}
                  className="text-xs py-2 px-3 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 flex items-center gap-2 font-medium"
                >
                  <Trash size={12} />
                  Delete Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {isOpen && (
        <div className="relative">
          {/* Vertical Hierarchy Indent Guide Line */}
          <div
            className="absolute top-0 bottom-3 w-[1px] bg-white/[0.03] group-hover/sidebar:bg-white/[0.08] group-hover/node:!bg-white/20 pointer-events-none transition-colors duration-150"
            style={{ left: `${level * 20 + 15}px` }}
          />
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
              onRenameNode={onRenameNode}
              onDeleteNode={onDeleteNode}
              onAddFolder={onAddFolder}
              onAddRequest={onAddRequest}
              onMoveNode={onMoveNode}
              expandedFolderIds={expandedFolderIds}
              onToggleFolderExpanded={onToggleFolderExpanded}
              newlyCreatedNodeId={newlyCreatedNodeId}
              onClearNewlyCreatedNodeId={onClearNewlyCreatedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "text-emerald-500",
    POST: "text-amber-500",
    PUT: "text-blue-500",
    DELETE: "text-rose-500",
    PATCH: "text-purple-500",
    ALL: "text-gray-500",
  };

  return (
    <span
      className={cn(
        "text-[10px] font-bold w-8 shrink-0 text-left",
        colors[method] || "text-gray-400",
      )}
    >
      {method}
    </span>
  );
}
