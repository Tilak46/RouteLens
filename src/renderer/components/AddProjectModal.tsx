import { useState } from "react";
import { FolderOpen, Plus, FolderCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/apiClient";
import { toast } from "sonner";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    projectName: string,
    startCommand: string,
    projectPath: string,
  ) => void;
};

export function AddProjectModal({
  isOpen,
  onClose,
  onSave,
}: ModalProps) {
  const [selectedPath, setSelectedPath] = useState("");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("npm run dev");

  const handleBrowseFolder = async () => {
    try {
      const path = await apiClient.openDirectoryDialog();
      if (path) {
        setSelectedPath(path);
        const parts = path.split(/[\\/]/).filter(Boolean);
        const folderName = parts[parts.length - 1] || "My Project";
        if (!name.trim()) {
          setName(folderName);
        }
      }
    } catch (err) {
      toast.error("Failed to open folder picker");
    }
  };

  const handleSave = () => {
    if (!selectedPath.trim()) {
      toast.error("Please select a project folder first");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    if (!command.trim()) {
      toast.error("Please enter a start command");
      return;
    }

    onSave(name.trim(), command.trim(), selectedPath.trim());
    setSelectedPath("");
    setName("");
    setCommand("npm run dev");
  };

  const handleModalClose = () => {
    setSelectedPath("");
    setName("");
    setCommand("npm run dev");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 backdrop-blur-sm select-none">
      <div className="bg-bg-card p-6 rounded-xl w-full max-w-md border border-border-main shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            Add New Local Project
          </h2>
          <span className="text-[11px] text-muted-foreground font-mono">
            Step {selectedPath ? "2 of 2" : "1 of 2"}
          </span>
        </div>

        {/* Folder Selection Area */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">
            Project Folder Location
          </Label>
          {selectedPath ? (
            <div className="flex items-center justify-between p-2.5 bg-muted/20 border border-emerald-500/30 rounded-lg text-xs font-mono text-foreground break-all">
              <div className="flex items-center gap-2 overflow-hidden">
                <FolderCheck size={16} className="text-emerald-400 shrink-0" />
                <span className="truncate text-foreground/90 font-medium" title={selectedPath}>
                  {selectedPath}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBrowseFolder}
                className="h-6 text-[11px] text-primary hover:text-primary/80 shrink-0 ml-2 px-2"
              >
                Change
              </Button>
            </div>
          ) : (
            <button
              onClick={handleBrowseFolder}
              className="w-full border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-white/5 rounded-xl p-5 flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <FolderOpen size={20} />
              </div>
              <span className="text-xs font-semibold text-foreground">
                Click to Choose Project Folder
              </span>
              <span className="text-[10px] text-muted-foreground">
                Supports Next.js, Express, NestJS codebases
              </span>
            </button>
          )}
        </div>

        {/* Project Name & Command (Rendered when path is chosen or editable) */}
        <div className="space-y-3 pt-1">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="projectName" className="text-xs text-foreground font-medium">
              Project Display Name
            </Label>
            <Input
              id="projectName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. User Management Service"
              className="bg-bg border-border-main text-foreground text-xs h-9"
            />
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="startCommand" className="text-xs text-foreground font-medium">
              Start Command
            </Label>
            <Input
              id="startCommand"
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npm run dev"
              className="font-mono bg-bg border-border-main text-foreground text-xs h-9"
            />
            <span className="text-[10px] text-muted-foreground">
              Command executed when you click Play in Local Servers.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-border/40">
          <Button variant="secondary" size="sm" onClick={handleModalClose} className="text-xs h-8">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!selectedPath.trim()}
            className="text-xs h-8 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={14} className="mr-1" />
            Add Project
          </Button>
        </div>
      </div>
    </div>
  );
}
