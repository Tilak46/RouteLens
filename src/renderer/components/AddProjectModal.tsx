import { useState } from "react";
import { Group } from "@/../types"; // Import Group type
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // 1. Import Select components

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    projectName: string,
    startCommand: string,
    groupId: string | null
  ) => void; // 2. Update onSave signature
  groups: Group[]; // 3. Accept groups list
};

export function AddProjectModal({
  isOpen,
  onClose,
  onSave,
  groups,
}: ModalProps) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("npm run dev");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // 4. State for selected group

  const handleSave = () => {
    if (name.trim() && command.trim()) {
      onSave(name.trim(), command.trim(), selectedGroupId); // 5. Pass groupId on save
      setName("");
      setCommand("npm run dev");
      setSelectedGroupId(null); // Reset group selection
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-bg-card p-6 rounded-xl w-full max-w-md border border-border-main shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-6">
          Add New Project
        </h2>

        <div className="grid w-full items-center gap-2.5 mb-4">
          <Label htmlFor="projectName" className="text-text-main">
            Project Name
          </Label>
          <Input
            id="projectName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Project"
            className="bg-bg border-border-main text-text-main"
          />
        </div>

        <div className="grid w-full items-center gap-2.5 mb-4">
          <Label htmlFor="startCommand" className="text-text-main">
            Start Command
          </Label>
          <Input
            id="startCommand"
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="font-mono bg-bg border-border-main text-text-main"
          />
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <FolderPlus className="mr-2" size={18} />
            Select Folder & Save
          </Button>
        </div>
      </div>
    </div>
  );
}
