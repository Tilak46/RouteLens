import path from "node:path";
import fs from "node:fs";
import { indexProjectFiles } from "./fileIndex";
import { parseFileAstCached, getAstCacheStats } from "./astCache";
import { resolveImportToFile } from "./resolveImport";
import type { DetectedRoute, FrameworkParser, ScannerContext } from "./types";

export type ScanResult = {
  routes: DetectedRoute[];
  logs: string[];
  potentialRoutesCount: number;
};

function stableId(parts: string[]): string {
  const raw = parts.join("|");
  return `route_${Buffer.from(raw).toString("base64url")}`;
}

async function estimatePotentialRoutes(files: string[], rootPath: string): Promise<number> {
  let count = 0;
  for (const f of files) {
    const rel = path.relative(rootPath, f).replace(/\\/g, "/");
    if (
      rel.includes("node_modules") ||
      rel.includes(".next") ||
      rel.includes("dist") ||
      rel.includes("build") ||
      rel.includes(".git")
    ) {
      continue;
    }

    try {
      const code = await fs.promises.readFile(f, "utf-8");
      
      if (/\/route\.(t|j)sx?$/.test(rel) && rel.split("/").includes("app")) {
        const nextHttpRegex = /\bexport\s+(?:async\s+)?(?:function|const|let|var)\s+(GET|POST|PUT|DELETE|PATCH)\b/g;
        const matches = code.match(nextHttpRegex);
        if (matches) {
          count += matches.length;
        } else {
          const destructuringRegex = /\bexport\s+const\s*\{\s*([^}]+)\}\s*=/g;
          let destMatch;
          let foundDest = false;
          while ((destMatch = destructuringRegex.exec(code)) !== null) {
            const inner = destMatch[1];
            const parts = inner.split(",").map(p => p.trim());
            const methods = parts.filter(p => ["GET", "POST", "PUT", "DELETE", "PATCH"].includes(p.toUpperCase()));
            if (methods.length > 0) {
              count += methods.length;
              foundDest = true;
            }
          }
          if (!foundDest) {
            count += 1;
          }
        }
      }
      else if (rel.includes("pages/api/") && !/\/route\.(t|j)sx?$/.test(rel)) {
        count += 1;
      }
      else {
        const expressHttpRegex = /\b(?:app|router|route)\.(?:get|post|put|delete|patch)\s*\(/gi;
        const matches = code.match(expressHttpRegex);
        if (matches) {
          count += matches.length;
        }
      }
    } catch {
      // Ignore read/permission errors
    }
  }
  return count;
}

export async function scanProjectAst(
  rootPath: string,
  parsers: FrameworkParser[],
): Promise<ScanResult> {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  const files = await indexProjectFiles(rootPath);
  log(`[ASTScanner] Indexed ${files.length} files.`);

  const ctx: ScannerContext = {
    rootPath,
    files,
    log,
    getAst: (filePath: string) => parseFileAstCached(filePath, log),
    resolveImport: (fromFile: string, importSource: string) =>
      resolveImportToFile(fromFile, importSource),
    astStats: () => getAstCacheStats(),
  };

  const enabled: FrameworkParser[] = [];
  for (const p of parsers) {
    try {
      const ok = await p.detectProject(ctx);
      if (ok) enabled.push(p);
    } catch (err) {
      log(`[ASTScanner] detectProject failed for ${p.id}: ${String(err)}`);
    }
  }

  log(
    `[ASTScanner] Enabled parsers: ${enabled.map((p) => p.id).join(", ") || "(none)"}`,
  );

  const all: DetectedRoute[] = [];
  for (const p of enabled) {
    try {
      const routes = await p.parseRoutes(ctx);
      log(`[ASTScanner] ${p.id} produced ${routes.length} routes.`);
      all.push(...routes);
    } catch (err) {
      log(`[ASTScanner] parseRoutes failed for ${p.id}: ${String(err)}`);
    }
  }

  // Normalize + stable ids + dedupe by framework, method, and path
  const byKey = new Map<string, DetectedRoute>();
  for (const r of all) {
    const methodUpper = String(r.method || "GET").toUpperCase();
    const key = `${r.framework}|${methodUpper}|${r.path}`;
    const existing = byKey.get(key);
    if (existing) {
      const existingScore =
        (existing.handler ? 2 : 0) +
        (existing.description ? 1 : 0) +
        ((Array.isArray(existing.middlewares) && existing.middlewares.length > 0) ? 1 : 0) +
        ((Array.isArray(existing.pathParams) && existing.pathParams.length > 0) ? 1 : 0);
      const currentScore =
        (r.handler ? 2 : 0) +
        (r.description ? 1 : 0) +
        ((Array.isArray(r.middlewares) && r.middlewares.length > 0) ? 1 : 0) +
        ((Array.isArray(r.pathParams) && r.pathParams.length > 0) ? 1 : 0);
      
      if (currentScore > existingScore) {
        byKey.set(key, r);
      }
    } else {
      byKey.set(key, r);
    }
  }

  const deduped: DetectedRoute[] = [];
  for (const r of byKey.values()) {
    const rel = path.relative(rootPath, r.file).replace(/\\/g, "/");
    deduped.push({
      ...r,
      id: r.id || stableId([r.framework, r.method, r.path, rel, r.handler || ""]),
    });
  }
  const stats = ctx.astStats();
  log(
    `[ASTScanner] AST cache hits=${stats.hits} misses=${stats.misses} errors=${stats.errors}`,
  );

  const potentialCount = await estimatePotentialRoutes(files, rootPath);
  log(`[ASTScanner] Found ${potentialCount} potential routes in codebase.`);

  return { routes: deduped, logs, potentialRoutesCount: potentialCount };
}
