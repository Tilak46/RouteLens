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

export const IGNORED_DIRECTORY_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  "target",
  "bin",
  "obj",
  ".vscode",
  ".idea",
]);

const HTTP_VERB_REGEX = /\b(get|post|put|delete|patch|options|head)\b/i;
const ROUTING_KEYWORD_REGEX = /\b(route|router|endpoint|controller|api|handler|group|mount|app|register)\b/i;
const PATH_LITERAL_REGEX = /["'`]\/[a-zA-Z0-9_\-\/:{}]*["'`]/;

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

  // Files in route-specific folders are high-probability candidates
  const isNamedRouteLocation =
    lowerRel.includes("/routes/") ||
    lowerRel.includes("/controllers/") ||
    lowerRel.includes("/endpoints/") ||
    lowerRel.includes("/api/") ||
    lowerRel.endsWith(".route.js") ||
    lowerRel.endsWith(".route.ts") ||
    lowerRel.endsWith(".router.js") ||
    lowerRel.endsWith(".router.ts") ||
    lowerRel.endsWith("/route.js") ||
    lowerRel.endsWith("/route.ts");

  const hasVerb = HTTP_VERB_REGEX.test(content);
  const hasKeyword = ROUTING_KEYWORD_REGEX.test(content);
  const hasPath = PATH_LITERAL_REGEX.test(content);

  let routeScore = 0;
  if (hasPath) routeScore += 2;
  if (hasVerb) routeScore += 2;
  if (hasKeyword) routeScore += 1;
  if (isNamedRouteLocation) routeScore += 3;

  // A file is a route candidate if:
  // 1. It has a path string literal AND either an HTTP verb or routing keyword, OR
  // 2. It is located inside an API/route directory and has route keywords
  const hasRouteSignals =
    (hasPath && (hasVerb || hasKeyword)) ||
    (isNamedRouteLocation && (hasVerb || hasKeyword));

  return {
    filePath,
    relativePath: rel,
    language,
    content,
    routeScore,
    hasRouteSignals,
  };
}
