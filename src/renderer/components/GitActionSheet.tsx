import { useEffect, useMemo, useState } from "react";
import type { GitFileStatus, GitSummary, Project } from "@/../types";
import {
  RefreshCw,
  GitBranch,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { generateCommitMessage } from "@/lib/ai";

import apiClient from "@/lib/apiClient";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  summary?: GitSummary;
  onSummaryChange?: (projectId: string, summary: GitSummary) => void;
};

type GitExecResult = { code: number; stdout: string; stderr: string };

function formatBadgeSummary(s?: GitSummary): string {
  if (!s) return "Git";
  if (!s.isRepo) return "No repo";
  const branch = s.branch || "(unknown)";
  const count = s.changeCount ?? 0;
  return `${branch} ${count > 0 ? `[+${count}]` : ""}`;
}

function fileStatusLabel(file: GitFileStatus): string {
  const xy = `${file.indexStatus}${file.worktreeStatus}`;
  if (file.untracked) return "Untracked";
  if (xy === " M") return "Modified";
  if (xy === "M ") return "Staged";
  if (xy === "MM") return "Staged & Modified";
  if (xy === "A ") return "Added";
  if (xy === " D") return "Deleted";
  if (xy === "D ") return "Deleted (Staged)";
  if (xy === "R ") return "Renamed";
  return xy.trim() || "Changed";
}

