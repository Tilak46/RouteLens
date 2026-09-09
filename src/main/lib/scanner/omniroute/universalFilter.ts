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
  "packages",
  ".vs",
  // Rust / Cargo
  "target",
  // Go / PHP / Ruby
  "vendor",
  ".bundle",
  "pkg",
  // Build outputs & coverage
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  "public",
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
    case ".tsx":
      return "typescript";
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
  const segments = rel.split("/");
  const ext = path.extname(filePath).toLowerCase();
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

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (clientDirNames.has(seg)) {
      // Exception: pages/api in Next.js is backend API
      if (seg === "pages" && rel.includes("pages/api/")) {
        return false;
      }
      return true;
    }
  }

  if (rel.includes("/pages/") && !rel.includes("/pages/api/")) {
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
  const segments = rel.split("/");
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (
      seg === "tests" ||
      seg === "test" ||
      seg === "__tests__" ||
      seg === "spec" ||
      seg === "specs"
    ) {
      return true;
    }
  }

  return false;
}

export function isCandidateFilePath(filePath: string, rootPath: string): boolean {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, "/");
  const segments = rel.split("/");

  // Check if inside any ignored directory
  for (const seg of segments) {
    if (IGNORED_DIRECTORY_SEGMENTS.has(seg)) {
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
