import path from "node:path";
import { indexProjectFiles } from "./fileIndex";
import { parseFileAstCached, getAstCacheStats } from "./astCache";
import { resolveImportToFile } from "./resolveImport";
import type { DetectedRoute, FrameworkParser, ScannerContext } from "./types";

export type ScanResult = {
  routes: DetectedRoute[];
  logs: string[];
};

function stableId(parts: string[]): string {
  const raw = parts.join("|");
  return `route_${Buffer.from(raw).toString("base64url")}`;
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

  // Normalize + stable ids + dedupe
  const byKey = new Map<string, DetectedRoute>();
  for (const r of all) {
    const rel = path.relative(rootPath, r.file).replace(/\\/g, "/");
    const key = `${r.framework}|${r.method}|${r.path}|${rel}|${r.handler || ""}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      ...r,
      id:
        r.id || stableId([r.framework, r.method, r.path, rel, r.handler || ""]),
    });
  }

  const deduped = Array.from(byKey.values());
  const stats = ctx.astStats();
  log(
    `[ASTScanner] AST cache hits=${stats.hits} misses=${stats.misses} errors=${stats.errors}`,
  );

  return { routes: deduped, logs };
}
