import React, { useState, useEffect } from "react";
import {
  Copy,
  X,
  Globe,
  Server,
  ArrowRight,
  Check,
  Plus,
  Layers,
} from "lucide-react";
import {
  ApiEnvironment,
  ApiVariable,
  GLOBALS_ENV_ID,
} from "../../types/environments";
import { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CopyVariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceEnv: ApiEnvironment | null;
  globals: ApiEnvironment;
  backendEnvironments: Record<string, ApiEnvironment[]>;
  projects: Project[];
  onExecuteCopy: (
    targetEnvId: string,
    variablesToCopy: ApiVariable[],
    conflictMode: "merge" | "overwrite"
  ) => void;
  onCreateTargetEnv: (projectId: string | null, name: string) => string;
}

export function CopyVariablesModal({
  isOpen,
  onClose,
  sourceEnv,
  globals,
  backendEnvironments,
  projects,
  onExecuteCopy,
  onCreateTargetEnv,
}: CopyVariablesModalProps) {
  const [selectedVarIds, setSelectedVarIds] = useState<Record<string, boolean>>({});
  const [targetEnvId, setTargetEnvId] = useState<string>("");
  const [conflictMode, setConflictMode] = useState<"merge" | "overwrite">("merge");
  const [isCreatingNewTarget, setIsCreatingNewTarget] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvProjectId, setNewEnvProjectId] = useState<string>("global");

  // Select all variables by default when opened
  useEffect(() => {
    if (isOpen && sourceEnv) {
      const all: Record<string, boolean> = {};
      sourceEnv.variables.forEach((v) => {
        all[v.id] = true;
      });
      setSelectedVarIds(all);
      setIsCreatingNewTarget(false);
      setNewEnvName("");

      // Default target: first available environment that isn't the source
      const allOtherEnvs = [
        ...(sourceEnv.id !== GLOBALS_ENV_ID ? [globals] : []),
        ...Object.values(backendEnvironments)
          .flat()
          .filter((e) => e.id !== sourceEnv.id),
      ];

      if (allOtherEnvs.length > 0) {
        setTargetEnvId(allOtherEnvs[0].id);
      } else {
        setTargetEnvId("__new__");
        setIsCreatingNewTarget(true);
      }
    }
  }, [isOpen, sourceEnv, globals, backendEnvironments]);

  if (!isOpen || !sourceEnv) return null;

  const vars = sourceEnv.variables;
  const selectedCount = Object.values(selectedVarIds).filter(Boolean).length;
  const isAllSelected = vars.length > 0 && selectedCount === vars.length;

  const handleToggleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      vars.forEach((v) => {
        updated[v.id] = true;
      });
    }
    setSelectedVarIds(updated);
  };

  const handleToggleVar = (varId: string) => {
    setSelectedVarIds((prev) => ({
      ...prev,
      [varId]: !prev[varId],
    }));
  };

  const handleConfirmCopy = () => {
    const varsToCopy = vars.filter((v) => selectedVarIds[v.id]);
    if (varsToCopy.length === 0) {
      toast.error("Please select at least one variable to copy.");
      return;
    }

    let finalTargetId = targetEnvId;

    if (isCreatingNewTarget || targetEnvId === "__new__") {
      if (!newEnvName.trim()) {
        toast.error("Please enter a name for the new environment.");
        return;
      }
      finalTargetId = onCreateTargetEnv(
        newEnvProjectId === "global" ? null : newEnvProjectId,
        newEnvName.trim()
      );
    }

    if (!finalTargetId) {
      toast.error("Please select a target environment.");
      return;
    }

    onExecuteCopy(finalTargetId, varsToCopy, conflictMode);
    toast.success(`Copied ${varsToCopy.length} variables to target environment!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm select-none p-4">
      <div className="bg-card w-full max-w-xl border border-border rounded-xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="h-14 border-b border-border bg-card px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Copy size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Copy / Clone Variables
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Copy credentials and variables from <span className="text-primary font-semibold">{sourceEnv.name}</span> into another environment.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* TARGET ENVIRONMENT PICKER */}
          <div className="space-y-1.5 bg-muted/20 p-3.5 rounded-lg border border-border/60">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ArrowRight size={12} className="text-primary" /> Target Destination:
            </label>

            <div className="space-y-2">
              <Select
                value={isCreatingNewTarget ? "__new__" : targetEnvId}
                onValueChange={(val) => {
                  if (val === "__new__") {
                    setIsCreatingNewTarget(true);
                  } else {
                    setIsCreatingNewTarget(false);
                    setTargetEnvId(val);
                  }
                }}
              >
                <SelectTrigger className="h-8 bg-input border-border text-xs text-foreground">
                  <SelectValue placeholder="Select target environment" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground text-xs">
                  {sourceEnv.id !== GLOBALS_ENV_ID && (
                    <SelectItem value={GLOBALS_ENV_ID}>
                      <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                        <Globe size={12} /> Globals (Universal)
                      </span>
                    </SelectItem>
                  )}

                  {projects.map((proj) => {
                    const envs = (backendEnvironments[proj.id] || []).filter(
                      (e) => e.id !== sourceEnv.id
                    );
                    if (envs.length === 0) return null;
                    return (
                      <React.Fragment key={proj.id}>
                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-muted/40 mt-1">
                          {proj.name}
                        </div>
                        {envs.map((env) => (
                          <SelectItem key={env.id} value={env.id}>
                            <span className="flex items-center gap-1.5">
                              <Server size={11} className="text-amber-500" />
                              {env.name}
                            </span>
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  <div className="h-px bg-border my-1" />
                  <SelectItem value="__new__" className="text-primary font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Plus size={12} /> + Create New Target Environment...
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* CREATE NEW ENVIRONMENT INLINE */}
              {isCreatingNewTarget && (
                <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">
                      New Environment Name:
                    </label>
                    <Input
                      value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                      placeholder="e.g. Staging or Prod"
                      className="h-7 text-xs bg-input border-border"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">
                      Target Backend:
                    </label>
                    <Select
                      value={newEnvProjectId}
                      onValueChange={setNewEnvProjectId}
                    >
                      <SelectTrigger className="h-7 text-xs bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground text-xs">
                        <SelectItem value="global">Globals</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CONFLICT RESOLUTION */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">If variable already exists:</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="conflict"
                  checked={conflictMode === "merge"}
                  onChange={() => setConflictMode("merge")}
                  className="accent-primary"
                />
                <span>Skip (Keep existing)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="conflict"
                  checked={conflictMode === "overwrite"}
                  onChange={() => setConflictMode("overwrite")}
                  className="accent-primary"
                />
                <span>Overwrite</span>
              </label>
            </div>
          </div>

          {/* VARIABLES SELECTION LIST */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(c) => handleToggleSelectAll(c === true)}
                  className="border-border/80"
                />
                <span className="text-xs font-semibold text-foreground">
                  Select Variables ({selectedCount} of {vars.length})
                </span>
              </div>
            </div>

            <div className="border border-border/80 rounded-lg max-h-52 overflow-y-auto divide-y divide-border/40 bg-card/25">
              {vars.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground italic">
                  No variables available in this source environment.
                </div>
              ) : (
                vars.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleToggleVar(v.id)}
                    className="flex items-center gap-3 px-3 py-1.5 hover:bg-white/5 cursor-pointer transition-colors text-xs"
                  >
                    <Checkbox
                      checked={selectedVarIds[v.id] || false}
                      onCheckedChange={() => handleToggleVar(v.id)}
                      className="border-border/80"
                    />
                    <span className="font-mono font-semibold text-foreground w-[160px] truncate">
                      {v.key}
                    </span>
                    <span className="font-mono text-muted-foreground truncate flex-1 text-[11px]">
                      {v.type === "secret" ? "••••••••" : v.currentValue || v.initialValue || ""}
                    </span>
                    {v.type === "secret" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        secret
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="h-14 border-t border-border bg-card px-5 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            {selectedCount} {selectedCount === 1 ? "variable" : "variables"} selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmCopy}
              className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/95"
            >
              Copy Variables
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
