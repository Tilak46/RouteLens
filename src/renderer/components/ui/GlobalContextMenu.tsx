import React, { useEffect, useState, useRef, useCallback } from "react";
import { RotateCw, Code2 } from "lucide-react";

interface ContextMenuPosition {
  x: number;
  y: number;
}

export const GlobalContextMenu: React.FC = () => {
  const [position, setPosition] = useState<ContextMenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    // Don't override if user is right-clicking on editable input or CodeMirror editor where standard context menus are preferred
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.closest(".cm-editor") ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    e.preventDefault();

    const menuWidth = 160;
    const menuHeight = 84;
    const padding = 10;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }

    setPosition({ x, y });
  }, []);

  const closeMenu = useCallback(() => {
    setPosition(null);
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("mousedown", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("mousedown", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [handleContextMenu, closeMenu]);

  if (!position) return null;

  const handleRefresh = () => {
    closeMenu();
    if (window.api?.reloadWindow) {
      window.api.reloadWindow();
    } else {
      window.location.reload();
    }
  };

  const handleInspect = () => {
    const { x, y } = position;
    closeMenu();
    if (window.api?.inspectElement) {
      window.api.inspectElement(x, y);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className="fixed z-[999999] min-w-[155px] bg-[#141416]/95 backdrop-blur-md rounded-lg p-1 text-xs select-none border border-white/[0.08] animate-in fade-in-0 zoom-in-95 duration-100 ease-out"
    >
      <button
        onClick={handleRefresh}
        className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md text-foreground/85 hover:text-foreground hover:bg-white/[0.07] transition-colors cursor-pointer text-left group"
      >
        <div className="flex items-center gap-2">
          <RotateCw size={13} className="text-muted-foreground/70 group-hover:text-foreground transition-colors" />
          <span>Refresh</span>
        </div>
        <kbd className="font-mono text-[10px] text-muted-foreground/50">Ctrl+R</kbd>
      </button>

      <button
        onClick={handleInspect}
        className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md text-foreground/85 hover:text-foreground hover:bg-white/[0.07] transition-colors cursor-pointer text-left group"
      >
        <div className="flex items-center gap-2">
          <Code2 size={13} className="text-muted-foreground/70 group-hover:text-foreground transition-colors" />
          <span>Inspect</span>
        </div>
        <kbd className="font-mono text-[10px] text-muted-foreground/50">F12</kbd>
      </button>
    </div>
  );
};
