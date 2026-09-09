import path from "node:path";
import type { Method } from "../../../types";
import type { FileCandidate, OmniRoute } from "./types";

function stableId(file: string, method: string, routePath: string): string {
  const raw = `${file}|${method}|${routePath}`;
  return `omni_${Buffer.from(raw).toString("base64url")}`;
}

function cleanPath(p: string): string {
  let cleaned = p.trim().replace(/^["'`]|["'`]$/g, "");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return cleaned.replace(/\/+/g, "/");
}

export function fastMatchRoutes(candidate: FileCandidate): OmniRoute[] {
  const routes: OmniRoute[] = [];
  const { content, filePath, language, relativePath } = candidate;

  // -------------------------------------------------------------
  // 1. JavaScript / TypeScript: Express, Fastify, Hono, Router
  // -------------------------------------------------------------
  if (language === "javascript" || language === "typescript") {
    // A. Standard Express/Fastify calls: (app|router|api|v1|server).(get|post|put|delete|patch)('/path', ...)
    const standardCallRegex =
      /\b(?:app|router|api|server|v\d+)\.(get|post|put|delete|patch)\s*\(\s*(['"`])([^'"`]+)\2/gi;
    let match: RegExpExecArray | null;
    while ((match = standardCallRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase() as Method;
      const rawPath = match[3];
      routes.push({
        id: stableId(filePath, method, cleanPath(rawPath)),
        framework: "express",
        method,
        path: cleanPath(rawPath),
        file: filePath,
        confidence: "high",
        source: "fast_matcher",
      });
    }

    // B. Chained routes: router.route('/path').get(...).post(...)
    const chainedRouteRegex =
      /\.(?:route)\s*\(\s*(['"`])([^'"`]+)\1\s*\)((?:\s*\.(?:get|post|put|delete|patch)\s*\([^)]*\))+)/gi;
    let chainMatch: RegExpExecArray | null;
    while ((chainMatch = chainedRouteRegex.exec(content)) !== null) {
      const basePath = chainMatch[2];
      const methodCalls = chainMatch[3];
      const methodRegex = /\.(get|post|put|delete|patch)\s*\(/gi;
      let mMatch: RegExpExecArray | null;
      while ((mMatch = methodRegex.exec(methodCalls)) !== null) {
        const method = mMatch[1].toUpperCase() as Method;
        routes.push({
          id: stableId(filePath, method, cleanPath(basePath)),
          framework: "express",
          method,
          path: cleanPath(basePath),
          file: filePath,
          confidence: "high",
          source: "fast_matcher",
        });
      }
    }

    // C. Next.js App Router (export async function GET / export const POST)
    if (relativePath.includes("/app/") && /\/route\.[jt]sx?$/.test(relativePath)) {
      const nextExportRegex =
        /\bexport\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|DELETE|PATCH)\b/g;
      let nextMatch: RegExpExecArray | null;
      const routeSegment = relativePath
        .split("/app/")[1]
        .replace(/\/route\.[jt]sx?$/, "");
      const appPath = "/" + routeSegment;
      while ((nextMatch = nextExportRegex.exec(content)) !== null) {
        const method = nextMatch[1].toUpperCase() as Method;
        routes.push({
          id: stableId(filePath, method, cleanPath(appPath)),
          framework: "next-app",
          method,
          path: cleanPath(appPath),
          file: filePath,
          confidence: "high",
          source: "fast_matcher",
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Python: FastAPI, Flask
  // -------------------------------------------------------------
  if (language === "python") {
    // @(router|app).(get|post|put|delete|patch)("/path")
    const pyDecoratorRegex =
      /@(?:router|app|api)\.(get|post|put|delete|patch)\s*\(\s*(['"])([^'"]+)\2/gi;
    let pyMatch: RegExpExecArray | null;
    while ((pyMatch = pyDecoratorRegex.exec(content)) !== null) {
      const method = pyMatch[1].toUpperCase() as Method;
      const rawPath = pyMatch[3];
      routes.push({
        id: stableId(filePath, method, cleanPath(rawPath)),
        framework: "fastapi",
        method,
        path: cleanPath(rawPath),
        file: filePath,
        confidence: "high",
        source: "fast_matcher",
      });
    }
  }

  // -------------------------------------------------------------
  // 3. Go: Gin, Fiber, Echo
  // -------------------------------------------------------------
  if (language === "go") {
    // (r|v1|group|router).(GET|POST|PUT|DELETE|PATCH)("/path", ...)
    const goMethodRegex =
      /\b(?:r|router|api|v\d+|group|auth)\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*(["'])([^"']+)\2/g;
    let goMatch: RegExpExecArray | null;
    while ((goMatch = goMethodRegex.exec(content)) !== null) {
      const method = goMatch[1].toUpperCase() as Method;
      const rawPath = goMatch[3];
      routes.push({
        id: stableId(filePath, method, cleanPath(rawPath)),
        framework: "gin",
        method,
        path: cleanPath(rawPath),
        file: filePath,
        confidence: "high",
        source: "fast_matcher",
      });
    }
  }

  return routes;
}
