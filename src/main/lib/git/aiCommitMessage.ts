import { spawn } from "node:child_process";
import path from "node:path";

import { openRouterChat } from "../ai/openrouter";

type GitExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type CommitMessageMode = "staged" | "all";

type AiCommitJson = {
  type?: string;
  scope?: string;
  subject?: string;
  bullets?: string[];
};

type ChangeSummary = {
  totalFiles: number;
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
};

type ParsedAiCommit = {
  type: string;
  scope: string;
  subject: string;
  bullets: string[];
};

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
    });

    let stdout = "";
    let stderr = "";

    const timeoutMs = opts?.timeoutMs ?? 30_000;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`git ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

async function getRepoRoot(projectPath: string): Promise<string | null> {
  const res = await runGit(projectPath, ["rev-parse", "--show-toplevel"], {
    timeoutMs: 10_000,
  }).catch(() => null);
  if (!res || res.code !== 0) return null;
  const root = res.stdout.trim();
  return root ? root : null;
}

function redactSecrets(text: string): string {
  let out = String(text ?? "");

  // Common env lines
  out = out.replace(/^(\s*GEMINI_API_KEY\s*=\s*).+$/gim, "$1<redacted>");
  out = out.replace(/^(\s*GOOGLE_API_KEY\s*=\s*).+$/gim, "$1<redacted>");
  out = out.replace(/^(\s*OPENROUTER_API_KEY\s*=\s*).+$/gim, "$1<redacted>");

  // Google API key pattern (rough)
  out = out.replace(/AIzaSy[0-9A-Za-z_-]{20,}/g, "<redacted>");

  // OpenAI-ish keys
  out = out.replace(/\bsk-[0-9A-Za-z]{20,}\b/g, "<redacted>");

  // Private keys
  out = out.replace(
    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
    "<redacted-private-key>",
  );

  return out;
}

function truncate(text: string, maxChars: number): string {
  const t = String(text ?? "");
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n<TRUNCATED ${t.length - maxChars} chars>`;
}

function extractAddedLineSamples(args: {
  patch: string;
  maxFiles?: number;
  maxLinesPerFile?: number;
  maxLineLength?: number;
}): Array<{ file: string; lines: string[] }> {
  const patch = String(args.patch ?? "");
  const maxFiles = args.maxFiles ?? 6;
  const maxLinesPerFile = args.maxLinesPerFile ?? 3;
  const maxLineLength = args.maxLineLength ?? 140;

  const out: Array<{ file: string; lines: string[] }> = [];
  let currentFile = "";

  const ensureFile = (f: string) => {
    let entry = out.find((e) => e.file === f);
    if (!entry) {
      entry = { file: f, lines: [] };
      out.push(entry);
    }
    return entry;
  };

  const lines = patch.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = String(rawLine ?? "");

    if (line.startsWith("diff --git ")) {
      // Example: diff --git a/foo b/foo
      const m = line.match(/\sb\/(.+)$/);
      currentFile = m?.[1] ? String(m[1]) : "";
      continue;
    }

    if (!currentFile) continue;
    if (out.length > maxFiles) break;

    if (line.startsWith("+++")) continue;
    if (line.startsWith("@@")) continue;
    if (!line.startsWith("+")) continue;
    if (line.startsWith("++")) continue;

    const entry = ensureFile(currentFile);
    if (entry.lines.length >= maxLinesPerFile) continue;

    const content = line.slice(1).trim();
    if (!content) continue;

    // Skip obviously noisy lines.
    if (/^\/\//.test(content)) continue;
    if (/^\*\s/.test(content)) continue;

    entry.lines.push(content.slice(0, maxLineLength));
  }

  return out.filter((e) => e.lines.length > 0).slice(0, maxFiles);
}

function firstLine(s: string): string {
  const line =
    String(s ?? "")
      .split(/\r?\n/)
      .find((l) => l.trim()) ?? "";
  return line.trim();
}

