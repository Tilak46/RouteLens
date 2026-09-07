import React, { useState, useMemo } from "react";
import {
  Globe,
  Server,
  Plus,
  Copy,
  Download,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
} from "lucide-react";
import {
  ApiEnvironment,
  ApiVariable,
  GLOBALS_ENV_ID,
  VariableType,
  createNewVariable,
} from "../../types/environments";
import { Project } from "@/../types";
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

interface EnvironmentEditorViewProps {
  environment: ApiEnvironment;
  project?: Project | null;
  isActiveForProject: boolean;
  onUpdateEnvironment: (updated: ApiEnvironment) => void;
  onToggleActive: () => void;
  onOpenCopyModal: (sourceEnvId: string) => void;
  onDuplicateEnvironment: (envId: string) => void;
  onExportEnvironment: (env: ApiEnvironment) => void;
}

export function EnvironmentEditorView({
  environment,
  project,
  isActiveForProject,
  onUpdateEnvironment,
  onToggleActive,
  onOpenCopyModal,
  onDuplicateEnvironment,
  onExportEnvironment,
}: EnvironmentEditorViewProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [isImportingEnv, setIsImportingEnv] = useState(false);
  const [envPasteText, setEnvPasteText] = useState("");
  const [showBanner, setShowBanner] = useState(true);

  const isGlobals = environment.id === GLOBALS_ENV_ID;

  // Toggle reveal secret for a row
  const toggleRevealSecret = (varId: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [varId]: !prev[varId],
    }));
  };

  // Name change handler
  const handleNameChange = (name: string) => {
    if (isGlobals) return;
    onUpdateEnvironment({
      ...environment,
      name,
      updatedAt: Date.now(),
    });
  };

  // Variable list mutations
  const handleAddVariable = () => {
    const newVar = createNewVariable();
    onUpdateEnvironment({
      ...environment,
      variables: [...environment.variables, newVar],
      updatedAt: Date.now(),
    });
  };

  const handleUpdateVariable = (varId: string, field: keyof ApiVariable, value: any) => {
    const updatedVars = environment.variables.map((v) => {
      if (v.id === varId) {
        const next = { ...v, [field]: value };
        // Sync legacy value field with currentValue
        if (field === "currentValue") {
          next.value = String(value);
        } else if (field === "initialValue" && !v.currentValue) {
          next.currentValue = String(value);
          next.value = String(value);
        }
        return next;
      }
      return v;
    });

    onUpdateEnvironment({
      ...environment,
      variables: updatedVars,
      updatedAt: Date.now(),
    });
  };

  const handleDeleteVariable = (varId: string) => {
    onUpdateEnvironment({
      ...environment,
      variables: environment.variables.filter((v) => v.id !== varId),
      updatedAt: Date.now(),
    });
  };

  // Bulk Import from .env text
  const handleImportEnvText = () => {
    if (!envPasteText.trim()) {
      setIsImportingEnv(false);
      return;
    }

    const lines = envPasteText.split(/\r?\n/);
    const parsed: ApiVariable[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const rawKey = trimmed.substring(0, eqIdx).trim();
        let rawVal = trimmed.substring(eqIdx + 1).trim();

        // Strip wrapping quotes if present
        if (
          (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
          (rawVal.startsWith("'") && rawVal.endsWith("'"))
        ) {
          rawVal = rawVal.slice(1, -1);
        }

        if (rawKey) {
          const isSecret =
            rawKey.toLowerCase().includes("secret") ||
            rawKey.toLowerCase().includes("key") ||
            rawKey.toLowerCase().includes("password") ||
            rawKey.toLowerCase().includes("token");

          parsed.push(
            createNewVariable(rawKey, rawVal, isSecret ? "secret" : "default")
          );
        }
      }
    }

    if (parsed.length === 0) {
      toast.error("No valid KEY=VALUE pairs found in pasted text.");
      return;
    }

    onUpdateEnvironment({
      ...environment,
      variables: [...environment.variables, ...parsed],
      updatedAt: Date.now(),
    });

    toast.success(`Imported ${parsed.length} variables from .env text`);
    setEnvPasteText("");
    setIsImportingEnv(false);
  };

  // Filtered variables
  const q = filterQuery.trim().toLowerCase();
  const filteredVariables = useMemo(() => {
    if (!q) return environment.variables;
    return environment.variables.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        (v.currentValue || "").toLowerCase().includes(q) ||
        (v.initialValue || "").toLowerCase().includes(q)
    );
  }, [environment.variables, q]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden select-none">
      {/* 1. TOP HEADER & METADATA */}
      <div className="px-6 py-4 border-b border-border/80 shrink-0 bg-card/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center border",
                isGlobals
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-primary/10 border-primary/30 text-primary"
              )}
            >
              {isGlobals ? <Globe size={20} /> : <Server size={18} />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                {isGlobals ? (
                  <h2 className="text-base font-bold text-foreground">Globals</h2>
                ) : (
                  <Input
                    value={environment.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Environment Name"
                    className="text-base font-bold h-7 px-1.5 py-0 bg-transparent border-transparent hover:border-border/60 focus:bg-input focus:border-primary/50 text-foreground w-[260px] -ml-1.5"
                  />
                )}

                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border",
                    isGlobals
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  )}
                >
                  {isGlobals ? "All Backends" : `Dedicated: ${project?.name || "Backend"}`}
                </span>
              </div>

              <div className="text-xs text-muted-foreground mt-0.5">
                {isGlobals
                  ? "Universal variables accessible by all requests and backend environments."
                  : `Variables dedicated strictly to the ${project?.name || "selected"} backend.`}
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            {!isGlobals && project && (
              <Button
                variant={isActiveForProject ? "default" : "outline"}
                size="sm"
                onClick={onToggleActive}
                className={cn(
                  "h-8 text-xs font-semibold gap-1.5 cursor-pointer transition-all",
                  isActiveForProject
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "border-border/80 hover:bg-white/5 text-muted-foreground hover:text-foreground"
                )}
              >
                <CheckCircle2 size={13} />
                <span>{isActiveForProject ? "Active for Backend" : "Set as Active"}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenCopyModal(environment.id)}
              className="h-8 text-xs font-semibold gap-1.5 border-border/80 hover:bg-white/5 text-primary hover:text-primary cursor-pointer"
              title="Copy variables into another backend or environment"
            >
              <Copy size={12} />
              <span>Copy To...</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onExportEnvironment(environment)}
              className="h-8 text-xs font-medium gap-1.5 border-border/80 hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Export as JSON"
            >
              <Download size={12} />
              <span>Export</span>
            </Button>
          </div>
        </div>

        {/* 2. POSTMAN-STYLE SECURITY & PRIVACY BANNER */}
        {showBanner && (
          <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/25 to-card border border-purple-800/30 rounded-xl p-4 relative overflow-hidden text-xs">
            <button
              onClick={() => setShowBanner(false)}
              className="absolute top-2.5 right-2.5 text-muted-foreground/60 hover:text-foreground p-1 rounded transition-colors"
              title="Dismiss"
            >
              ✕
            </button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pr-6">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock size={13} />
                </div>
                <div>
                  <div className="font-semibold text-purple-200">Local & Secure</div>
                  <div className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                    Current values stay strictly on your local device and are used during request dispatch.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <EyeOff size={13} />
                </div>
                <div>
                  <div className="font-semibold text-indigo-200">Sensitive Secret Masking</div>
                  <div className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                    Fields marked as Secret are masked with •••••••• to prevent accidental shoulder-surfing or leaks.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={13} />
                </div>
                <div>
                  <div className="font-semibold text-emerald-200">Dynamic & Nested Vars</div>
                  <div className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                    Supports nested variables (e.g. <code>{"{{host}}:{{port}}"}</code>) and system dynamic tags (<code>{"{{$guid}}"}</code>, <code>{"{{$timestamp}}"}</code>).
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. TABLE TOOLBAR */}
      <div className="px-6 py-2.5 flex items-center justify-between border-b border-border/60 shrink-0 bg-muted/10 gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter variables..."
              className="h-7 pl-8 pr-2 text-xs bg-input/60 border-border/60 rounded-md placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportingEnv(!isImportingEnv)}
            className="h-7 text-xs border-dashed border-border/80 hover:bg-white/5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Upload size={11} className="mr-1.5" />
            <span>Import .env</span>
          </Button>

          <Button
            size="sm"
            onClick={handleAddVariable}
            className="h-7 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
          >
            <Plus size={12} className="mr-1" />
            <span>Add Variable</span>
          </Button>
        </div>
      </div>

      {/* IMPORT .ENV DRAWER */}
      {isImportingEnv && (
        <div className="px-6 py-3 bg-muted/30 border-b border-border/80 shrink-0 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <FileCode size={13} className="text-primary" />
              Paste .env File Contents:
            </span>
            <button
              onClick={() => setIsImportingEnv(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <textarea
            value={envPasteText}
            onChange={(e) => setEnvPasteText(e.target.value)}
            placeholder={`PORT=5000\nAPI_URL=http://localhost:5000\nJWT_SECRET=supersecret123\nDB_PASS=xyz$123`}
            rows={3}
            className="w-full bg-input border border-border/80 rounded-md p-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              size="sm"
              onClick={handleImportEnvText}
              className="h-7 text-xs font-semibold bg-primary text-primary-foreground"
            >
              Parse & Append Variables
            </Button>
          </div>
        </div>
      )}

      {/* 4. VARIABLES GRID TABLE */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="min-w-[700px]">
          {/* Table Header */}
          <div className="sticky top-0 bg-muted/30 backdrop-blur-sm border-b border-border/60 flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-2 px-6 z-10">
            <div className="w-8 shrink-0 flex items-center justify-center">
              <Checkbox
                checked={
                  filteredVariables.length > 0 &&
                  filteredVariables.every((v) => v.enabled)
                }
                onCheckedChange={(checked) => {
                  const updated = environment.variables.map((v) => ({
                    ...v,
                    enabled: checked === true,
                  }));
                  onUpdateEnvironment({ ...environment, variables: updated });
                }}
                className="border-border/80"
              />
            </div>
            <div className="w-[200px] px-2">Variable (Key)</div>
            <div className="w-[100px] px-2 text-center">Type</div>
            <div className="flex-1 px-2">Initial Value</div>
            <div className="flex-1 px-2">Current Value</div>
            <div className="w-10 shrink-0 text-center" />
          </div>

          {/* Table Rows */}
          {filteredVariables.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center select-none">
              <div className="w-10 h-10 rounded-full border border-dashed border-border/80 flex items-center justify-center mb-2">
                <Plus size={16} className="opacity-40" />
              </div>
              <div className="font-semibold text-xs text-foreground/80">No variables configured</div>
              <div className="text-[11px] text-muted-foreground/60 max-w-xs mt-1">
                {q
                  ? "No variables matched your search filter."
                  : "Click 'Add Variable' or 'Import .env' to start defining values for this environment."}
              </div>
              {!q && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddVariable}
                  className="mt-3 h-7 text-xs border-dashed"
                >
                  <Plus size={12} className="mr-1" /> Add Variable
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredVariables.map((v) => {
                const isSecret = v.type === "secret";
                const isRevealed = revealedSecrets[v.id] || false;
                const displayVal = v.currentValue ?? v.value ?? "";

                return (
                  <div
                    key={v.id}
                    className={cn(
                      "flex items-center px-6 py-1.5 hover:bg-muted/10 transition-colors group",
                      !v.enabled && "opacity-50"
                    )}
                  >
                    {/* Checkbox */}
                    <div className="w-8 shrink-0 flex items-center justify-center">
                      <Checkbox
                        checked={v.enabled}
                        onCheckedChange={(c) =>
                          handleUpdateVariable(v.id, "enabled", c === true)
                        }
                        className="border-border/80"
                      />
                    </div>

                    {/* Variable Key */}
                    <div className="w-[200px] px-2">
                      <Input
                        value={v.key}
                        onChange={(e) =>
                          handleUpdateVariable(v.id, "key", e.target.value)
                        }
                        placeholder="Variable key"
                        className="h-7 text-xs font-mono bg-transparent border-transparent hover:border-border/60 focus:bg-input focus:border-primary/50 text-foreground font-semibold"
                      />
                    </div>

                    {/* Type Selector */}
                    <div className="w-[100px] px-2 flex justify-center">
                      <Select
                        value={v.type || "default"}
                        onValueChange={(val: VariableType) =>
                          handleUpdateVariable(v.id, "type", val)
                        }
                      >
                        <SelectTrigger className="h-7 text-[11px] border-border/40 bg-transparent hover:bg-white/5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-foreground text-xs">
                          <SelectItem value="default">default</SelectItem>
                          <SelectItem value="secret">
                            <span className="flex items-center gap-1.5 text-purple-400 font-medium">
                              <Lock size={10} /> secret
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Initial Value */}
                    <div className="flex-1 px-2">
                      <Input
                        value={v.initialValue ?? ""}
                        onChange={(e) =>
                          handleUpdateVariable(v.id, "initialValue", e.target.value)
                        }
                        placeholder="Shared default"
                        className="h-7 text-xs font-mono bg-transparent border-transparent hover:border-border/60 focus:bg-input focus:border-primary/50 text-muted-foreground hover:text-foreground"
                      />
                    </div>

                    {/* Current Value (Sensitive Masking) */}
                    <div className="flex-1 px-2 relative flex items-center">
                      <Input
                        type={isSecret && !isRevealed ? "password" : "text"}
                        value={displayVal}
                        onChange={(e) =>
                          handleUpdateVariable(v.id, "currentValue", e.target.value)
                        }
                        placeholder="Active local value"
                        className={cn(
                          "h-7 text-xs font-mono bg-transparent border-transparent hover:border-border/60 focus:bg-input focus:border-primary/50 text-foreground pr-8",
                          isSecret && !isRevealed && "tracking-widest"
                        )}
                      />

                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => toggleRevealSecret(v.id)}
                          className="absolute right-3.5 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                          title={isRevealed ? "Mask Secret" : "Reveal Secret"}
                        >
                          {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                    </div>

                    {/* Delete Row Button */}
                    <div className="w-10 shrink-0 flex items-center justify-center">
                      <button
                        onClick={() => handleDeleteVariable(v.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                        title="Delete Variable"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
