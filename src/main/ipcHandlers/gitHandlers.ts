import { BrowserWindow, ipcMain } from "electron";
import type Store from "electron-store";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import treeKill from "tree-kill";
import type { GitSummary, StoreType } from "../../types";

let getMainWindow: () => BrowserWindow | null;
let activeCloneChild: any = null;

type GitExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function pathIsDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function runGit(
  cwd: string,
  args: string[],
  opts?: { timeoutMs?: number },
): Promise<GitExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo" },
    });

    if (args[0] === "clone") {
      activeCloneChild = child;
    }

    let stdout = "";
    let stderr = "";

    const timeoutMs = opts?.timeoutMs ?? 30_000;
    const timeout = setTimeout(() => {
      if (child.pid) {
        treeKill(child.pid, "SIGKILL");
      } else {
        child.kill();
      }
      if (args[0] === "clone") {
        activeCloneChild = null;
      }
      reject(new Error(`git ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on("data", (d) => {
      const str = d.toString();
      stdout += str;
      if (args[0] === "clone") {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send("git:clone-log", str);
        }
      }
    });

    child.stderr?.on("data", (d) => {
      const str = d.toString();
      stderr += str;
      if (args[0] === "clone") {
        const mainWindow = getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send("git:clone-log", str);
        }
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      if (args[0] === "clone") {
        activeCloneChild = null;
      }
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (args[0] === "clone") {
        activeCloneChild = null;
      }
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

function runGitInRepo(
  repoRoot: string,
  args: string[],
  opts?: { timeoutMs?: number },
): Promise<GitExecResult> {
  // Use `git -C <path>` to avoid pathspec prefixing issues when callers pass
  // repo-relative paths but the process happens to run from a subdirectory.
  return runGit(repoRoot, ["-C", repoRoot, ...args], opts);
}

async function getRepoRoot(cwd: string): Promise<string | null> {
  const res = await runGit(cwd, ["rev-parse", "--show-toplevel"], {
    timeoutMs: 10_000,
  }).catch(() => null);
  if (!res || res.code !== 0) return null;
  const root = res.stdout.trim();
  return root ? root : null;
}

function parseAheadBehind(
  line: string,
): { ahead: number; behind: number } | null {
  // line example: "## main...origin/main [ahead 1, behind 2]"
  const match = line.match(/\[(.*)\]$/);
  if (!match) return null;
  const content = match[1];
  let ahead = 0;
  let behind = 0;
  const aheadMatch = content.match(/ahead\s+(\d+)/);
  const behindMatch = content.match(/behind\s+(\d+)/);
  if (aheadMatch) ahead = Number(aheadMatch[1] || 0);
  if (behindMatch) behind = Number(behindMatch[1] || 0);
  return { ahead, behind };
}

function parsePorcelainStatus(porcelain: string): {
  branch: string | null;
  upstream: string | null;
  aheadBehindFromStatus: { ahead: number; behind: number } | null;
  files: GitSummary["files"];
} {
  const lines = porcelain
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter(Boolean);

  let branch: string | null = null;
  let upstream: string | null = null;
  let aheadBehindFromStatus: { ahead: number; behind: number } | null = null;

  const files: GitSummary["files"] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // Examples:
      // ## main...origin/main [ahead 1]
      // ## main
      // ## HEAD (no branch)
      const header = line.slice(3);
      const [headPart] = header.split(" [");
      const [local, remote] = headPart.split("...");
      branch = local?.trim() || null;
      upstream = remote?.trim() || null;
      aheadBehindFromStatus = parseAheadBehind(line);
      continue;
    }

    // Porcelain v1: XY <path>
    // X = index status, Y = worktree status
    // Paths can include " -> " for renames.
    const indexStatus = line[0] ?? " ";
    const worktreeStatus = line[1] ?? " ";
    const rawPath = line.slice(3).trim();

    // Handle rename format: "old -> new"; keep new.
    const filePath = rawPath.includes(" -> ")
      ? rawPath.split(" -> ").pop()!.trim()
      : rawPath;

    files.push({
      path: filePath,
      indexStatus,
      worktreeStatus,
      staged: indexStatus !== " " && indexStatus !== "?",
      untracked: indexStatus === "?" && worktreeStatus === "?",
    });
  }

  return { branch, upstream, aheadBehindFromStatus, files };
}

async function getGitSummaryForPath(projectPath: string): Promise<GitSummary> {
  const isDir = await pathIsDirectory(projectPath);
  if (!isDir) {
    return {
      isRepo: false,
      branch: null,
      upstream: null,
      aheadBehind: null,
      changeCount: 0,
      files: [],
      branches: [],
      lastRefreshedAt: Date.now(),
      error: "Invalid project path",
    };
  }

  const repoRoot = await getRepoRoot(projectPath);
  if (!repoRoot) {
    return {
      isRepo: false,
      branch: null,
      upstream: null,
      aheadBehind: null,
      changeCount: 0,
      files: [],
      branches: [],
      lastRefreshedAt: Date.now(),
      error: "Not a git repository",
    };
  }

  // Fetch remote for ahead/behind accuracy (quiet)
  await runGitInRepo(repoRoot, ["fetch", "--prune", "--quiet"], {
    timeoutMs: 30_000,
  }).catch(() => {
    // ignore fetch errors (offline etc.)
  });

  // Always run status at repo root so file paths are repo-relative.
  const status = await runGitInRepo(
    repoRoot,
    ["status", "--porcelain=v1", "-b"],
    {
      timeoutMs: 15_000,
    },
  );

  const parsed = parsePorcelainStatus(status.stdout);

  const branchesRes = await runGitInRepo(repoRoot, [
    "branch",
    "--format=%(refname:short)",
  ]).catch(() => ({ code: 1, stdout: "", stderr: "" }));

  const branches = branchesRes.stdout
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Prefer rev-list counts if upstream exists; otherwise fall back to status header.
  let aheadBehind: { ahead: number; behind: number } | null = null;
  if (parsed.upstream) {
    const counts = await runGit(repoRoot, [
      "rev-list",
      "--left-right",
      "--count",
      `${parsed.upstream}...HEAD`,
    ]).catch(() => null);

    if (counts && counts.code === 0) {
      const [behindStr, aheadStr] = counts.stdout.trim().split(/\s+/);
      const behind = Number(behindStr || 0);
      const ahead = Number(aheadStr || 0);
      aheadBehind = { ahead, behind };
    } else {
      aheadBehind = parsed.aheadBehindFromStatus;
    }
  } else {
    aheadBehind = parsed.aheadBehindFromStatus;
  }

  const changeCount = parsed.files.length;

  return {
    isRepo: true,
    branch: parsed.branch,
    upstream: parsed.upstream,
    aheadBehind,
    changeCount,
    files: parsed.files,
    branches,
    lastRefreshedAt: Date.now(),
    error: status.code !== 0 ? status.stderr.trim() : null,
  };
}

export function registerGitHandlers(
  store: Store<StoreType>,
  getMainWindowFn: () => BrowserWindow | null,
) {
  getMainWindow = getMainWindowFn;

  ipcMain.handle("git:summary", async (_event, projectPath: string) => {
    try {
      return await getGitSummaryForPath(projectPath);
    } catch (error: any) {
      return {
        isRepo: false,
        branch: null,
        upstream: null,
        aheadBehind: null,
        changeCount: 0,
        files: [],
        branches: [],
        lastRefreshedAt: Date.now(),
        error: error?.message || "Failed to get git summary",
      } satisfies GitSummary;
    }
  });

  ipcMain.handle("git:pull", async (_event, projectPath: string) => {
    const repoRoot = await getRepoRoot(projectPath);
    if (!repoRoot)
      return { code: 1, stdout: "", stderr: "Not a git repository" };
    const res = await runGitInRepo(repoRoot, ["pull"], { timeoutMs: 120_000 });
    return res;
  });

  ipcMain.handle("git:push", async (_event, projectPath: string) => {
    const repoRoot = await getRepoRoot(projectPath);
    if (!repoRoot)
      return { code: 1, stdout: "", stderr: "Not a git repository" };
    const res = await runGitInRepo(repoRoot, ["push"], { timeoutMs: 120_000 });
    return res;
  });

  ipcMain.handle(
    "git:checkout",
    async (_event, projectPath: string, branch: string) => {
      // Basic hardening: reject empty/whitespace branch names
      const safeBranch = (branch || "").trim();
      if (!safeBranch) {
        return { code: 1, stdout: "", stderr: "Invalid branch name" };
      }

      const repoRoot = await getRepoRoot(projectPath);
      if (!repoRoot)
        return { code: 1, stdout: "", stderr: "Not a git repository" };
      const res = await runGitInRepo(repoRoot, ["checkout", safeBranch], {
        timeoutMs: 60_000,
      });
      return res;
    },
  );

  ipcMain.handle("git:restore-all", async (_event, projectPath: string) => {
    const repoRoot = await getRepoRoot(projectPath);
    if (!repoRoot)
      return { code: 1, stdout: "", stderr: "Not a git repository" };
    // Common expectation: "restore all" should revert both staged and unstaged
    // changes (tracked files). Untracked files are intentionally left alone.
    const unstaged = await runGitInRepo(repoRoot, ["restore", "."], {
      timeoutMs: 60_000,
    });
    const staged = await runGitInRepo(repoRoot, ["restore", "--staged", "."], {
      timeoutMs: 60_000,
    });

    const code = unstaged.code === 0 && staged.code === 0 ? 0 : 1;
    const stdout = [unstaged.stdout, staged.stdout].filter(Boolean).join("\n");
    const stderr = [unstaged.stderr, staged.stderr].filter(Boolean).join("\n");
    return { code, stdout, stderr };
  });

  ipcMain.handle(
    "git:stage-file",
    async (_event, projectPath: string, filePath: string, stage: boolean) => {
      const safePath = (filePath || "").trim();
      if (!safePath) {
        return { code: 1, stdout: "", stderr: "Invalid file path" };
      }
      const repoRoot = await getRepoRoot(projectPath);
      if (!repoRoot)
        return { code: 1, stdout: "", stderr: "Not a git repository" };
      const args = stage
        ? ["add", "--", safePath]
        : ["restore", "--staged", "--", safePath];
      // Always run against repo root so paths from status work reliably.
      const res = await runGitInRepo(repoRoot, args, { timeoutMs: 30_000 });
      return res;
    },
  );

  ipcMain.handle("git:stage-all", async (_event, projectPath: string) => {
    const repoRoot = await getRepoRoot(projectPath);
    if (!repoRoot)
      return { code: 1, stdout: "", stderr: "Not a git repository" };
    const res = await runGitInRepo(repoRoot, ["add", "-A"], {
      timeoutMs: 60_000,
    });
    return res;
  });

  ipcMain.handle("git:unstage-all", async (_event, projectPath: string) => {
    const repoRoot = await getRepoRoot(projectPath);
    if (!repoRoot)
      return { code: 1, stdout: "", stderr: "Not a git repository" };
    const res = await runGitInRepo(repoRoot, ["restore", "--staged", "."], {
      timeoutMs: 60_000,
    });
    return res;
  });

  ipcMain.handle(
    "git:commit",
    async (_event, projectPath: string, message: string) => {
      const msg = (message || "").trim();
      if (!msg) {
        return { code: 1, stdout: "", stderr: "Commit message required" };
      }
      const repoRoot = await getRepoRoot(projectPath);
      if (!repoRoot)
        return { code: 1, stdout: "", stderr: "Not a git repository" };
      const res = await runGitInRepo(repoRoot, ["commit", "-m", msg], {
        timeoutMs: 60_000,
      });
      return res;
    },
  );

  ipcMain.handle(
    "git:clone",
    async (_event, parentDir: string, repoUrl: string, targetName: string) => {
      const url = (repoUrl || "").trim();
      const name = (targetName || "").trim();
      const dir = (parentDir || "").trim();
      if (!url || !name || !dir) {
        return { code: 1, stdout: "", stderr: "All fields are required" };
      }

      try {
        if (!fs.existsSync(dir)) {
          return { code: 1, stdout: "", stderr: "Parent directory does not exist" };
        }

        const targetPath = path.join(dir, name);
        if (fs.existsSync(targetPath)) {
          return { code: 1, stdout: "", stderr: "Target directory already exists" };
        }

        const res = await runGit(dir, ["clone", "--depth", "1", url, name], { timeoutMs: 90_000 });
        return res;
      } catch (err: any) {
        return { code: 1, stdout: "", stderr: err?.message || "Clone failed" };
      }
    },
  );

  ipcMain.handle("git:clone-cancel", async () => {
    if (activeCloneChild) {
      try {
        if (activeCloneChild.pid) {
          treeKill(activeCloneChild.pid, "SIGKILL");
        } else {
          activeCloneChild.kill();
        }
      } catch (err) {}
      activeCloneChild = null;
      return true;
    }
    return false;
  });

  // Background refresh every 45 minutes
  const refreshAll = async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    const projects = (store as any).get("projects") as Array<{
      id: string;
      path: string;
    }>;
    for (const p of projects) {
      try {
        const summary = await getGitSummaryForPath(p.path);
        mainWindow.webContents.send("git:summary-updated", {
          projectId: p.id,
          summary,
        });
      } catch (error: any) {
        mainWindow.webContents.send("git:summary-updated", {
          projectId: p.id,
          summary: {
            isRepo: false,
            branch: null,
            upstream: null,
            aheadBehind: null,
            changeCount: 0,
            files: [],
            branches: [],
            lastRefreshedAt: Date.now(),
            error: error?.message || "Failed to refresh git summary",
          } satisfies GitSummary,
        });
      }
    }
  };

  // Kick off shortly after app start
  setTimeout(() => void refreshAll(), 5_000);
  setInterval(() => void refreshAll(), 45 * 60 * 1000);
}
