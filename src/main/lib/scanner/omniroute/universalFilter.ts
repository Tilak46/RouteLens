import path from "node:path";
import fs from "node:fs";
import type { FileCandidate } from "./types";

export const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".java",
  ".rs",
  ".rb",
  ".php",
  ".cs",
]);

export const UNIVERSAL_IGNORED_DIRECTORIES = new Set([
  // Node / JavaScript / TypeScript
  "node_modules",
  ".pnpm-store",
  ".yarn",
  // Python environments, caches & distributions
  ".venv",
  "venv",
  "env",
  ".env",
  "virtualenv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  // Java / Kotlin (Maven & Gradle)
  ".gradle",
  ".m2",
  // C# / .NET
  "bin",
  "obj",
  ".vs",
  // Rust / Cargo
  "target",
  // Go / PHP / Ruby
  "vendor",
  ".bundle",
  // Build outputs & coverage
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".svelte-kit",
  ".docusaurus",
  "coverage",
  "public",
  "tmp",
  "temp",
  // Version Control & IDEs
  ".git",
  ".svn",
  ".hg",
  ".idea",
  ".vscode",
]);

export const IGNORED_DIRECTORY_SEGMENTS = UNIVERSAL_IGNORED_DIRECTORIES;

export function getFileLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".ts":
      return "typescript";
    case ".tsx":
      return "tsx";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".rs":
      return "rust";
    case ".rb":
      return "ruby";
    case ".php":
      return "php";
    case ".cs":
      return "csharp";
    default:
      return "unknown";
  }
}

export function isClientUiPath(filePath: string, rootPath: string): boolean {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, "/").toLowerCase();
  const fileName = path.basename(rel);
  const ext = path.extname(filePath).toLowerCase();

  // 1. Next.js App Router contract:
  // In App Router, backend APIs are strictly route.ts / route.js / route.tsx / route.jsx.
  // All page.*, layout.*, template.*, loading.*, error.*, not-found.* and non-route JSX/TSX are UI views.
  const isAppRouter = rel.includes("/app/") || rel.startsWith("app/");
  if (isAppRouter) {
    if (fileName === "route.ts" || fileName === "route.js" || fileName === "route.tsx" || fileName === "route.jsx") {
      return false;
    }
    if (
      fileName.startsWith("page.") ||
      fileName.startsWith("layout.") ||
      fileName.startsWith("template.") ||
      fileName.startsWith("loading.") ||
      fileName.startsWith("error.") ||
      fileName.startsWith("not-found.")
    ) {
      return true;
    }
    if (ext === ".tsx" || ext === ".jsx") {
      return true;
    }
  }

  // 2. Next.js Pages Router contract:
  // In Pages Router, backend APIs are strictly under pages/api/. All other pages/* are React UI views.
  const isPagesRouter = rel.includes("/pages/") || rel.startsWith("pages/");
  if (isPagesRouter) {
    if (rel.includes("/pages/api/") || rel.startsWith("pages/api/")) {
      return false;
    }
    return true;
  }

  // 3. Invariant: Dedicated backend routes, controllers, and router modules
  if (
    fileName.startsWith("route.") ||
    fileName.startsWith("routes.") ||
    fileName.includes("controller.") ||
    fileName.includes("router.") ||
    rel.includes("/routes/") ||
    rel.includes("/endpoints/") ||
    rel.includes("/controllers/") ||
    rel.includes("server/web/api")
  ) {
    return false;
  }

  // 4. Pure backend languages
  const isPureBackendCode =
    ext === ".go" ||
    ext === ".java" ||
    ext === ".cs" ||
    ext === ".rs" ||
    ext === ".php" ||
    ext === ".rb";

  if (isPureBackendCode) {
    return false;
  }

  // 5. Client directory conventions
  const clientDirNames = new Set([
    "clientapp",
    "client",
    "frontend",
    "ui",
    "web",
    "components",
    "views",
    "hooks",
    "locales",
    "assets",
    "styles",
  ]);

  const segments = rel.split("/");
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (clientDirNames.has(seg)) {
      return true;
    }
  }

  // 6. Standalone UI components (Vue, Svelte)
  if (ext === ".vue" || ext === ".svelte") {
    return true;
  }

  return false;
}