function cleanCommitLine(s: string): string {
  let out = firstLine(s);
  out = out.replace(/^```+/, "").replace(/```+$/, "");
  out = out.replace(/^['"`]+|['"`]+$/g, "");
  out = out.replace(/\s+/g, " ").trim();
  if (out.endsWith(".")) out = out.slice(0, -1);
  return out;
}

function cleanBullet(s: string): string {
  let out = String(s ?? "").trim();
  out = out.replace(/^[-*\u2022]+\s*/, "");
  out = out.replace(/`+/g, "");
  out = out.replace(/^[-\s:]+/, "");
  out = out.replace(/\s+/g, " ").trim();
  if (out.endsWith(".")) out = out.slice(0, -1);
  return out;
}

function isGenericSubject(subject: string): boolean {
  const s = String(subject ?? "")
    .trim()
    .toLowerCase();
  if (!s) return true;
  const bad = [
    "update project files",
    "update files",
    "update code",
    "update application pages",
    "update pages",
    "update website",
    "update documentation",
    "update docs",
    "update readme",
    "update dependencies",
    "bump dependencies",
    "update",
    "changes",
    "minor fixes",
    "fixes",
    "wip",
  ];
  if (bad.includes(s)) return true;
  if (s.startsWith("update ") && s.length <= 18) return true;
  if (s.startsWith("fix ") && s.length <= 10) return true;
  return false;
}

function parseBullets(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return [];
}

function findFirstParsableJsonObject(text: string): AiCommitJson | null {
  const t = String(text ?? "");
  const starts: number[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "{") starts.push(i);
  }

  for (const start of starts) {
    let depth = 0;
    for (let end = start; end < t.length; end++) {
      const ch = t[end];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      if (depth === 0) {
        const slice = t.slice(start, end + 1).trim();
        try {
          return JSON.parse(slice) as AiCommitJson;
        } catch {
          break;
        }
      }
    }
  }

  return null;
}

function salvageFromText(raw: string): AiCommitJson {
  const t = String(raw ?? "");
  // Try to salvage from a conventional commit style response.
  const first = firstLine(t);
  const bullets = t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") || l.startsWith("*") || l.startsWith("•"));

  if (isConventionalCommit(first)) {
    const m = first.match(
      /^(feat|fix|chore|refactor|docs|test|style|build|ci|perf|revert)(\(([^\)\r\n]+)\))?:\s*(.+)$/,
    );
    return {
      type: m?.[1],
      scope: m?.[3],
      subject: m?.[4],
      bullets: bullets.map((b) => b.replace(/^[-*•]+\s*/, "")).slice(0, 6),
    };
  }

  return {
    subject: first,
    bullets: bullets.map((b) => b.replace(/^[-*•]+\s*/, "")).slice(0, 6),
  };
}

function finalizeParsedCommit(args: {
  parsed: AiCommitJson;
  suggestedScope: string;
}): ParsedAiCommit {
  const type = normalizeType(String(args.parsed?.type ?? ""));
  const scope = normalizeScope(
    String(args.parsed?.scope ?? args.suggestedScope ?? ""),
  );
  const subject = normalizeSubject(String(args.parsed?.subject ?? ""));
  const bullets = parseBullets(args.parsed?.bullets)
    .map(cleanBullet)
    .filter(Boolean)
    .slice(0, 5);

  return { type, scope, subject, bullets };
}

function fallbackFromSamples(args: {
  changes: Array<{ status: string; path: string }>;
  samples: Array<{ file: string; lines: string[] }>;
}): { title: string; bullets: string[] } {
  const changes = args.changes;
  const files = Array.from(
    new Set(changes.map((c) => c.path.replace(/\\/g, "/"))),
  );
  const onlyDocs =
    files.length > 0 && files.every((p) => /\.(md|mdx|txt)$/i.test(p));

  const sampleByFile = new Map(
    args.samples.map((s) => [s.file.replace(/\\/g, "/"), s.lines]),
  );

  if (onlyDocs && files.length === 1) {
    const file = files[0];
    const base = file.split("/").pop() || "docs";
    const scope = /readme\.md/i.test(base) ? "readme" : "docs";
    const lines = sampleByFile.get(file) || [];
    const joined = lines.join(" ").toLowerCase();

    if (/smoke/.test(joined) || /commit-msg/.test(joined)) {
      return {
        title: `docs(${scope}): add commit message smoke marker`,
        bullets: [
          `Add a small marker line to ${base}`,
          lines[0]
            ? `Marker content: ${lines[0]}`
            : "Add a marker line for testing",
        ],
      };
    }

    // Generic docs fallback, but still file-specific.
    return {
      title: `docs(${scope}): update ${base}`,
      bullets: [
        `Update ${base}`,
        lines[0]
          ? `Change includes: ${lines[0]}`
          : "Adjust documentation content",
      ],
    };
  }

  return { title: "", bullets: [] };
}

function extractJsonObject(text: string): string {
  const t = String(text ?? "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return t.trim();
  return t.slice(start, end + 1).trim();
}

function normalizeType(t: string): string {
  const s = String(t ?? "")
    .trim()
    .toLowerCase();
  const allowed = new Set([
    "feat",
    "fix",
    "refactor",
    "docs",
    "test",
    "chore",
    "style",
    "build",
    "ci",
    "perf",
    "revert",
  ]);
  if (allowed.has(s)) return s;
  return "chore";
}

function normalizeScope(s: string): string {
  const out = String(s ?? "").trim();
  if (!out) return "";
  // Keep scope short and safe for conventional commits.
  return out
    .replace(/[^a-zA-Z0-9\-_/]/g, "")
    .replace(/\//g, "-")
    .slice(0, 32);
}

function normalizeSubject(s: string): string {
  let out = String(s ?? "").trim();
  out = out.replace(/^['"`]+|['"`]+$/g, "");
  out = out.replace(/\s+/g, " ").trim();
  if (out.endsWith(".")) out = out.slice(0, -1);
  // Capitalization: conventional commits usually use lowercase imperative.
  out = out.charAt(0).toLowerCase() + out.slice(1);
  return out;
}

function formatCommitMessage(json: {
  type: string;
  scope: string;
  subject: string;
  bullets: string[];
}): string {
  const title = json.scope
    ? `${json.type}(${json.scope}): ${json.subject}`
    : `${json.type}: ${json.subject}`;

  const uniqueBullets = Array.from(
    new Set(json.bullets.map(cleanBullet).filter(Boolean)),
  ).slice(0, 5);

  if (uniqueBullets.length === 0) return title;

  const body = uniqueBullets.map((b) => `- ${b}`).join("\n");
  return `${title}\n\n${body}`;
}

function summarizeChanges(
  changes: Array<{ status: string; path: string }>,
): ChangeSummary {
  const unique = new Set(changes.map((c) => c.path));
  let added = 0;
  let modified = 0;
  let deleted = 0;
  let renamed = 0;

  for (const c of changes) {
    const s = String(c.status || "");
    if (s === "A") added++;
    else if (s === "M") modified++;
    else if (s === "D") deleted++;
    else if (s === "R" || s.startsWith("R")) renamed++;
    else modified++;
  }

  return {
    totalFiles: unique.size,
    added,
    modified,
    deleted,
    renamed,
  };
}

function ensureChangeCountBullet(
  message: string,
  summary: ChangeSummary,
): string {
  const bullet = `Files changed: ${summary.totalFiles}`;
  if (message.includes(bullet)) return message;

  const lines = String(message ?? "").split(/\r?\n/);
  const hasBullets = lines.some((l) => l.trim().startsWith("- "));
  if (!hasBullets) return `${message}\n\n- ${bullet}`;

  // Insert at end of bullet list.
  return `${message}\n- ${bullet}`;
}

function isConventionalCommit(line: string): boolean {
  return /^(feat|fix|chore|refactor|docs|test|style|build|ci|perf|revert)(\([^\)\r\n]+\))?: .+/.test(
    line,
  );
}

function parseNameStatus(
  text: string,
): Array<{ status: string; path: string }> {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: Array<{ status: string; path: string }> = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    const status = parts[0] ?? "";
    if (!status) continue;

    // Handle rename lines: R100 old new
    if (status.startsWith("R") && parts.length >= 3) {
      out.push({ status: "R", path: parts[parts.length - 1] });
      continue;
    }

    const p = parts.slice(1).join(" ").trim();
    if (!p) continue;
    out.push({ status, path: p });
  }

  return out;
}

function fallbackCommitMessage(changedPaths: string[]): string {
  const paths = changedPaths.map((p) => p.replace(/\\/g, "/"));
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const all = (re: RegExp) =>
    paths.length > 0 && paths.every((p) => re.test(p));

  const onlyDocs = all(/\.(md|mdx|txt)$/i);
  if (onlyDocs) return "docs: update documentation";

  const onlyTests = all(/(^|\/)test(\/|$)|\.(spec|test)\./i);
  if (onlyTests) return "test: update tests";

  if (has(/src\/main\/lib\/ai\//i) || has(/gemini\.ts$/i)) {
    return "feat(ai): add Gemini provider support";
  }

  if (has(/src\/main\/ipcHandlers\/aiHandlers\.ts$/i)) {
    return "feat(ai): improve commit message generation";
  }

  if (has(/src\/renderer\/components\/GitActionSheet\.tsx$/i)) {
    return "feat(git): generate commit messages from staged diff";
  }

  if (has(/src\/app\//i) && has(/\/create-package\//i)) {
    return "feat(create-package): extend create package flow";
  }

  // Next.js marketing/site updates.
  if (has(/src\/(app|pages)\//i) && has(/public\//i)) {
    if (has(/src\/app\/recording-scenario\/page\.tsx$/i)) {
      return "feat(website): add recording-scenario page and update landing";
    }
    return "feat(website): update landing page and public assets";
  }

  if (has(/src\/(app|pages)\//i)) {
    if (has(/src\/app\/recording-scenario\/page\.tsx$/i)) {
      return "feat(website): add recording-scenario page";
    }
    if (has(/src\/app\/FeaturesSection\.tsx$/i)) {
      return "feat(website): add features section to landing page";
    }
    return "feat(website): update Next.js pages";
  }

  if (has(/package\.json$/i) || has(/package-lock\.json$/i)) {
    // If it's *only* dependency files, say so. Otherwise, treat as part of the feature.
    const onlyDeps =
      paths.length > 0 &&
      paths.every((p) =>
        /(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(
          p,
        ),
      );
    return onlyDeps
      ? "chore: update dependencies"
      : "chore: update dependencies and lockfile";
  }

  return "chore: update project files";
}

function fallbackBulletsFromChanged(
  changes: Array<{ status: string; path: string }>,
): string[] {
  const paths = changes.map((c) => c.path.replace(/\\/g, "/"));
  const has = (re: RegExp) => paths.some((p) => re.test(p));

  // Next.js website heuristics.
  const hasHome =
    has(/src\/app\/page\.tsx$/i) || has(/src\/(pages|app)\/index\.tsx$/i);
  const hasFeaturesSection = has(/src\/app\/FeaturesSection\.tsx$/i);
  const hasRecordingScenario = has(/src\/app\/recording-scenario\/page\.tsx$/i);
  const hasGlobals = has(/src\/app\/globals\.css$/i);
  const hasLayout = has(/src\/app\/layout\.tsx$/i);
  const hasDemoAsset = has(/public\/.*\.(webp|png|jpg|jpeg|gif|svg)$/i);
  const hasDeps = has(/package\.json$/i) || has(/package-lock\.json$/i);
  const hasBuildLogs = has(/build_logs\.txt$/i);

  if (has(/src\/(app|pages)\//i)) {
    const bullets: string[] = [];
    if (hasFeaturesSection)
      bullets.push("Add FeaturesSection component for the landing page");
    if (hasRecordingScenario)
      bullets.push("Add recording-scenario page under src/app");
    if (hasHome)
      bullets.push("Revise homepage content and sections in src/app/page.tsx");
    if (hasDemoAsset)
      bullets.push("Add demo asset under public/ for marketing content");
    if (hasGlobals || hasLayout)
      bullets.push("Update global styles/layout for the website");
    if (hasDeps)
      bullets.push("Update dependencies and lockfile for Next.js app");
    if (hasBuildLogs) bullets.push("Add build_logs.txt artifact to repository");
    return bullets.slice(0, 5);
  }

  if (has(/src\/app\//i) && has(/\/create-package\//i)) {
    return [
      "Add create package pages and UI components",
      "Update repricing, day, and summary sections",
    ];
  }

  if (has(/src\/main\/lib\/ai\//i)) {
    return [
      "Add Gemini client with model auto-selection",
      "Route AI features through Gemini when configured",
    ];
  }

  if (has(/src\/main\/lib\/git\/aiCommitMessage\.ts$/i)) {
    return [
      "Generate commit messages from staged diff",
      "Add validation and fallback formatting",
    ];
  }

  // Generic-but-useful: group by top folder and action.
  const topFolder = (p: string) => {
    const segs = p.split("/").filter(Boolean);
    return segs[0] || "files";
  };

  const counts = new Map<string, number>();
  for (const p of paths)
    counts.set(topFolder(p), (counts.get(topFolder(p)) || 0) + 1);
  const common = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  const added = changes.filter((c) => c.status === "A").length;
  const modified = changes.filter((c) => c.status === "M").length;
  const renamed = changes.filter((c) => c.status === "R").length;

  const bullet1 = common
    ? `Update ${common} files (${paths.length} changed)`
    : `Update files (${paths.length} changed)`;
  const bullet2Parts: string[] = [];
  if (added) bullet2Parts.push(`${added} added`);
  if (modified) bullet2Parts.push(`${modified} modified`);
  if (renamed) bullet2Parts.push(`${renamed} renamed`);
  const bullet2 = bullet2Parts.length
    ? `Change breakdown: ${bullet2Parts.join(", ")}`
    : "Change breakdown: multiple updates";

  return [bullet1, bullet2];
}

function ensureBullets(message: string, bullets: string[]): string {
  const clean = bullets.map(cleanBullet).filter(Boolean);
  if (clean.length === 0) return message;
  if (message.includes("\n\n- ")) return message;
  return `${message}\n\n${clean.map((b) => `- ${b}`).join("\n")}`;
}

function subjectTooLong(line: string): boolean {
  const idx = line.indexOf(": ");
  if (idx === -1) return false;
  const subject = line.slice(idx + 2);
  return subject.length > 72;
}

async function gitOrEmpty(repoRoot: string, args: string[]): Promise<string> {
  const res = await runGit(repoRoot, ["-C", repoRoot, ...args], {
    timeoutMs: 30_000,
  }).catch(() => null);
  if (!res || res.code !== 0) return "";
  return res.stdout;
}

async function buildGitContext(repoRoot: string, mode: CommitMessageMode) {
  const stagedNameStatus = await gitOrEmpty(repoRoot, [
    "diff",
    "--staged",
    "--name-status",
  ]);
  const stagedStat = await gitOrEmpty(repoRoot, ["diff", "--staged", "--stat"]);
  const stagedPatch = await gitOrEmpty(repoRoot, [
    "diff",
    "--staged",
    "--no-color",
    "--no-ext-diff",
    "-U2",
  ]);

  const unstagedNameStatus =
    mode === "all" ? await gitOrEmpty(repoRoot, ["diff", "--name-status"]) : "";
  const unstagedStat =
    mode === "all" ? await gitOrEmpty(repoRoot, ["diff", "--stat"]) : "";
  const unstagedPatch =
    mode === "all"
      ? await gitOrEmpty(repoRoot, [
          "diff",
          "--no-color",
          "--no-ext-diff",
          "-U2",
        ])
      : "";

  const status = await gitOrEmpty(repoRoot, ["status", "--porcelain=v1", "-b"]);

  return {
    status,
    stagedNameStatus,
    stagedStat,
    stagedPatch,
    unstagedNameStatus,
    unstagedStat,
    unstagedPatch,
  };
}

export async function generateAiCommitMessage(args: {
  projectPath: string;
  mode?: CommitMessageMode;
}): Promise<string> {
  const projectPath = String(args.projectPath ?? "").trim();
  if (!projectPath) throw new Error("projectPath is required");

  const repoRoot = await getRepoRoot(projectPath);
  if (!repoRoot) throw new Error("Not a git repository");

  const mode: CommitMessageMode = args.mode ?? "staged";
  const ctx = await buildGitContext(repoRoot, mode);

  if (mode === "staged") {
    const hasStaged = Boolean(String(ctx.stagedNameStatus).trim());
    if (!hasStaged) throw new Error("No staged changes to generate a message.");
  } else {
    const hasAny =
      Boolean(String(ctx.stagedNameStatus).trim()) ||
      Boolean(String(ctx.unstagedNameStatus).trim());
    if (!hasAny) throw new Error("No changes found to generate a message.");
  }

  const repoName = path.basename(repoRoot);

  const payload = redactSecrets(
    [
      `repo=${repoName}`,
      `mode=${mode}`,
      "",
      "# git status",
      truncate(ctx.status, 1200),
      "",
      "# staged name-status",
      truncate(ctx.stagedNameStatus, 2000),
      "",
      "# staged diffstat",
      truncate(ctx.stagedStat, 2000),
      "",
      "# staged patch (excerpt)",
      truncate(ctx.stagedPatch, 12_000),
      ...(mode === "all"
        ? [
            "",
            "# unstaged name-status",
            truncate(ctx.unstagedNameStatus, 2000),
            "",
            "# unstaged diffstat",
            truncate(ctx.unstagedStat, 2000),
            "",
            "# unstaged patch (excerpt)",
            truncate(ctx.unstagedPatch, 6000),
          ]
        : []),
    ].join("\n"),
  );

  const sampleLines = extractAddedLineSamples({
    patch: `${ctx.stagedPatch || ""}\n${ctx.unstagedPatch || ""}`,
  });
  const sampleBlock = sampleLines.length
    ? redactSecrets(
        [
          "# added line samples (ground truth)",
          ...sampleLines.flatMap((e) => [
            `file: ${e.file}`,
            ...e.lines.map((l) => `+ ${l}`),
            "",
          ]),
        ].join("\n"),
      )
    : "";

  const changedPaths = [
    ...parseNameStatus(ctx.stagedNameStatus),
    ...parseNameStatus(ctx.unstagedNameStatus),
  ].map((x) => x.path);

  const parsedChanges = [
    ...parseNameStatus(ctx.stagedNameStatus),
    ...parseNameStatus(ctx.unstagedNameStatus),
  ];
  const summary = summarizeChanges(parsedChanges);

  const suggestedScope = (() => {
    const paths = changedPaths.map((p) => p.replace(/\\/g, "/"));
    // Try to find a meaningful scope from common directory patterns.
    const hit = (re: RegExp, scope: string) =>
      paths.some((p) => re.test(p)) ? scope : "";
    return (
      (/website/i.test(repoName) ? "website" : "") ||
      hit(/src\/main\/lib\/ai\//i, "ai") ||
      hit(/src\/main\/ipcHandlers\//i, "main") ||
      hit(/src\/renderer\//i, "renderer") ||
      hit(/src\/app\/\(protected\)\/create-package\//i, "create-package") ||
      hit(/\/create-package\//i, "create-package") ||
      hit(/src\/(app|pages)\//i, "website") ||
      ""
    );
  })();

  const system = `You generate excellent, accurate git commit messages.

Return ONLY valid JSON (no markdown, no code fences) in this shape:
{
  "type": "feat|fix|refactor|docs|test|chore|style|build|ci|perf",
  "scope": "optional-short-scope",
  "subject": "imperative, <=72 chars, no trailing period",
  "bullets": ["2-4 concise summary bullets"]
}

Rules:
- Base everything ONLY on the provided git context.
- Be specific and accurate; do NOT write generic subjects like "update project files".
- Do NOT invent features or intent. If details are unclear, describe file-level changes.
- Ground your wording in filenames and the provided added-line samples.
- Subject must be concrete and to-the-point.
- Bullets must describe what changed (not intentions), include key nouns from the diff.
- Bullets are REQUIRED (2 to 4 bullets).
- Bullets must be 6-14 words each.
- If scope is unclear, use empty string.
${suggestedScope ? `- Suggested scope: ${suggestedScope}` : ""}`;

  const user = `Git context (may be truncated):\n\n${payload}\n\n${sampleBlock}`;

  const attempt = async (maxTokens: number, context: string) => {
    const raw = await openRouterChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: context },
      ],
      temperature: 0,
      maxTokens,
    });

    const parsed =
      findFirstParsableJsonObject(raw) ??
      (() => {
        try {
          return JSON.parse(extractJsonObject(raw)) as AiCommitJson;
        } catch {
          return null;
        }
      })() ??
      salvageFromText(raw);

    const normalized = finalizeParsedCommit({ parsed, suggestedScope });

    if (normalized.bullets.length < 2) {
      throw new Error("AI returned too few bullets");
    }

    if (
      !normalized.subject ||
      subjectTooLong(`${normalized.type}: ${normalized.subject}`) ||
      isGenericSubject(normalized.subject)
    ) {
      throw new Error("AI returned an invalid/generic subject");
    }

    return formatCommitMessage(normalized);
  };

  // Try full context first.
  try {
    const msg = await attempt(520, user);
    return ensureChangeCountBullet(msg, summary);
  } catch {
    // Retry with a smaller, higher-signal context (files + diffstat only).
    const smaller = redactSecrets(
      [
        `repo=${repoName}`,
        `mode=${mode}`,
        "",
        "# staged name-status",
        truncate(ctx.stagedNameStatus, 4000),
        "",
        "# staged diffstat",
        truncate(ctx.stagedStat, 4000),
        sampleBlock,
        ...(mode === "all"
          ? [
              "",
              "# unstaged name-status",
              truncate(ctx.unstagedNameStatus, 4000),
              "",
              "# unstaged diffstat",
              truncate(ctx.unstagedStat, 4000),
            ]
          : []),
      ].join("\n"),
    );

    try {
      const msg = await attempt(520, `Git context:\n\n${smaller}`);
      return ensureChangeCountBullet(msg, summary);
    } catch {
      const fromSamples = fallbackFromSamples({
        changes: parsedChanges,
        samples: sampleLines,
      });

      const fallbackTitle =
        fromSamples.title || fallbackCommitMessage(changedPaths);
      const fallbackBullets = fromSamples.bullets.length
        ? fromSamples.bullets
        : fallbackBulletsFromChanged(parsedChanges);

      const msg = ensureBullets(fallbackTitle, fallbackBullets);
      return ensureChangeCountBullet(msg, summary);
    }
  }
}