export function GitActionSheet({
  open,
  onOpenChange,
  project,
  summary,
  onSummaryChange,
}: Props) {
  const [localSummary, setLocalSummary] = useState<GitSummary | undefined>(
    summary,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingFileOps, setPendingFileOps] = useState<Set<string>>(
    () => new Set(),
  );
  const [commitMessage, setCommitMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<GitExecResult | null>(null);

  useEffect(() => {
    setLocalSummary(summary);
  }, [summary]);

  const activeSummary = localSummary;

  const branchValue = useMemo(() => {
    if (!activeSummary?.isRepo) return "";
    return activeSummary.branch ?? "";
  }, [activeSummary]);

  const aheadBehindText = useMemo(() => {
    const ab = activeSummary?.aheadBehind;
    if (!ab) return null;
    const parts: string[] = [];
    if (ab.behind > 0) parts.push(`behind ${ab.behind}`);
    if (ab.ahead > 0) parts.push(`ahead ${ab.ahead}`);
    return parts.length ? parts.join(", ") : "up to date";
  }, [activeSummary]);

  async function refresh() {
    setIsRefreshing(true);
    try {
      const next = await apiClient.getGitSummary(project.path);
      setLocalSummary(next);
      onSummaryChange?.(project.id, next);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (open) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.path]);

  async function runAndRefresh(
    action: () => Promise<GitExecResult>,
    opts?: { successToast?: string; errorToast?: string },
  ) {
    setIsSyncing(true);
    setLastResult(null);
    try {
      const res = await action();
      setLastResult(res);
      if (res.code === 0) {
        if (opts?.successToast) toast.success(opts.successToast);
      } else {
        toast.error(opts?.errorToast || "Git command failed", {
          description: (res.stderr || res.stdout || "").trim().slice(0, 240),
        });
      }
      await refresh();
    } catch (error: any) {
      setLastResult({
        code: 1,
        stdout: "",
        stderr: error?.message || "Operation failed",
      });
      toast.error(opts?.errorToast || "Operation failed", {
        description: (error?.message || "").slice(0, 240),
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function stageOneFile(filePath: string, stage: boolean) {
    const key = filePath;
    setPendingFileOps((prev) => new Set(prev).add(key));

    // Optimistic UI update
    setLocalSummary((prev) => {
      if (!prev?.files) return prev;
      const nextFiles = prev.files.map((f) =>
        f.path === filePath ? { ...f, staged: stage } : f,
      );
      return { ...prev, files: nextFiles };
    });

    try {
      const res = await apiClient.gitStageFile(project.path, filePath, stage);
      setLastResult(res);

      if (res.code === 0) {
        // toast.success(stage ? "Staged file" : "Unstaged file", { description: filePath });
      } else {
        toast.error("Git command failed", {
          description: (res.stderr || res.stdout || "").trim().slice(0, 240),
        });
        // Revert optimistic update
        setLocalSummary((prev) => {
          if (!prev?.files) return prev;
          const nextFiles = prev.files.map((f) =>
            f.path === filePath ? { ...f, staged: !stage } : f,
          );
          return { ...prev, files: nextFiles };
        });
      }

      // Refresh in background
      void refresh();
    } catch (error: any) {
      toast.error("Operation failed", {
        description: (error?.message || "").slice(0, 240),
      });
      // Revert optimistic update
      setLocalSummary((prev) => {
        if (!prev?.files) return prev;
        const nextFiles = prev.files.map((f) =>
          f.path === filePath ? { ...f, staged: !stage } : f,
        );
        return { ...prev, files: nextFiles };
      });
    } finally {
      setPendingFileOps((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const files = activeSummary?.files ?? [];

  async function stageAllFallback() {
    // Fallback for older preload builds where gitStageAll isn't exposed yet.
    for (const f of files) {
      await apiClient.gitStageFile(project.path, f.path, true);
    }
  }

  async function unstageAllFallback() {
    // Only unstage what is currently staged.
    for (const f of files) {
      if (f.staged) {
        await apiClient.gitStageFile(project.path, f.path, false);
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-card/95 backdrop-blur-xl border-l border-white/10 w-[520px] sm:max-w-[520px] p-0 flex flex-col shadow-2xl"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/5 bg-black/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="text-foreground text-xl tracking-tight text-glow">
                {project.name}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs truncate mt-1 text-muted-foreground/80">
                {formatBadgeSummary(activeSummary)}
                {aheadBehindText ? ` • ${aheadBehindText}` : ""}
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="shrink-0 hover:bg-white/10"
              aria-label="Refresh git status"
            >
              <RefreshCw
                className={cn(
                  "text-muted-foreground",
                  isRefreshing && "animate-spin text-primary",
                )}
                size={18}
              />
            </Button>
          </div>

          {/* Sync Row */}
          <div className="mt-6 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void runAndRefresh(() => apiClient.gitPull(project.path), {
                  successToast: "Pulled latest changes",
                  errorToast: "Pull failed",
                })
              }
              disabled={isSyncing || isRefreshing || !activeSummary?.isRepo}
              className="bg-transparent border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/20 flex-1"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" /> Pull
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void runAndRefresh(() => apiClient.gitPush(project.path), {
                  successToast: "Pushed to remote",
                  errorToast: "Push failed",
                })
              }
              disabled={isSyncing || isRefreshing || !activeSummary?.isRepo}
              className="bg-transparent border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/20 flex-1"
            >
              <ArrowUpFromLine className="mr-2 h-4 w-4" /> Push
            </Button>

            <div className="w-[180px]">
              <Select
                value={branchValue}
                onValueChange={(nextBranch) => {
                  if (!nextBranch) return;
                  void runAndRefresh(
                    () => apiClient.gitCheckout(project.path, nextBranch),
                    {
                      successToast: `Switched to ${nextBranch}`,
                      errorToast: "Checkout failed",
                    },
                  );
                }}
                disabled={isSyncing || isRefreshing || !activeSummary?.isRepo}
              >
                <SelectTrigger className="bg-transparent border-white/10 text-muted-foreground h-9">
                  <GitBranch className="mr-2 h-3.5 w-3.5 opacity-70" />
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-white/10 text-popover-foreground">
                  {(activeSummary?.branches ?? []).map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetHeader>

        {/* File List */}
        <div className="flex-1 px-6 py-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="text-sm font-medium text-foreground/80">
              Changed Files{" "}
              <span className="text-muted-foreground ml-1 text-xs">
                ({files.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  isSyncing ||
                  isRefreshing ||
                  !activeSummary?.isRepo ||
                  files.length === 0
                }
                className="h-7 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5"
                onClick={() =>
                  void runAndRefresh(
                    async () => {
                      const fn = (apiClient as any).gitStageAll;
                      if (typeof fn === "function") {
                        return fn(project.path);
                      }
                      await stageAllFallback();
                      return { code: 0, stdout: "Staged files", stderr: "" };
                    },
                    {
                      successToast: "Staged all changes",
                      errorToast: "Stage all failed",
                    },
                  )
                }
              >
                Stage All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  isSyncing ||
                  isRefreshing ||
                  !activeSummary?.isRepo ||
                  files.length === 0
                }
                className="h-7 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5"
                onClick={() =>
                  void runAndRefresh(
                    async () => {
                      const fn = (apiClient as any).gitUnstageAll;
                      if (typeof fn === "function") {
                        return fn(project.path);
                      }
                      await unstageAllFallback();
                      return {
                        code: 0,
                        stdout: "Unstaged files",
                        stderr: "",
                      };
                    },
                    {
                      successToast: "Unstaged all changes",
                      errorToast: "Unstage all failed",
                    },
                  )
                }
              >
                Unstage All
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      isSyncing || isRefreshing || !activeSummary?.isRepo
                    }
                    className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> Restore
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">
                      Restore all changes?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      This will restore tracked files (both staged and unstaged)
                      to match HEAD. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10 hover:bg-white/5">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() =>
                        void runAndRefresh(
                          () => apiClient.gitRestoreAll(project.path),
                          {
                            successToast: "Restored changes",
                            errorToast: "Restore failed",
                          },
                        )
                      }
                    >
                      Restore
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1 rounded-lg border border-white/5 bg-black/20">
            {activeSummary?.isRepo ? (
              files.length > 0 ? (
                <div className="p-2 space-y-1">
                  {files.map((file) => {
                    const isChecked = !!file.staged;
                    return (
                      <div
                        key={file.path}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 transition-colors cursor-pointer group",
                          isChecked ? "bg-primary/10" : "hover:bg-white/5",
                        )}
                        onClick={() => {
                          // Toggle staging on row click for better UX
                          if (!isRefreshing && !pendingFileOps.has(file.path)) {
                            void stageOneFile(file.path, !isChecked);
                          }
                        }}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const stage = Boolean(checked);
                            void stageOneFile(file.path, stage);
                          }}
                          disabled={
                            isRefreshing || pendingFileOps.has(file.path)
                          }
                          className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "text-sm truncate transition-colors",
                              isChecked
                                ? "text-primary font-medium"
                                : "text-foreground group-hover:text-foreground",
                            )}
                          >
                            {file.path}
                          </div>
                          <div className="text-xs text-muted-foreground/60 font-mono">
                            {fileStatusLabel(file)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-sm text-muted-foreground/50 italics">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <RefreshCw size={20} className="opacity-50" />
                  </div>
                  Working tree clean.
                </div>
              )
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                Not a git repository
                {activeSummary?.error ? `: ${activeSummary.error}` : "."}
              </div>
            )}
          </div>

          {lastResult && (lastResult.stdout || lastResult.stderr) && (
            <div className="mt-4 shrink-0 rounded-md border border-white/10 bg-black/30 p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
              {(lastResult.stdout || "").trim()}
              {lastResult.stderr ? `\n${lastResult.stderr.trim()}` : ""}
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 border-t border-white/5 bg-muted/20">
          <div className="w-full space-y-3">
            <div className="relative">
              <Textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="bg-black/20 border-white/10 text-foreground resize-none focus:border-primary/50 transition-colors pr-10"
                disabled={
                  isSyncing ||
                  isRefreshing ||
                  !activeSummary?.isRepo ||
                  isGenerating
                }
                rows={5}
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 top-2 h-6 w-6 text-primary hover:bg-primary/20 hover:text-primary"
                onClick={async () => {
                  if (!activeSummary?.isRepo) return;
                  setIsGenerating(true);
                  try {
                    const stagedFiles = files
                      .filter((f) => f.staged)
                      .map((f) => `${f.indexStatus} ${f.path}`)
                      .join("\n");
                    if (!stagedFiles) {
                      toast.error("No staged files for AI to analyze.");
                      return;
                    }
                    const msg = await generateCommitMessage(
                      project.path,
                      "staged",
                    );
                    setCommitMessage(msg);
                  } catch (err: any) {
                    const message = String(
                      err?.message ?? err ?? "AI Generation Failed",
                    );
                    toast.error("AI Generation Failed", {
                      description: message,
                    });
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                disabled={isGenerating || !files.some((f) => f.staged)}
                title="Generate with AI"
              >
                <Sparkles
                  size={14}
                  className={isGenerating ? "animate-pulse" : ""}
                />
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground/50 font-mono truncate max-w-[200px]">
                {activeSummary?.upstream ? `${activeSummary.upstream}` : ""}
              </div>
              <Button
                onClick={() =>
                  void runAndRefresh(
                    () => apiClient.gitCommit(project.path, commitMessage),
                    {
                      successToast: "Committed",
                      errorToast: "Commit failed",
                    },
                  ).then(() => setCommitMessage(""))
                }
                disabled={
                  isSyncing ||
                  isRefreshing ||
                  !activeSummary?.isRepo ||
                  commitMessage.trim().length === 0
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                Commit Changes
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