export function isTestFilePath(filePath: string, rootPath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedFile = path.resolve(filePath);
  const rel = path.relative(resolvedRoot, resolvedFile).replace(/\\/g, "/").toLowerCase();
  const fileName = path.basename(rel);

  // 1. Explicit test file name suffixes across languages
  if (
    fileName.endsWith("_test.go") ||
    fileName.endsWith(".test.ts") ||
    fileName.endsWith(".test.js") ||
    fileName.endsWith(".spec.ts") ||
    fileName.endsWith(".spec.js") ||
    fileName.endsWith(".e2e-spec.ts") ||
    fileName.endsWith(".e2e-spec.js") ||
    fileName.endsWith(".test.tsx") ||
    fileName.endsWith(".spec.tsx") ||
    fileName.endsWith(".test.jsx") ||
    fileName.endsWith(".spec.jsx") ||
    fileName.endsWith("test.java") ||
    fileName.endsWith("tests.java") ||
    fileName.endsWith("test.cs") ||
    fileName.endsWith("tests.cs") ||
    fileName.endsWith("test.php") ||
    fileName.endsWith("tests.php") ||
    fileName.endsWith("_test.rb") ||
    fileName.endsWith("_spec.rb") ||
    fileName.endsWith("_test.rs") ||
    fileName.endsWith("_tests.rs") ||
    fileName === "tests.rs" ||
    fileName.startsWith("test_") ||
    fileName.endsWith("_test.py")
  ) {
    return true;
  }

  // 2. Relative test directory segments inside the project
  const isFsApiRoute =
    (rel.includes("/app/") || rel.startsWith("app/")) &&
    (fileName === "route.ts" || fileName === "route.js" || fileName === "route.tsx" || fileName === "route.jsx");
  const isPagesApiRoute = rel.includes("/pages/api/");
  const isBackendApiRoute = isFsApiRoute || isPagesApiRoute;

  const segments = rel.split("/");
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (
      seg === "tests" ||
      seg === "test" ||
      seg === "__tests__" ||
      seg === "spec" ||
      seg === "specs" ||
      seg === "e2e" ||
      seg === "cypress"
    ) {
      // In Next.js App Router or Pages Router, a folder named "test" or "tests" inside an API directory
      // (e.g. app/api/webhooks/test/route.ts) is an actual API endpoint subpath, not a test suite.
      if (isBackendApiRoute && (seg === "test" || seg === "tests")) {
        continue;
      }
      return true;
    }
  }

  return false;
}

export function isCandidateFilePath(filePath: string, rootPath: string): boolean {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, "/");
  const segments = rel.split("/");

  // Check if inside any ignored directory
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (IGNORED_DIRECTORY_SEGMENTS.has(seg)) {
      // Build output folders (dist, build, out) are only ignored at project/monorepo root.
      // If a nested module is named "build" (e.g. router/build/build.go), it is a feature package.
      if ((seg === "build" || seg === "dist" || seg === "out") && i > 1) {
        continue;
      }
      return false;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Evaluates whether a source file is a potential API route candidate.
 * 
 * Safety Guarantee:
 * This filter is intentionally over-inclusive (inclusion-biased).
 * A file is only rejected if it mathematically CANNOT be an API controller
 * (i.e. zero URL paths and zero routing/HTTP keywords, and not in an API directory).
 */
export function analyzeRouteCandidate(
  filePath: string,
  content: string,
  rootPath: string,
): FileCandidate {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, "/");
  const lowerRel = rel.toLowerCase();
  const language = getFileLanguage(filePath);
  const isClient = isClientUiPath(filePath, rootPath);
  const isTest = isTestFilePath(filePath, rootPath);

  // Files in route-specific folders are high-probability candidates
  const isNamedRouteLocation =
    lowerRel.startsWith("routes/") ||
    lowerRel.includes("/routes/") ||
    lowerRel.startsWith("controllers/") ||
    lowerRel.includes("/controllers/") ||
    lowerRel.startsWith("endpoints/") ||
    lowerRel.includes("/endpoints/") ||
    lowerRel.startsWith("api/") ||
    lowerRel.includes("/api/") ||
    lowerRel.endsWith(".route.js") ||
    lowerRel.endsWith(".route.ts") ||
    lowerRel.endsWith(".router.js") ||
    lowerRel.endsWith(".router.ts") ||
    lowerRel.endsWith(".controller.ts") ||
    lowerRel.endsWith(".controller.js") ||
    lowerRel.endsWith("controller.cs") ||
    lowerRel.endsWith(".controller.cs") ||
    lowerRel.endsWith("/route.js") ||
    lowerRel.endsWith("/route.ts");

  // Invariant: Pure Tree-sitter CST execution.
  // We do NOT use fragile regex bouncers to gatekeep files.
  // Every backend source file (not client UI, not test) is directly parsed by Tree-sitter.
  const hasRouteSignals = !isClient && !isTest;
  const routeScore = isNamedRouteLocation ? 5 : 1;

  return {
    filePath,
    relativePath: rel,
    language,
    content,
    routeScore,
    hasRouteSignals,
    isClientUi: isClient,
    isTestFile: isTest,
  };
}
