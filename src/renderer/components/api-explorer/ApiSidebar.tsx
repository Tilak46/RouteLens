import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode, Edit2, Trash, MoreHorizontal, Plus, Home, X } from "lucide-react";
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
  rootProjectName?: string;
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
  onCloseProject?: () => void;
  onRemoveProject?: () => void;
};

import { toRouteKey } from "@/views/ApiExplorerView";

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
  rootProjectName,
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
  onCloseProject,
  onRemoveProject,
}: SidebarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [treePaths, setTreePaths] = useState<{ id: string; d: string }[]>([]);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [deleteConfirmNode, setDeleteConfirmNode] = useState<{ id: string; name: string; isFolder: boolean } | null>(null);

  const updatePaths = useCallback(() => {
    if (!containerRef.current) return;
    const computed = computeTreePaths(
      containerRef.current,
      tree,
      rootProjectName,
      expandedFolderIds
    );
    setTreePaths(computed);
  }, [tree, rootProjectName, expandedFolderIds]);

  useLayoutEffect(() => {
    updatePaths();
  }, [updatePaths]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      updatePaths();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updatePaths]);

  const renderedTree = tree.map((node) => (
    <TreeNode
      key={node.id}
      node={node}
      level={rootProjectName ? 1 : 0}
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
  ));

  return (
    <div
      ref={containerRef}
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
      onDragEnd={() => {
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
        "p-1 space-y-0.5 transition-all duration-200 border border-transparent rounded-lg relative group/sidebar min-h-full",
        isDragOverRoot && "border-dashed border-primary/40 bg-primary/5"
      )}
    >
      {/* Master Unified SVG Tree Overlay - One Single Piece */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
        {treePaths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="text-white/[0.08]"
          />
        ))}
      </svg>

      {rootProjectName ? (
        <div className="space-y-0.5">
          {/* Permanent Non-collapsible Root Project Folder */}
          <div
            data-tree-id="__root__"
            className="group flex items-center justify-between py-1 text-[12px] text-foreground/90 font-medium rounded-md select-none hover:bg-white/[0.03] transition-colors relative"
            style={{ paddingLeft: 2 }}
            title={`Root: ${rootProjectName}`}
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <svg
                data-tree-lead="root-icon"
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground/90 shrink-0"
              >
                <path d="M2.5 5.5V3.8C2.5 2.8 3.3 2 4.3 2H6.2C6.7 2 7.1 2.2 7.4 2.6L8.2 3.6C8.5 4 8.9 4.2 9.4 4.2H11.7C12.7 4.2 13.5 5 13.5 6V6.5" />
                <path d="M2.4 6.8H13.6C14.3 6.8 14.8 7.3 14.7 8L13.8 12.6C13.6 13.4 12.9 14 12.1 14H3.9C3.1 14 2.4 13.4 2.2 12.6L1.3 8C1.2 7.3 1.7 6.8 2.4 6.8Z" />
              </svg>
              <span className="truncate">{rootProjectName}</span>
            </div>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
              {onAddRequest && (
                <button
                  onClick={() => onAddRequest(null as any)}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Add request to root"
                >
                  <Plus size={13} />
                </button>
              )}
              {onCloseProject && (
                <button
                  onClick={onCloseProject}
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close backend (return to Home)"
                >
                  <X size={13} />
                </button>
              )}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10 transition-colors cursor-pointer"
                    title="Root Options"
                  >
                    <MoreHorizontal size={13} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#121214] border border-white/[0.08] text-foreground w-[180px] shadow-2xl rounded-lg z-50 p-1">
                  {onAddRequest && (
                    <DropdownMenuItem
                      onClick={() => onAddRequest(null as any)}
                      className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
                    >
                      <FileCode size={12} className="text-muted-foreground" />
                      New Request
                    </DropdownMenuItem>
                  )}
                  {onAddFolder && (
                    <DropdownMenuItem
                      onClick={() => onAddFolder(null as any)}
                      className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
                    >
                      <Folder size={12} className="text-muted-foreground" />
                      New Folder
                    </DropdownMenuItem>
                  )}
                  {(onCloseProject || onRemoveProject) && (
                    <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
                  )}
                  {onCloseProject && (
                    <DropdownMenuItem
                      onClick={onCloseProject}
                      className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
                    >
                      <Home size={12} className="text-muted-foreground" />
                      Close Backend (Home)
                    </DropdownMenuItem>
                  )}
                  {onRemoveProject && (
                    <DropdownMenuItem
                      onClick={onRemoveProject}
                      className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-300 transition-colors"
                    >
                      <Trash size={12} className="text-rose-400" />
                      Remove from Workspace
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Root Children */}
          <div className="relative">
            {renderedTree}
          </div>
        </div>
      ) : (
        renderedTree
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deleteConfirmNode !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmNode(null);
        }}
      >
        <AlertDialogContent className="bg-[#121214] border border-white/[0.08] text-foreground w-[90%] max-w-[380px] shadow-2xl rounded-xl p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground text-sm font-semibold">
              Delete {deleteConfirmNode?.isFolder ? "Folder" : "Request"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-[11.5px] leading-relaxed">
              Are you sure you want to delete{" "}
              <strong className="text-foreground font-medium">
                "{deleteConfirmNode?.name}"
              </strong>
              {deleteConfirmNode?.isFolder
                ? " and all of its contents? This will permanently delete everything inside it."
                : "? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
            <AlertDialogCancel className="bg-transparent border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/5 text-[11.5px] h-8 rounded-md">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmNode && onDeleteNode) {
                  onDeleteNode(deleteConfirmNode.id);
                }
                setDeleteConfirmNode(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-[11.5px] font-medium h-8 rounded-md"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const TREE_INDENT = 16;
const TREE_INDENT_OFFSET = 8.5;

function computeTreePaths(
  container: HTMLElement,
  tree: (ApiFolder | ApiRoute)[],
  rootProjectName?: string,
  expandedFolderIds: string[] = []
): { id: string; d: string }[] {
  const containerRect = container.getBoundingClientRect();
  const elements = container.querySelectorAll<HTMLElement>("[data-tree-id]");
  const elementMap = new Map<string, HTMLElement>();
  elements.forEach((el) => {
    const id = el.dataset.treeId;
    if (id) elementMap.set(id, el);
  });

  const getNodePos = (id: string) => {
    const el = elementMap.get(id);
    if (!el) return null;
    const elRect = el.getBoundingClientRect();

    const leadEl = el.querySelector<HTMLElement>("[data-tree-lead]");
    const leadRect = leadEl ? leadEl.getBoundingClientRect() : elRect;

    // Trunk X: exact horizontal center of the parent's leading icon/chevron relative to container
    const trunkX = Math.round((leadRect.left - containerRect.left + leadRect.width / 2) * 2) / 2;

    // Start Y: right below the icon/chevron (1px clearance)
    const startY = Math.round(leadRect.bottom - containerRect.top + 1);

    // Row vertical center for horizontal branch landing
    const y = Math.round(elRect.top - containerRect.top + elRect.height / 2);

    // Branch Target X: leading edge of the child's icon/badge (2px breathing gap)
    const branchTargetX = Math.round(leadRect.left - containerRect.left - 2);

    return { trunkX, startY, y, branchTargetX };
  };

  const R = 7;
  const paths: { id: string; d: string }[] = [];

  const buildBranchPath = (parentId: string, children: (ApiFolder | ApiRoute)[]) => {
    const parentPos = getNodePos(parentId);
    if (!parentPos) return null;

    const validChildren: { trunkX: number; startY: number; y: number; branchTargetX: number }[] = [];
    for (const child of children) {
      const pos = getNodePos(child.id);
      if (pos) validChildren.push(pos);
    }

    if (validChildren.length === 0) return null;

    const trunkX = parentPos.trunkX;
    const startY = parentPos.startY;
    const lastChild = validChildren[validChildren.length - 1];

    const maxR_last = Math.min(
      R,
      Math.max(2, lastChild.branchTargetX - trunkX),
      Math.max(2, (lastChild.y - startY) / 2)
    );

    // Continuous trunk running straight from start down to last child with smooth curve termination
    let d = `M ${trunkX} ${startY} L ${trunkX} ${lastChild.y - maxR_last} Q ${trunkX} ${lastChild.y} ${trunkX + maxR_last} ${lastChild.y} L ${lastChild.branchTargetX} ${lastChild.y} `;

    // Seamless curved branches for each intermediate child branching off the vertical trunk
    for (let i = 0; i < validChildren.length - 1; i++) {
      const c = validChildren[i];
      const branchR = Math.min(
        R,
        Math.max(2, c.branchTargetX - trunkX),
        Math.max(2, (c.y - startY) / 2)
      );
      d += `M ${trunkX} ${c.y - branchR} Q ${trunkX} ${c.y} ${trunkX + branchR} ${c.y} L ${c.branchTargetX} ${c.y} `;
    }

    return d;
  };

  // 1. Root project connection
  if (rootProjectName && tree.length > 0) {
    const d = buildBranchPath("__root__", tree);
    if (d) {
      paths.push({ id: "__root__", d });
    }
  }

  // 2. Recursive traversal for open folders
  const traverse = (nodes: (ApiFolder | ApiRoute)[]) => {
    for (const node of nodes) {
      if (!isRoute(node) && Array.isArray(node.children)) {
        const isOpen = expandedFolderIds.includes(node.id);
        if (isOpen && node.children.length > 0) {
          const d = buildBranchPath(node.id, node.children);
          if (d) {
            paths.push({ id: node.id, d });
          }
          traverse(node.children);
        }
      }
    }
  };

  traverse(tree);

  return paths;
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

export function TreeNode({
  node,
  level = 0,
  selectedKey,
  onSelect,
  onRenameNode,
  onDeleteNode,
  onMoveNode,
  onAddFolder,
  onAddRequest,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const isEscapePressedRef = useRef(false);

  useEffect(() => {
    if (newlyCreatedNodeId === node.id) {
      setRenameVal(node.name);
      setIsRenaming(true);
      onClearNewlyCreatedNodeId?.();
    }
  }, [newlyCreatedNodeId, node.id]);

  useEffect(() => {
    if (!isRenaming) {
      setRenameVal(node.name);
    }
  }, [node.name, isRenaming]);

  useEffect(() => {
    if (isRenaming) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isRenaming]);
  
  const paddingLeft = level * TREE_INDENT + 2;

  if (isRoute(node)) {
    const isSelected = selectedKey === node.id || selectedKey === toRouteKey(node);
    return (
      <div
        data-tree-id={node.id}
        draggable={!isRenaming}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.id);
          e.dataTransfer.effectAllowed = "move";
          e.stopPropagation();
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          setDragOverPosition(null);
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
          "group flex items-center gap-1.5 py-1 pr-2 rounded-md cursor-pointer transition-all duration-150 text-[12px] relative border border-transparent",
          "hover:pr-8 data-[menu-open=true]:pr-8",
          isSelected
            ? "bg-white/[0.08] text-foreground font-medium"
            : "hover:bg-white/[0.04] text-muted-foreground/80 hover:text-foreground",
        )}
        style={{ paddingLeft: paddingLeft + 2 }}
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
            ref={inputRef}
            type="text"
            value={renameVal}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                if (renameVal.trim() && onRenameNode) {
                  onRenameNode(node.id, renameVal.trim());
                }
                setIsRenaming(false);
              } else if (e.key === "Escape") {
                isEscapePressedRef.current = true;
                setRenameVal(node.name);
                setIsRenaming(false);
              }
            }}
            onBlur={() => {
              if (isEscapePressedRef.current) {
                isEscapePressedRef.current = false;
                setRenameVal(node.name);
                setIsRenaming(false);
                return;
              }
              if (renameVal.trim() && onRenameNode) {
                onRenameNode(node.id, renameVal.trim());
              }
              setIsRenaming(false);
            }}
            className="h-5.5 bg-black/40 border border-primary/50 text-[11.5px] px-1.5 rounded focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-[120px] max-w-[220px] font-normal text-foreground text-left"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-left" title={node.name}>
            {node.name}
          </span>
        )}

        {node.isStale && !isRenaming && (
          <span
            className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 ml-1"
            title="This endpoint was not detected in the latest codebase scan, but your saved request data is preserved."
          >
            unlinked
          </span>
        )}

        {!node.id.startsWith("request_") && !node.isStale && !isRenaming && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0 ml-2 mr-1.5 transition-opacity duration-200 group-hover:opacity-0 opacity-60",
              node.confidence === "low"
                ? "bg-rose-500"
                : node.confidence === "medium"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            )}
            title={`Scanner Confidence: ${node.confidence === "low" ? "Low (Manual Verification)" : node.confidence === "medium" ? "Medium" : "High (100% Correct)"}`}
          />
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
            <DropdownMenu modal={false} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10"
                  title="Actions"
                >
                  <MoreHorizontal size={13} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#121214] border border-white/[0.08] text-foreground w-[170px] shadow-2xl rounded-lg z-50 p-1">
                <DropdownMenuItem
                  onClick={() => {
                    setRenameVal(node.name);
                    setIsRenaming(true);
                  }}
                  className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
                >
                  <Edit2 size={12} className="text-muted-foreground" />
                  Rename
                </DropdownMenuItem>

                {onCopyNode && (
                  <DropdownMenuItem
                    onClick={() => onCopyNode(node)}
                    className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
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
                    className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
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

                <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
                <DropdownMenuItem
                  onClick={() => onDeleteNode && onDeleteNode(node.id)}
                  className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 focus:text-rose-400 focus:bg-rose-500/10 flex items-center gap-2 font-normal transition-colors"
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
        data-tree-id={node.id}
        draggable={!isRenaming}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.id);
          e.dataTransfer.effectAllowed = "move";
          e.stopPropagation();
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          setDragOverPosition(null);
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
          "group flex items-center gap-1.5 py-1 pr-2 text-[12px] text-foreground/75 hover:text-foreground hover:bg-white/[0.04] rounded-md cursor-pointer select-none relative border border-transparent transition-all duration-150",
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
          <ChevronDown data-tree-lead="chevron" size={13} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight data-tree-lead="chevron" size={13} className="text-muted-foreground shrink-0" />
        )}
        {isOpen ? (
          /* Open Folder Outline - Smooth rounded corners */
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground/80 group-hover:text-foreground shrink-0 transition-colors"
          >
            {/* Back tab with rounded corners */}
            <path d="M2.5 5.5V3.8C2.5 2.8 3.3 2 4.3 2H6.2C6.7 2 7.1 2.2 7.4 2.6L8.2 3.6C8.5 4 8.9 4.2 9.4 4.2H11.7C12.7 4.2 13.5 5 13.5 6V6.5" />
            {/* Open front pocket with rounded corners */}
            <path d="M2.4 6.8H13.6C14.3 6.8 14.8 7.3 14.7 8L13.8 12.6C13.6 13.4 12.9 14 12.1 14H3.9C3.1 14 2.4 13.4 2.2 12.6L1.3 8C1.2 7.3 1.7 6.8 2.4 6.8Z" />
          </svg>
        ) : (
          /* Closed Folder Outline - Smooth rounded corners */
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground/80 group-hover:text-foreground shrink-0 transition-colors"
          >
            <path d="M2 4.2C2 3 3 2 4.2 2H6.2C6.7 2 7.2 2.2 7.5 2.6L8.3 3.6C8.6 4 9.1 4.2 9.6 4.2H11.8C13 4.2 14 5.2 14 6.4V11.8C14 13 13 14 11.8 14H4.2C3 14 2 13 2 11.8V4.2Z" />
          </svg>
        )}

        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameVal}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                if (renameVal.trim() && onRenameNode) {
                  onRenameNode(node.id, renameVal.trim());
                }
                setIsRenaming(false);
              } else if (e.key === "Escape") {
                isEscapePressedRef.current = true;
                setRenameVal(node.name);
                setIsRenaming(false);
              }
            }}
            onBlur={() => {
              if (isEscapePressedRef.current) {
                isEscapePressedRef.current = false;
                setRenameVal(node.name);
                setIsRenaming(false);
                return;
              }
              if (renameVal.trim() && onRenameNode) {
                onRenameNode(node.id, renameVal.trim());
              }
              setIsRenaming(false);
            }}
            className="h-5.5 bg-black/40 border border-primary/50 text-[11.5px] px-1.5 rounded focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-[120px] max-w-[220px] font-normal text-foreground text-left"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-left font-normal">{node.name}</span>
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
              className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10 transition-colors cursor-pointer"
              title="Add request inside folder"
            >
              <Plus size={13} />
            </button>
            <DropdownMenu modal={false} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Actions"
                >
                  <MoreHorizontal size={13} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#121214] border border-white/[0.08] text-foreground w-[170px] shadow-2xl rounded-lg z-50 p-1">
                <DropdownMenuItem
                  onClick={() => {
                    if (onToggleFolderExpanded) {
                      onToggleFolderExpanded(node.id, true);
                    } else {
                      setLocalIsOpen(true);
                    }
                    onAddRequest && onAddRequest(node.id);
                  }}
                  className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
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
                  className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
                >
                  <Folder className="h-3 w-3 text-muted-foreground" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRenameVal(node.name);
                    setIsRenaming(true);
                  }}
                  className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer flex items-center gap-2 font-normal text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-foreground transition-colors"
                >
                  <Edit2 size={12} className="text-muted-foreground" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.06] my-1" />
                <DropdownMenuItem
                  onClick={() => onDeleteNode && onDeleteNode(node.id)}
                  className="text-[11.5px] py-1.5 px-2.5 rounded-md cursor-pointer text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 focus:text-rose-400 focus:bg-rose-500/10 flex items-center gap-2 font-normal transition-colors"
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
              onDuplicateNode={onDuplicateNode}
              onCopyNode={onCopyNode}
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
    DEL: "text-rose-500",
    PATCH: "text-purple-500",
    PAT: "text-purple-500",
    OPTIONS: "text-pink-500",
    OPT: "text-pink-500",
    HEAD: "text-emerald-400",
    ALL: "text-gray-400",
  };

  const raw = (method || "").toUpperCase().trim();
  const formatted =
    raw === "DELETE"
      ? "DEL"
      : raw === "PATCH"
        ? "PAT"
        : raw === "OPTIONS"
          ? "OPT"
          : raw.length > 4
            ? raw.slice(0, 3)
            : raw;

  return (
    <span
      data-tree-lead="badge"
      className={cn(
        "text-[9.5px] font-semibold min-w-[26px] shrink-0 text-right tracking-tight inline-block select-none",
        colors[raw] || colors[formatted] || "text-gray-400",
      )}
      title={raw}
    >
      {formatted}
    </span>
  );
}
