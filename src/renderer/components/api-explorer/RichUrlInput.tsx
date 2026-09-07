import React, { useState, useRef, useEffect, useMemo } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ApiVariable } from "../../types/environments";
import { ScopedVariable } from "@/lib/interpolationEngine";
import { cn } from "@/lib/utils";

type RichUrlInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  activeVariables?: (ApiVariable | ScopedVariable)[];
  activeEnvName?: string;
  onAddOrUpdateVariable?: (key: string, value: string, scope?: "global" | "environment") => void;
  className?: string;
  onSubmit?: () => void;
  borderless?: boolean;
  pathVariables?: any[];
};

type VariableBadgeProps = {
  tokenKey: string;
  isDeclared: boolean;
  currentValue: string;
  activeEnvName?: string;
  onAddOrUpdateVariable?: (key: string, value: string) => void;
  onFocusInput?: () => void;
};

function VariableBadge({
  tokenKey,
  isDeclared,
  currentValue,
  activeEnvName,
  onAddOrUpdateVariable,
  onFocusInput,
}: VariableBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState(currentValue);
  const [isFocused, setIsFocused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync editValue when currentValue changes externally
  useEffect(() => {
    setEditValue(currentValue);
  }, [currentValue]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (isFocused) return; // Keep open if editing
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleSave = () => {
    if (editValue.trim() !== currentValue) {
      onAddOrUpdateVariable?.(tokenKey, editValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
      setIsOpen(false);
      setIsFocused(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseDown={(e) => {
            e.preventDefault();
            onFocusInput?.();
          }}
          className={cn(
            "px-1 -mx-1 rounded-[3px] font-mono text-xs font-semibold cursor-pointer pointer-events-auto transition-all select-all",
            isDeclared
              ? "text-sky-400 bg-sky-500/10 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)] hover:bg-sky-500/20"
              : "text-rose-400 bg-rose-500/10 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.3)] hover:bg-rose-500/20"
          )}
        >
          {`{{${tokenKey}}}`}
        </span>
      </PopoverTrigger>
      <PopoverContent
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        side="bottom"
        align="start"
        className="w-64 bg-[#1e1e24] border border-[#2d2d34] text-foreground p-3 rounded-lg shadow-xl z-50 focus:outline-none"
      >
        <div className="space-y-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              handleSave();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter value"
            className="h-8 bg-[#141418] border-[#373742] text-xs text-foreground focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
            autoFocus
          />
          
          <div className="border-t border-[#2d2d34] my-2" />
          
          <div className="flex items-center justify-between text-[10px] text-muted-foreground select-none">
            <div className="flex items-center">
              <span className="w-3.5 h-3.5 bg-amber-500 text-black font-extrabold flex items-center justify-center rounded-[3px] mr-1 text-[9px]">
                E
              </span>
              <span className="truncate max-w-[120px] font-medium">
                {activeEnvName || "No active env"}
              </span>
            </div>
            <span className="font-semibold text-primary/80">Variables in request →</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RichUrlInput({
  value,
  onChange,
  placeholder,
  activeVariables = [],
  activeEnvName,
  onAddOrUpdateVariable,
  className,
  onSubmit,
  borderless = false,
  pathVariables = [],
}: RichUrlInputProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Suggestions state
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(-1); // Starting index of "{{"
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);

  // Sync scrollLeft from input to overlay
  const handleScroll = () => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    handleScroll();
  }, [value]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  // Filter variables matching suggestionQuery
  const filteredVariables = useMemo(() => {
    if (!suggestionOpen) return [];
    // Only suggest variables that actually have a valid key
    const enabledVars = activeVariables.filter((v) => v.key && v.enabled);
    if (!suggestionQuery) return enabledVars;
    return enabledVars.filter((v) =>
      v.key.toLowerCase().includes(suggestionQuery.toLowerCase())
    );
  }, [activeVariables, suggestionOpen, suggestionQuery]);

  // Position suggestion box under the cursor
  const suggestionLeft = useMemo(() => {
    if (!inputRef.current || suggestionIndex === -1) return 12;
    const charWidth = 7.22; // Monospace character width
    const scrollLeft = inputRef.current.scrollLeft;
    const offset = suggestionIndex * charWidth + 12 - scrollLeft;
    const containerWidth = inputRef.current.clientWidth || 300;
    // Clamp suggestion box inside URL bar container boundaries (width 260px)
    return Math.max(8, Math.min(offset, containerWidth - 270));
  }, [suggestionIndex, value, suggestionOpen]);

  // Check cursor position to trigger suggestion list
  const checkSuggestions = (text: string, selectionStart: number | null) => {
    if (selectionStart === null) {
      setSuggestionOpen(false);
      return;
    }

    const textBeforeCursor = text.substring(0, selectionStart);
    const lastDoubleBrace = textBeforeCursor.lastIndexOf("{{");

    if (lastDoubleBrace !== -1) {
      const closingBrace = textBeforeCursor.indexOf("}}", lastDoubleBrace);
      if (closingBrace === -1 || closingBrace >= selectionStart) {
        // Cursor is inside active {{ token builder
        const query = textBeforeCursor.substring(lastDoubleBrace + 2);
        setSuggestionOpen(true);
        setSuggestionQuery(query);
        setSuggestionIndex(lastDoubleBrace);
        setActiveSuggestionIdx((prev) =>
          prev >= filteredVariables.length ? 0 : prev
        );
        return;
      }
    }
    setSuggestionOpen(false);
  };

  // Insert selected auto-completion item
  const selectSuggestion = (key: string) => {
    if (suggestionIndex === -1 || !inputRef.current) return;
    const before = value.substring(0, suggestionIndex);
    const after = value.substring(inputRef.current.selectionStart || 0);
    const completedToken = `{{${key}}}`;
    const newValue = before + completedToken + after;

    onChange(newValue);
    setSuggestionOpen(false);

    // Reposition cursor immediately after completed closing braces
    const nextCursorPos = suggestionIndex + completedToken.length;
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestionOpen && filteredVariables.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev + 1) % filteredVariables.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestionIdx(
          (prev) => (prev - 1 + filteredVariables.length) % filteredVariables.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectSuggestion(filteredVariables[activeSuggestionIdx].key);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestionOpen(false);
        return;
      }
    } else {
      if (e.key === "Enter") {
        onSubmit?.();
      }
    }
  };

  // Tokenize the URL value for highlighting
  const parts = useMemo(() => {
    if (!value) return [];
    const regex = /(\{\{[^}]+\}\})|((?<=\/):[a-zA-Z0-9_-]+)/g;
    const result: { text: string; isToken: boolean; key?: string; isPathVar?: boolean }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          text: value.substring(lastIndex, match.index),
          isToken: false,
        });
      }

      const tokenText = match[0];
      if (tokenText.startsWith("{{")) {
        result.push({
          text: tokenText,
          isToken: true,
          key: tokenText.slice(2, -2),
        });
      } else {
        result.push({
          text: tokenText,
          isToken: true,
          key: tokenText.slice(1),
          isPathVar: true,
        });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < value.length) {
      result.push({
        text: value.substring(lastIndex),
        isToken: false,
      });
    }

    return result;
  }, [value]);

  return (
    <div
      className={cn(
        borderless
          ? "flex-grow relative h-full w-full overflow-visible"
          : "flex-grow bg-input rounded border border-border relative h-[34px] overflow-visible transition-all",
        !borderless && focused && "ring-1 ring-primary/40 border-primary/40",
        className
      )}
    >
      {/* Scroll-synced rendering overlay (placed on top for hover pointer events) */}
      <div
        ref={overlayRef}
        className="absolute inset-0 px-3 py-2 text-xs font-mono whitespace-pre overflow-hidden flex items-center pointer-events-none z-20"
        style={{ scrollbarWidth: "none" }}
      >
        {parts.length === 0 ? (
          <span className="text-muted-foreground/40 font-mono text-xs">
            {placeholder}
          </span>
        ) : (
          parts.map((part, index) => {
            if (part.isToken && part.key) {
              if (part.isPathVar) {
                const pv = pathVariables.find((p) => p.key === part.key);
                const hasValue = !!(pv && pv.value && pv.value.trim() !== "");
                return (
                  <span
                    key={index}
                    className={cn(
                      "px-1 mx-0.5 rounded-[3px] font-mono text-xs font-bold transition-all select-none select-all",
                      hasValue
                        ? "text-sky-400 bg-sky-500/10 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]"
                        : "text-rose-400 bg-rose-500/10 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.45)]"
                    )}
                    title={hasValue ? `Path Parameter: ${part.key} = ${pv.value}` : `Path Parameter: ${part.key} (Empty)`}
                  >
                    {part.text}
                  </span>
                );
              }
              const variable = activeVariables.find(
                (v) => v.key === part.key && v.enabled
              );
              return (
                <VariableBadge
                  key={index}
                  tokenKey={part.key}
                  isDeclared={!!variable}
                  currentValue={variable ? variable.value : ""}
                  activeEnvName={activeEnvName}
                  onAddOrUpdateVariable={onAddOrUpdateVariable}
                  onFocusInput={focusInput}
                />
              );
            }
            return (
              <span key={index} className="text-foreground">
                {part.text}
              </span>
            );
          })
        )}
      </div>

      {/* Actual user-editable text input overlay (placed below overlay but interactive) */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          checkSuggestions(e.target.value, e.target.selectionStart);
        }}
        onClick={(e) => {
          checkSuggestions(e.currentTarget.value, e.currentTarget.selectionStart);
        }}
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            checkSuggestions(e.currentTarget.value, e.currentTarget.selectionStart);
          }
        }}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          // Small delay to allow click event on suggestion dropdown items to trigger first
          setTimeout(() => setSuggestionOpen(false), 200);
        }}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full bg-transparent px-3 py-2 text-xs font-mono text-transparent focus:outline-none z-10"
        style={{ caretColor: "white" }}
      />

      {/* Autocomplete Suggestion Dropdown */}
      {suggestionOpen && filteredVariables.length > 0 && (
        <div
          className="absolute bg-[#1e1e24] border border-[#2d2d34] text-foreground rounded-lg shadow-2xl z-50 overflow-hidden w-64 max-h-52 overflow-y-auto p-1"
          style={{
            top: borderless ? "32px" : "38px",
            left: `${suggestionLeft}px`,
          }}
        >
          {filteredVariables.map((variable, idx) => {
            const isActive = idx === activeSuggestionIdx;
            return (
              <div
                key={variable.id}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  selectSuggestion(variable.key);
                }}
                className={cn(
                  "flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md cursor-pointer text-xs font-mono transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary border border-primary/20"
                    : "text-foreground hover:bg-white/5 border border-transparent"
                )}
              >
                <div className="flex items-center">
                  <span
                    className={cn(
                      "w-3.5 h-3.5 font-extrabold flex items-center justify-center border rounded-[3px] mr-1.5 text-[9px] select-none",
                      (variable as any).source === "global"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    )}
                    title={(variable as any).sourceName || "Variable"}
                  >
                    {(variable as any).source === "global" ? "G" : "E"}
                  </span>
                  <span className="font-semibold text-foreground truncate">{variable.key}</span>
                </div>
                {(variable.currentValue || variable.value) && (
                  <span className="text-[10px] text-muted-foreground truncate pl-5">
                    {(variable as any).type === "secret"
                      ? "••••••••"
                      : variable.currentValue || variable.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
