import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiFolder, ApiRoute, isRoute } from "../../../types";

type SidebarProps = {
  tree: ApiFolder[];
  selectedKey?: string;
  onSelect: (route: ApiRoute) => void;
};

const toRouteKey = (route: Pick<ApiRoute, "method" | "path">) => {
  return `${String(route.method).toUpperCase()}:${route.path}`;
};

export function Sidebar({ tree, selectedKey, onSelect }: SidebarProps) {
  return (
    <div className="p-2 space-y-0.5">
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

type TreeNodeProps = {
  node: ApiFolder | ApiRoute;
  level: number;
  selectedKey?: string;
  onSelect: (route: ApiRoute) => void;
};

function TreeNode({ node, level, selectedKey, onSelect }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const paddingLeft = level * 12 + 8; // Indent

  if (isRoute(node)) {
    const isSelected = selectedKey === toRouteKey(node);
    return (
      <div
        onClick={() => onSelect(node)}
        className={cn(
          "group flex items-center gap-2 py-1.5 pr-2 rounded-md cursor-pointer transition-colors text-sm",
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover:bg-white/5 text-muted-foreground hover:text-white",
        )}
        style={{ paddingLeft }}
      >
        <MethodBadge method={node.method} />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  // It's a folder
  return (
    <div>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 py-1.5 pr-2 text-sm text-foreground/80 hover:bg-white/5 rounded-md cursor-pointer select-none"
        style={{ paddingLeft }}
      >
        {isOpen ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
        <Folder
          size={14}
          className={cn("text-blue-400/80", isOpen && "text-blue-400")}
        />
        <span className="truncate font-medium">{node.name}</span>
      </div>
      {isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "text-blue-400",
    POST: "text-yellow-400",
    PUT: "text-orange-400",
    DELETE: "text-red-400",
    PATCH: "text-purple-400",
    ALL: "text-gray-400",
  };

  return (
    <span
      className={cn(
        "text-[10px] font-bold w-8 shrink-0",
        colors[method] || "text-gray-400",
      )}
    >
      {method}
    </span>
  );
}
