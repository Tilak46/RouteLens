import { useState, useEffect } from "react";
import { Plus, Trash2, X, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface ApiVariable {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
}

export interface ApiEnvironment {
  id: string;
  name: string;
  variables: ApiVariable[];
}

type ManageEnvironmentsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  environments: ApiEnvironment[];
  onUpdateEnvironments: (envs: ApiEnvironment[]) => void;
};

const newVariableRow = (): ApiVariable => ({
  id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
  enabled: true,
  key: "",
  value: "",
});

export function ManageEnvironmentsModal({
  isOpen,
  onClose,
  environments,
  onUpdateEnvironments,
}: ManageEnvironmentsModalProps) {
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);

  // Auto-select the first environment if none is selected
  useEffect(() => {
    if (isOpen && environments.length > 0 && !selectedEnvId) {
      setSelectedEnvId(environments[0].id);
    }
  }, [isOpen, environments, selectedEnvId]);

  if (!isOpen) return null;

  const selectedEnv = environments.find((e) => e.id === selectedEnvId) || null;

  const handleAddEnvironment = () => {
    const newId = `env_${Date.now()}`;
    const newEnv: ApiEnvironment = {
      id: newId,
      name: "New Environment",
      variables: [newVariableRow()],
    };
    const nextList = [...environments, newEnv];
    onUpdateEnvironments(nextList);
    setSelectedEnvId(newId);
  };

  const handleDeleteEnvironment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextList = environments.filter((env) => env.id !== id);
    onUpdateEnvironments(nextList);
    if (selectedEnvId === id) {
      setSelectedEnvId(nextList[0]?.id || null);
    }
  };

  const handleEnvNameChange = (newName: string) => {
    if (!selectedEnvId) return;
    const nextList = environments.map((e) =>
      e.id === selectedEnvId ? { ...e, name: newName } : e
    );
    onUpdateEnvironments(nextList);
  };

  const handleAddVariable = () => {
    if (!selectedEnvId || !selectedEnv) return;
    const nextList = environments.map((e) =>
      e.id === selectedEnvId
        ? { ...e, variables: [...e.variables, newVariableRow()] }
        : e
    );
    onUpdateEnvironments(nextList);
  };

  const handleVariableChange = (varId: string, field: keyof ApiVariable, value: any) => {
    if (!selectedEnvId || !selectedEnv) return;
    const nextList = environments.map((e) => {
      if (e.id === selectedEnvId) {
        return {
          ...e,
          variables: e.variables.map((v) =>
            v.id === varId ? { ...v, [field]: value } : v
          ),
        };
      }
      return e;
    });
    onUpdateEnvironments(nextList);
  };

  const handleRemoveVariable = (varId: string) => {
    if (!selectedEnvId || !selectedEnv) return;
    const nextList = environments.map((e) => {
      if (e.id === selectedEnvId) {
        return {
          ...e,
          variables: e.variables.filter((v) => v.id !== varId),
        };
      }
      return e;
    });
    onUpdateEnvironments(nextList);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm select-none">
      <div className="bg-card w-full max-w-3xl h-[500px] border border-border rounded-xl flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* HEADER */}
        <div className="h-14 border-b border-border bg-card px-5 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">
            Manage Environments
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY (Split Layout) */}
        <div className="flex-1 flex min-h-0">
          
          {/* Left Column - List */}
          <div className="w-56 bg-sidebar/50 border-r border-border/80 flex flex-col p-3 shrink-0">
            <Button
              onClick={handleAddEnvironment}
              variant="outline"
              size="sm"
              className="w-full justify-start h-8 text-xs border-dashed border-border hover:bg-white/5 bg-transparent mb-3 text-muted-foreground hover:text-foreground"
            >
              <Plus size={12} className="mr-1.5" />
              Add Environment
            </Button>

            <div className="flex-grow overflow-y-auto space-y-1 pr-1">
              {environments.length === 0 ? (
                <div className="text-[10px] text-muted-foreground text-center py-8 italic">
                  No environments configured.
                </div>
              ) : (
                environments.map((env) => {
                  const isActive = env.id === selectedEnvId;
                  return (
                    <div
                      key={env.id}
                      onClick={() => setSelectedEnvId(env.id)}
                      className={cn(
                        "group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs font-medium",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      <span className="truncate max-w-[140px]">{env.name}</span>
                      <button
                        onClick={(e) => handleDeleteEnvironment(env.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                        title="Delete Environment"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column - Editor */}
          <div className="flex-1 flex flex-col p-5 overflow-hidden">
            {!selectedEnv ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center text-muted-foreground select-none">
                <div className="w-12 h-12 rounded-full border border-dashed border-border flex items-center justify-center mb-3">
                  <PlusCircle size={20} className="opacity-50" />
                </div>
                <h4 className="text-xs font-semibold">No Environment Selected</h4>
                <p className="text-[10px] max-w-xs leading-normal mt-1">
                  Select an environment profile on the left or create a new one to define variables.
                </p>
              </div>
            ) : (
              <div className="flex-grow flex flex-col min-h-0">
                {/* Env Name Input */}
                <div className="mb-4 shrink-0 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                    Environment Name
                  </label>
                  <Input
                    value={selectedEnv.name}
                    onChange={(e) => handleEnvNameChange(e.target.value)}
                    placeholder="e.g. Local Dev"
                    className="h-8 bg-input border-border text-xs text-foreground focus:ring-1 focus:ring-primary/40 focus:border-primary/40 font-medium"
                  />
                </div>

                <div className="flex-grow flex flex-col min-h-0">
                  <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-2 shrink-0">
                    Variables Grid
                  </div>

                  {/* Variables Grid */}
                  <div className="flex-grow overflow-y-auto border border-border/80 rounded-lg bg-card/25 p-3 flex flex-col min-h-0">
                    <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                      {selectedEnv.variables.length === 0 ? (
                        <div className="text-[10px] text-muted-foreground italic py-4 text-center">
                          No variables configured in this environment.
                        </div>
                      ) : (
                        selectedEnv.variables.map((row) => (
                          <div key={row.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={row.enabled}
                              onCheckedChange={(v) =>
                                handleVariableChange(row.id, "enabled", v === true)
                              }
                              className="border-border"
                            />
                            <Input
                              value={row.key}
                              onChange={(e) =>
                                handleVariableChange(row.id, "key", e.target.value)
                              }
                              placeholder="Variable key (e.g. port)"
                              className="h-8 bg-input border-border/60 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary/40 focus:border-primary/40 flex-1"
                            />
                            <Input
                              value={row.value}
                              onChange={(e) =>
                                handleVariableChange(row.id, "value", e.target.value)
                              }
                              placeholder="Current value"
                              className="h-8 bg-input border-border/60 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary/40 focus:border-primary/40 flex-1"
                            />
                            <button
                              onClick={() => handleRemoveVariable(row.id)}
                              className="text-muted-foreground hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors"
                              title="Delete Variable"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )}

                      <Button
                        onClick={handleAddVariable}
                        variant="outline"
                        size="sm"
                        className="border-dashed border-border hover:bg-white/5 text-muted-foreground hover:text-foreground h-7 text-xs bg-transparent mt-2"
                      >
                        <Plus size={11} className="mr-1.5" />
                        Add Variable
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="h-14 border-t border-border bg-card px-5 flex items-center justify-end shrink-0">
          <Button
            onClick={onClose}
            className="h-8 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/95"
          >
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
