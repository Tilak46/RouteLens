import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPlus, Terminal, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { toast } from "sonner";
import { Project } from "@/../types";

interface DevToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: (newProject: Project) => void;
}

export function DevToolsModal({ isOpen, onClose, onProjectAdded }: DevToolsModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Dev tools states
  const [repoUrl, setRepoUrl] = useState("");
  const [parentDir, setParentDir] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [cloneLogs, setCloneLogs] = useState<string[]>([]);
  const [isCloned, setIsCloned] = useState(false);
  const consoleRef = React.useRef<HTMLDivElement>(null);

  // Server registration states
  const [projectName, setProjectName] = useState("");
  const [startCommand, setStartCommand] = useState("npm run dev");
  const [isRegistering, setIsRegistering] = useState(false);

  React.useEffect(() => {
    if (typeof apiClient.onGitCloneLog === "function") {
      apiClient.onGitCloneLog((log) => {
        setCloneLogs((prev) => {
          // If the last log element matches the new log, or we want to clean it up
          // Git clone logs contain carriage returns (\r) or update percentages.
          // Let's filter out carriage return jumps or just append them beautifully.
          const clean = log.replace(/\r/g, "\n").trim();
          if (!clean) return prev;
          return [...prev, clean];
        });
      });
    }
  }, []);

  React.useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [cloneLogs]);

  if (!isOpen) return null;

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "Tilak@2440") {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect developer password.");
      toast.error("Authentication failed");
    }
  };

  const handleBrowseParentDir = async () => {
    const dir = await apiClient.openDirectoryDialog();
    if (dir) {
      setParentDir(dir);
    }
  };

  const handleRepoUrlChange = (val: string) => {
    setRepoUrl(val);
    const trimmed = val.trim();
    if (trimmed.endsWith(".git")) {
      const parts = trimmed.split("/");
      const last = parts[parts.length - 1];
      setCloneName(last.replace(/\.git$/, ""));
    } else if (trimmed.includes("/")) {
      const parts = trimmed.split("/");
      const last = parts[parts.length - 1];
      setCloneName(last);
    }
  };

  const handleCloneRepo = async () => {
    if (!repoUrl.trim() || !parentDir.trim() || !cloneName.trim()) {
      toast.error("Please fill in all clone details");
      return;
    }

    setIsCloning(true);
    setCloneLogs(["Initializing git clone..."]);

    try {
      const result = await apiClient.gitClone(parentDir, repoUrl, cloneName);
      if (result.code === 0) {
        setCloneLogs((prev) => [...prev, "Repository cloned successfully!"]);
        toast.success("Repository cloned successfully");
        setIsCloned(true);
        setProjectName(cloneName);
      } else {
        setCloneLogs((prev) => [...prev, `Error cloning repository:`, result.stderr || result.stdout]);
        toast.error("Git clone failed");
      }
    } catch (err: any) {
      setCloneLogs((prev) => [...prev, `Exception during clone: ${err?.message || err}`]);
      toast.error("Git clone failed");
    } finally {
      setIsCloning(false);
    }
  };

  const handleCancelClone = async () => {
    try {
      await apiClient.gitCloneCancel();
      setCloneLogs((prev) => [...prev, "Clone cancelled by user."]);
      toast.info("Cloning cancelled");
      setIsCloning(false);
    } catch (err) {}
  };

  const handleRegisterProject = async () => {
    if (!projectName.trim() || !startCommand.trim()) {
      toast.error("Please enter a project name and start command");
      return;
    }

    setIsRegistering(true);
    try {
      const projectPath = `${parentDir}/${cloneName}`.replace(/\\/g, "/").replace(/\/+/g, "/");
      const port = await apiClient.detectProjectPort(projectPath).catch(() => null);

      const newProj: Project = {
        id: `proj_${Date.now()}`,
        name: projectName.trim(),
        path: projectPath,
        startCommand: startCommand.trim(),
        url: port ? `http://localhost:${port}` : "http://localhost:3000",
        groupId: null,
        status: "stopped",
      };

      apiClient.addProject(newProj);
      onProjectAdded(newProj);
      toast.success("Project added to server list");
      handleClose();
    } catch (err: any) {
      toast.error("Failed to register project");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleClose = () => {
    setIsAuthenticated(false);
    setPassword("");
    setAuthError("");
    setRepoUrl("");
    setParentDir("");
    setCloneName("");
    setIsCloned(false);
    setProjectName("");
    setStartCommand("npm run dev");
    setCloneLogs([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-md">
      <div className="bg-bg-card p-6 rounded-xl w-full max-w-lg border border-border-main shadow-2xl text-foreground">
        {!isAuthenticated ? (
          <form onSubmit={handleVerifyPassword} className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Terminal size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Developer Mode</h2>
                <p className="text-xs text-muted-foreground">Verify password to open developer tools.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="devPass">Password</Label>
              <Input
                id="devPass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-bg border-border-main text-white"
                autoFocus
              />
              {authError && (
                <div className="text-[10px] text-rose-400 flex items-center gap-1 mt-1 font-semibold">
                  <ShieldAlert size={12} /> {authError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit">Verify</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="text-primary" size={18} />
                <h2 className="text-lg font-bold text-white">Developer Command Center</h2>
              </div>
              <span className="bg-primary/10 border border-primary/20 text-[10px] text-primary px-2 py-0.5 rounded font-mono font-semibold">
                AUTHENTICATED
              </span>
            </div>

            {!isCloned ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>GitHub Repository URL</Label>
                  <Input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => handleRepoUrlChange(e.target.value)}
                    placeholder="https://github.com/username/repository.git"
                    className="bg-bg border-border-main text-white text-xs"
                    disabled={isCloning}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Parent Directory (Save Folder)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={parentDir}
                      onChange={(e) => setParentDir(e.target.value)}
                      placeholder="C:/projects"
                      className="bg-bg border-border-main text-white text-xs flex-1"
                      disabled={isCloning}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBrowseParentDir}
                      className="bg-transparent border-border hover:bg-white/5 text-xs h-9"
                      disabled={isCloning}
                    >
                      Browse...
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Clone Folder Name</Label>
                  <Input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="repository-folder"
                    className="bg-bg border-border-main text-white text-xs font-mono"
                    disabled={isCloning}
                  />
                </div>

                {cloneLogs.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground font-mono">Git Output Console</Label>
                    <div ref={consoleRef} className="bg-black/40 border border-border/30 rounded-lg p-2.5 max-h-[150px] overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 select-text">
                      {cloneLogs.map((log, idx) => (
                        <div key={idx} className="break-all whitespace-pre-wrap">{log}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  {isCloning ? (
                    <Button variant="destructive" onClick={handleCancelClone} className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
                      Cancel Clone
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={handleClose}>
                      Close
                    </Button>
                  )}
                  <Button
                    onClick={handleCloneRepo}
                    disabled={isCloning || !repoUrl || !parentDir || !cloneName}
                  >
                    {isCloning ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={14} /> Cloning...
                      </>
                    ) : (
                      "Clone Repository"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg p-3">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <div>
                    <span className="font-semibold">Successfully Cloned!</span>
                    <p className="text-[10px] text-emerald-400/80">Repo exists locally at: {parentDir}/{cloneName}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Local Server Project Name</Label>
                  <Input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    className="bg-bg border-border-main text-white text-xs"
                    disabled={isRegistering}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Start Command</Label>
                  <Input
                    type="text"
                    value={startCommand}
                    onChange={(e) => setStartCommand(e.target.value)}
                    placeholder="npm run dev"
                    className="bg-bg border-border-main text-white text-xs font-mono"
                    disabled={isRegistering}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={handleClose} disabled={isRegistering}>
                    Cancel
                  </Button>
                  <Button onClick={handleRegisterProject} disabled={isRegistering || !projectName}>
                    {isRegistering ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={14} /> Registering...
                      </>
                    ) : (
                      <>
                        <FolderPlus className="mr-2" size={14} /> Add to Server List
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
