import path from "node:path";
import type { Method } from "../../../types";
import type { FileCandidate, OmniRoute } from "./types";
import { joinUrl, cleanPath, SymbolicMountLinker } from "./mountLinker";

function stableId(file: string, method: string, routePath: string): string {
  const raw = `${file}|${method}|${routePath}`;
  return `omni_${Buffer.from(raw).toString("base64url")}`;
}

export function fastMatchRoutes(
  candidate: FileCandidate,
  mountLinker?: SymbolicMountLinker,
): OmniRoute[] {
  const routes: OmniRoute[] = [];
  const { content, filePath, language, relativePath } = candidate;

  // -------------------------------------------------------------
  // 1. JavaScript / TypeScript: Express, Fastify, Hono, Custom
  // -------------------------------------------------------------
  if (language === "javascript" || language === "typescript" || language === "tsx") {
    // A. Method calls on ANY router/app variable where first arg is a string starting with /
    // e.g. adminProtectedRouter.get('/accounts', ...) or router.post('/login', ...)
    const standardCallRegex =
      /(?:^|[^a-zA-Z0-9_.])([a-zA-Z0-9_$]+)\.(get|post|put|delete|patch|options|head)\s*\(\s*(['"`])(\/[^'"`]*)\3/gi;

    let match: RegExpExecArray | null;
    while ((match = standardCallRegex.exec(content)) !== null) {
      const routerVar = match[1];
      const method = match[2].toUpperCase() as Method;
      const subPath = match[4];

      const prefixes = mountLinker
        ? mountLinker.getPrefixesForRouter(filePath, routerVar)
        : new Set(["/"]);

      for (const pfx of prefixes) {
        const fullPath = joinUrl(pfx, subPath);
        routes.push({
          id: stableId(filePath, method, fullPath),
          framework: "express",
          method,
          path: fullPath,
          file: filePath,
          confidence: "high",
          source: "fast_matcher",
        });
      }
    }

    // B. Chained routes: router.route('/path').get(...).post(...)
    const chainedRouteRegex =
      /(?:^|[^a-zA-Z0-9_.])([a-zA-Z0-9_$]+)\.route\s*\(\s*(['"`])(\/[^'"`]*)\2\s*\)((?:\s*\.(?:get|post|put|delete|patch)\s*\([^)]*\))+)/gi;

    let chainMatch: RegExpExecArray | null;
    while ((chainMatch = chainedRouteRegex.exec(content)) !== null) {
      const routerVar = chainMatch[1];
      const basePath = chainMatch[3];
      const methodCalls = chainMatch[4];

      const prefixes = mountLinker
        ? mountLinker.getPrefixesForRouter(filePath, routerVar)
        : new Set(["/"]);

      const methodRegex = /\.(get|post|put|delete|patch)\s*\(/gi;
      let mMatch: RegExpExecArray | null;
      while ((mMatch = methodRegex.exec(methodCalls)) !== null) {
        const method = mMatch[1].toUpperCase() as Method;
        for (const pfx of prefixes) {
          const fullPath = joinUrl(pfx, basePath);
          routes.push({
            id: stableId(filePath, method, fullPath),
            framework: "express",
            method,
            path: fullPath,
            file: filePath,
            confidence: "high",
            source: "fast_matcher",
          });
        }
      }
    }

    // C. Next.js App Router (export async function GET / export const POST)
    if (relativePath.includes("/app/") && /\/route\.[jt]sx?$/.test(relativePath)) {
      const nextExportRegex =
        /\bexport\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b/g;
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
    // @(anything).(get|post|put|delete|patch)("/path")
    const pyDecoratorRegex =
      /@(?:[a-zA-Z0-9_.]+)\.(get|post|put|delete|patch)\s*\(\s*(['"])([^'"]+)\2/gi;
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
    // (anything).(GET|POST|PUT|DELETE|PATCH)("/path", ...)
    const goMethodRegex =
      /\b[a-zA-Z0-9_]+\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*(["'])([^"']+)\2/g;
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
