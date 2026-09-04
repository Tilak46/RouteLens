import { useState, useEffect } from "react";
import { Project } from "@/../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

type ModalProps = {
  project: Project | null;
  onClose: () => void;
  onSave: (project: Project) => void;
};

export function EditProjectModal({
  project,
  onClose,
  onSave,
}: ModalProps) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");

  // When the 'project' prop changes (modal opens), update the form's state
  useEffect(() => {
    if (project) {
      setName(project.name);
      setCommand(project.startCommand);
    }
  }, [project]);

  const handleSave = () => {
    if (!project) return;

    if (name.trim() && command.trim()) {
      const updatedProject: Project = {
        ...project,
        name: name.trim(),
        startCommand: command.trim(),
      };
      onSave(updatedProject);
      onClose();
    }
  };

  const isOpen = !!project; // Modal is open if a project is being edited

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Project Name Input */}
          <div className="grid w-full items-center gap-2.5">
            <Label htmlFor="editName" className="text-text-main">
              Project Name
            </Label>
            <Input
              id="editName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
              className="bg-bg border-border-main text-text-main"
            />
          </div>
          {/* Start Command Input */}
          <div className="grid w-full items-center gap-2.5">
            <Label htmlFor="editCommand" className="text-text-main">
              Start Command
            </Label>
            <Input
              id="editCommand"
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="font-mono bg-bg border-border-main text-text-main"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
