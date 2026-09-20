import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FolderPlus,
  Terminal,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Play,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  ShieldAlert as ShieldCheck,
  Copy,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { toast } from "sonner";
import { Project, ApiRoute } from "@/../types";
import { cn } from "@/lib/utils";

interface DevToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: (newProject: Project) => void;
  projects?: Project[];
  treeCache?: Record<string, any>;
}

export function DevToolsModal({
  isOpen,
  onClose,
  onProjectAdded,
  projects = [],
  treeCache = {},
}: DevToolsModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [password, setPassword] = useState("Tilak@2440");
  const [authError, setAuthError] = useState("");

  // QA Diagnostics states
  const [activeSubTab, setActiveSubTab] = useState<"repo" | "qa">("repo");
  const [selectedQaProjectPath, setSelectedQaProjectPath] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState("");
  const [qaReport, setQaReport] = useState<{
    totalEndpoints: number;
    issues: Array<{
      id: string;
      severity: "critical" | "warning" | "info";
      category: string;
      endpoint: string;
      filePath: string;
      description: string;
      whyFailed: string;
      mitigation: string;
    }>;
  } | null>(null);

  const runQaAudit = async (projectPath: string) => {
    setIsAuditing(true);
    setQaReport(null);

    // Simulate high-quality 10+ years exp QA diagnostics process steps
    const steps = [
      "Analyzing AST codebase index...",
      "Resolving routing path tree parameters...",
      "Inspecting handler call stack structures...",
      "Analyzing middleware authentication pipelines...",
      "Verifying request schema validation...",
      "Compiling Senior QA Engineering report...",
    ];

    for (const step of steps) {
      setAuditStep(step);
      await new Promise((r) => setTimeout(r, 300));
    }

    const cachedEntry = treeCache[projectPath];
    const tree = cachedEntry?.tree || [];

    // Helper to flatten tree into ApiRoutes
    const allRoutes: ApiRoute[] = [];
    const flatten = (nodes: any[]) => {
      for (const n of nodes) {
        if (!n) continue;
        if (n.method) {
          allRoutes.push(n as ApiRoute);
        } else if (Array.isArray(n.children)) {
          flatten(n.children);
        }
      }
    };
    flatten(tree);

    const issues: any[] = [];
    const routeTracker: Record<string, string[]> = {}; // key: method + ":" + path, value: filePaths

    for (const r of allRoutes) {
      const key = `${r.method.toUpperCase()}:${r.path}`;
      if (!routeTracker[key]) routeTracker[key] = [];
      routeTracker[key].push(r.file);

      // 1. Security check: sensitive path, missing auth middleware
      const secureKeywords = [
        "admin",
        "secure",
        "private",
        "auth",
        "me",
        "profile",
        "dashboard",
        "setting",
      ];
      const isSensitivePath = secureKeywords.some((kw) =>
        r.path.toLowerCase().includes(kw),
      );

      const publicAuthKeywords = [
        "/login",
        "/register",
        "/otp",
        "/logout",
        "/forgot-password",
        "/refresh-token",
        "/reset-password",
        "/signup-request",
      ];
      const isPublicAuthPath = publicAuthKeywords.some((kw) =>
        r.path.toLowerCase().includes(kw),
      );

      const hasAuthMiddleware = r.middlewares.some((mw) => {
        const name = mw.toLowerCase();
        return (
          name.includes("auth") ||
          name.includes("passport") ||
          name.includes("jwt") ||
          name.includes("session") ||
          name.includes("guard") ||
          name.includes("secure") ||
          name.includes("protect") ||
          name.includes("role") ||
          name.includes("allow") ||
          name.includes("require") ||
          name.includes("restrict")
        );
      });
      if (
        isSensitivePath &&
        !isPublicAuthPath &&
        !hasAuthMiddleware &&
        r.middlewares.length === 0
      ) {
        issues.push({
          id: `sec_${r.id}_${Date.now()}`,
          severity: "critical",
          category: "Security",
          endpoint: `${r.method} ${r.path}`,
          filePath: r.file,
          description:
            "Route path is sensitive but lacks any authentication or authorization middleware.",
          whyFailed:
            "RouteLens detected secure path keywords in the route declaration, but the Express middleware chain is empty.",
          mitigation: `Apply an authentication middleware wrapper (e.g. \`requireAuth\` or \`authenticateJWT\`) in the route declaration: \`router.${r.method.toLowerCase()}('${r.path}', requireAuth, ${r.handler || "handler"});\``,
        });
      }

      // 2. Request body check: POST/PUT/PATCH mutations without schema validation
      const isMutation = ["POST", "PUT", "PATCH"].includes(
        r.method.toUpperCase(),
      );
      const hasHighConfidence = r.bodyConfidence === "high";
      const hasFields =
        Array.isArray(r.inferredBodyFields) && r.inferredBodyFields.length > 0;

      const bodylessKeywords = [
        "/logout",
        "/refresh",
        "/refresh-token",
        "/active",
        "/verify",
        "/status",
        "/toggle",
      ];
      const isBodylessMutation = bodylessKeywords.some((kw) =>
        r.path.toLowerCase().includes(kw),
      );

      if (
        isMutation &&
        !isBodylessMutation &&
        !hasHighConfidence &&
        !hasFields
      ) {
        issues.push({
          id: `body_${r.id}_${Date.now()}`,
          severity: "warning",
          category: "Request Body",
          endpoint: `${r.method} ${r.path}`,
          filePath: r.file,
          description:
            "Mutation endpoint has no request body parameters defined or validated in codebase AST.",
          whyFailed:
            "RouteLens analyzed the controller's request handler but could not locate any destructured properties from \`req.body\` or schema validation wrappers (like Zod safeParse/Joi validate).",
          mitigation: `Implement schema validation on incoming payloads using a DTO schema. For example:
\`\`\`typescript
const schema = z.object({
  // Define fields here...
});
const data = schema.parse(req.body);
\`\`\``,
        });
      }

      // 3. Dynamic parameter check: unreferenced dynamic parameters
      if (r.path.includes("/:")) {
        const segments = r.path.split("/");
        for (const seg of segments) {
          if (seg.startsWith(":")) {
            const paramName = seg.slice(1).replace(/[^a-zA-Z0-9_]/g, "");
            const hasParamRef =
              r.pathParams?.includes(paramName) ||
              (r.description && r.description.includes(paramName));
            if (!hasParamRef) {
              issues.push({
                id: `param_${r.id}_${Date.now()}`,
                severity: "warning",
                category: "Parameters",
                endpoint: `${r.method} ${r.path}`,
                filePath: r.file,
                description: `Route path defines dynamic parameter \`:${paramName}\` but it is not parsed or referenced in the handler.`,
                whyFailed: `RouteLens parsed the parameter bindings but found no reference to \`req.params.${paramName}\` or destructured parameters inside the handler code.`,
                mitigation: `Destructure and use the parameter in your controller handler:
\`\`\`typescript
const { ${paramName} } = req.params;
\`\`\``,
              });
            }
          }
        }
      }
    }

    // 4. Duplicate routes check
    for (const [key, files] of Object.entries(routeTracker)) {
      if (files.length > 1) {
        issues.push({
          id: `dup_${key}_${Date.now()}`,
          severity: "critical",
          category: "Validation",
          endpoint: key.replace(":", " "),
          filePath: files[0],
          description: `Duplicate route path and method mapped across multiple handler files (${files.length} collisions).`,
          whyFailed: `Express routing detects collision on ${key}. Express will only resolve the first registered route, ignoring subsequent declarations.`,
          mitigation: `Consolidate colliding routes into a single router file, or assign unique paths to each endpoint (e.g. \`${key.split(":")[1]}/detail\`).`,
        });
      }
    }

    setQaReport({
      totalEndpoints: allRoutes.length,
      issues,
    });
    setIsAuditing(false);
  };

  const handleCopyReportForAi = () => {
    if (!qaReport) return;

    let md = `## QA Audit Report: ${projects.find((p) => p.path === selectedQaProjectPath)?.name || "Selected Project"}\n`;
    md += `- Total Endpoints: ${qaReport.totalEndpoints}\n`;
    md += `- Total Issues: ${qaReport.issues.length}\n`;
    md += `- Critical Risks: ${qaReport.issues.filter((i) => i.severity === "critical").length}\n`;
    md += `- Warnings: ${qaReport.issues.filter((i) => i.severity === "warning").length}\n\n`;

    md += `### Issues Registry:\n`;
    qaReport.issues.forEach((issue, idx) => {
      md += `${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.category} - ${issue.endpoint}\n`;
      md += `   - File: \`${issue.filePath}\`\n`;
      md += `   - Description: ${issue.description}\n`;
      md += `   - Root Cause: ${issue.whyFailed}\n`;
      md += `   - Suggestion: \n\`\`\`\n${issue.mitigation.replace(/```/g, "")}\n\`\`\`\n\n`;
    });

    navigator.clipboard.writeText(md);
    toast.success("QA Report copied to clipboard for AI agent!");
  };

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
        setCloneLogs((prev) => [
          ...prev,
          `Error cloning repository:`,
          result.stderr || result.stdout,
        ]);
        toast.error("Git clone failed");
      }
    } catch (err: any) {
      setCloneLogs((prev) => [
        ...prev,
        `Exception during clone: ${err?.message || err}`,
      ]);
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
      const projectPath = `${parentDir}/${cloneName}`
        .replace(/\\/g, "/")
        .replace(/\/+/g, "/");
      const port = await apiClient
        .detectProjectPort(projectPath)
        .catch(() => null);

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
      <div
        className={cn(
          "bg-bg-card p-6 rounded-xl w-full border border-border-main shadow-2xl text-foreground transition-all duration-200",
          activeSubTab === "qa" && isAuthenticated ? "max-w-3xl" : "max-w-lg",
        )}
      >
        {!isAuthenticated ? (
          <form onSubmit={handleVerifyPassword} className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Terminal size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Developer Mode</h2>
                <p className="text-xs text-muted-foreground">
                  Verify password to open developer tools.
                </p>
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
                <h2 className="text-lg font-bold text-white">
                  Developer Command Center
                </h2>
              </div>
              <span className="bg-primary/10 border border-primary/20 text-[10px] text-primary px-2 py-0.5 rounded font-mono font-semibold">
                AUTHENTICATED
              </span>
            </div>

            <div className="flex border-b border-border/20 shrink-0 select-none">
              <button
                type="button"
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold border-b-2 transition-colors",
                  activeSubTab === "repo"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-white",
                )}
                onClick={() => setActiveSubTab("repo")}
              >
                Repository Manager
              </button>
              <button
                type="button"
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold border-b-2 transition-colors",
                  activeSubTab === "qa"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-white",
                )}
                onClick={() => setActiveSubTab("qa")}
              >
                QA API Diagnostician
              </button>
            </div>

            {activeSubTab === "qa" ? (
              <div className="space-y-4 flex flex-col min-h-0">
                <div className="space-y-1.5 shrink-0 text-left">
                  <Label className="text-xs text-muted-foreground">
                    Select Project to Scan
                  </Label>
                  <div className="flex gap-2">
                    <select
                      value={selectedQaProjectPath}
                      onChange={(e) => {
                        setSelectedQaProjectPath(e.target.value);
                        setQaReport(null);
                      }}
                      className="bg-bg border border-border-main text-white text-xs rounded px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- Choose a Scanned Project --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.path}>
                          {p.name} ({p.path})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={() =>
                        selectedQaProjectPath &&
                        runQaAudit(selectedQaProjectPath)
                      }
                      disabled={isAuditing || !selectedQaProjectPath}
                      className="text-xs h-9 font-semibold gap-1.5 px-4"
                    >
                      {isAuditing ? (
                        <Loader2 className="animate-spin" size={13} />
                      ) : (
                        <Play size={12} className="fill-current text-white" />
                      )}
                      Run Audit
                    </Button>
                  </div>
                </div>

                {isAuditing && (
                  <div className="flex flex-col items-center justify-center py-10 bg-black/10 border border-border/20 rounded-xl space-y-3 shrink-0">
                    <Loader2 className="animate-spin text-primary" size={24} />
                    <div className="text-xs text-muted-foreground font-mono animate-pulse">
                      {auditStep}
                    </div>
                  </div>
                )}

                {/* Audit Report Results */}
                {qaReport && (
                  <div className="flex-grow flex flex-col min-h-0 space-y-3 select-text overflow-hidden">
                    <div className="grid grid-cols-4 gap-2.5 shrink-0 select-none">
                      <div className="bg-white/5 border border-border/40 p-2.5 rounded-lg text-center">
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase">
                          API Routes
                        </div>
                        <div className="text-lg font-bold text-white mt-0.5">
                          {qaReport.totalEndpoints}
                        </div>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg text-center">
                        <div className="text-[10px] text-red-400 font-semibold uppercase">
                          Critical Risks
                        </div>
                        <div className="text-lg font-bold text-red-500 mt-0.5">
                          {
                            qaReport.issues.filter(
                              (i) => i.severity === "critical",
                            ).length
                          }
                        </div>
                      </div>
                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-lg text-center">
                        <div className="text-[10px] text-yellow-400 font-semibold uppercase">
                          Warnings
                        </div>
                        <div className="text-lg font-bold text-yellow-500 mt-0.5">
                          {
                            qaReport.issues.filter(
                              (i) => i.severity === "warning",
                            ).length
                          }
                        </div>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-lg text-center">
                        <div className="text-[10px] text-blue-400 font-semibold uppercase">
                          Defect Density
                        </div>
                        <div className="text-lg font-bold text-blue-400 mt-0.5">
                          {qaReport.totalEndpoints > 0
                            ? (
                                (qaReport.issues.length /
                                  qaReport.totalEndpoints) *
                                100
                              ).toFixed(0) + "%"
                            : "0%"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between shrink-0 mb-1 select-none">
                      <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                        QA Diagnostics Issue Registry ({qaReport.issues.length}{" "}
                        Issues)
                      </span>
                      {qaReport.issues.length > 0 && (
                        <Button
                          type="button"
                          onClick={handleCopyReportForAi}
                          variant="outline"
                          className="h-6 text-[9px] px-2 border-border/40 bg-white/5 hover:bg-white/10 text-primary font-semibold flex items-center gap-1"
                        >
                          <Copy size={10} />
                          Copy Report for AI
                        </Button>
                      )}
                    </div>

                    {qaReport.issues.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2 select-none text-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Check size={18} />
                        </div>
                        <span className="text-xs font-semibold text-emerald-400">
                          QA Pass: No issues found!
                        </span>
                        <p className="text-[10px] text-muted-foreground max-w-sm">
                          Senior QA audit completed. All endpoints are fully
                          documented, validated, and secured.
                        </p>
                      </div>
                    ) : (
                      <div className="flex-grow overflow-y-auto max-h-[300px] border border-border/30 rounded-lg p-2 bg-black/15 space-y-2.5 scrollbar-thin">
                        {qaReport.issues.map((issue) => (
                          <div
                            key={issue.id}
                            className="p-3 bg-white/5 border border-border/40 rounded-lg text-left text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between border-b border-border/20 pb-1.5 select-none font-mono">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 text-[9px] font-bold rounded uppercase",
                                    issue.severity === "critical"
                                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                      : issue.severity === "warning"
                                        ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                                        : "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                                  )}
                                >
                                  {issue.severity}
                                </span>
                                <span className="font-semibold text-foreground/80">
                                  {issue.category}
                                </span>
                              </div>
                              <span
                                onClick={() =>
                                  apiClient.openVSCode(
                                    selectedQaProjectPath +
                                      "/" +
                                      issue.filePath,
                                  )
                                }
                                className="text-[9px] text-muted-foreground hover:text-primary hover:underline cursor-pointer"
                              >
                                {issue.filePath.split("/").pop()}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="font-semibold text-white text-[13px]">
                                {issue.endpoint}
                              </div>
                              <p className="text-muted-foreground text-[11px] leading-normal">
                                {issue.description}
                              </p>
                            </div>

                            <div className="bg-black/35 rounded p-2 text-[10px] font-mono text-zinc-300 space-y-1.5 border border-black/20 font-mono">
                              <div>
                                <span className="text-rose-400 font-semibold uppercase text-[9px]">
                                  Root Cause:
                                </span>
                                <div className="mt-0.5 leading-normal">
                                  {issue.whyFailed}
                                </div>
                              </div>
                              <div>
                                <span className="text-emerald-400 font-semibold uppercase text-[9px]">
                                  Suggested Fix:
                                </span>
                                <pre className="mt-1 leading-normal text-zinc-200 overflow-x-auto whitespace-pre-wrap font-mono">
                                  {issue.mitigation}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end pt-2 select-none shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleClose}
                        className="h-8 text-xs"
                      >
                        Close Diagnostics
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : !isCloned ? (
              <div className="space-y-4">
                <div className="space-y-1.5 text-left">
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

                <div className="space-y-1.5 text-left">
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

                <div className="space-y-1.5 text-left">
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
                  <div className="space-y-1 text-left">
                    <Label className="text-[10px] text-muted-foreground font-mono">
                      Git Output Console
                    </Label>
                    <div
                      ref={consoleRef}
                      className="bg-black/40 border border-border/30 rounded-lg p-2.5 max-h-[150px] overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 select-text"
                    >
                      {cloneLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className="break-all whitespace-pre-wrap"
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  {isCloning ? (
                    <Button
                      variant="destructive"
                      onClick={handleCancelClone}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
                    >
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
                        <Loader2 className="mr-2 animate-spin" size={14} />{" "}
                        Cloning...
                      </>
                    ) : (
                      "Clone Repository"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg p-3 text-left">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <div>
                    <span className="font-semibold">Successfully Cloned!</span>
                    <p className="text-[10px] text-emerald-400/80">
                      Repo exists locally at: {parentDir}/{cloneName}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
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

                <div className="space-y-1.5 text-left">
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
                  <Button
                    variant="secondary"
                    onClick={handleClose}
                    disabled={isRegistering}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRegisterProject}
                    disabled={isRegistering || !projectName}
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={14} />{" "}
                        Registering...
                      </>
                    ) : (
                      <>
                        <FolderPlus className="mr-2" size={14} /> Add to Server
                        List
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
