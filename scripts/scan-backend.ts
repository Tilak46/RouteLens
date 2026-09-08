import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

import { scanProjectAst } from "../src/main/lib/scanner/core/scanner";
import {
  expressParser,
  nextAppParser,
  nextParser,
  nestParser,
} from "../src/main/lib/scanner/parsers";

import type { ApiFolder, ApiRoute } from "../src/types";
import { isRoute } from "../src/types";
import {
  buildTreeFromRoutePaths,
  normalizePathSegments,
  toTitleCaseFromSlug,
} from "../src/shared/apiTree";

type Args = {
  projectPath: string;
  jsonOut?: string;
  maxExamples: number;
  redact: boolean;
  tree: boolean;
  treeDepth: number;
  treeLimit: number;
  treeSort: boolean;
};

function stableHash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  const out: Partial<Args> = {
    maxExamples: 12,
    redact: false,
    tree: false,
    treeDepth: 6,
    treeLimit: 80,
    treeSort: false,
  };

  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json" || a === "--out") {
      out.jsonOut = args[i + 1];
      i++;
      continue;
    }
    if (a === "--max") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) out.maxExamples = v;
      i++;
      continue;
    }
    if (a === "--redact") {
      out.redact = true;
      continue;
    }
    if (a === "--tree") {
      out.tree = true;
      continue;
    }
    if (a === "--tree-depth") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v >= 0) out.treeDepth = v;
      i++;
      continue;
    }
    if (a === "--tree-limit") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) out.treeLimit = v;
      i++;
      continue;
    }
    if (a === "--tree-sort") {
      out.treeSort = true;
      continue;
    }
    positionals.push(a);
  }

  const projectPath = positionals[0];
  if (!projectPath) {
    throw new Error(
      "Usage: npm run scan:backend -- <path-to-backend> [--json <file>] [--max <n>] [--redact] [--tree] [--tree-depth <n>] [--tree-limit <n>] [--tree-sort]",
    );
  }

  return {
    projectPath,
    jsonOut: out.jsonOut,
    maxExamples: out.maxExamples ?? 12,
    redact: out.redact ?? false,
    tree: out.tree ?? false,
    treeDepth: out.treeDepth ?? 6,
    treeLimit: out.treeLimit ?? 80,
    treeSort: out.treeSort ?? false,
  };
}

function toDisplayName(method: string, fullPath: string): string {
  const cleaned = String(fullPath || "")
    .split("?")[0]
    .split("#")[0];
  const parts = cleaned.split("/").filter(Boolean);
  const leaf = parts.length ? parts[parts.length - 1] : undefined;
  return leaf ? `${leaf}` : `${cleaned || "/"}`;
}

function countRoutes(node: ApiFolder | ApiRoute): number {
  if (isRoute(node)) return 1;
  let count = 0;
  for (const child of node.children) count += countRoutes(child);
  return count;
}

function printTree(
  nodes: ApiFolder[],
  opts: {
    maxDepth: number;
    maxChildrenPerFolder: number;
    sort: boolean;
    redact: boolean;
  },
) {
  const routeCountCache = new Map<string, number>();

  const getRouteCount = (node: ApiFolder | ApiRoute): number => {
    const key = (node as any).id;
    if (typeof key === "string" && routeCountCache.has(key)) {
      return routeCountCache.get(key)!;
    }
    const computed = countRoutes(node);
    if (typeof key === "string") routeCountCache.set(key, computed);
    return computed;
  };

  const stableHash = (s: string) =>
    crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

  const label = (s: string) =>
    opts.redact ? `<redacted:${stableHash(s)}>` : s;

  const getSortedChildren = (children: (ApiFolder | ApiRoute)[]) => {
    if (!opts.sort) return children;
    return [...children].sort((a, b) => {
      const aIsRoute = isRoute(a);
      const bIsRoute = isRoute(b);
      if (aIsRoute !== bIsRoute) return aIsRoute ? 1 : -1;
      if (!aIsRoute && !bIsRoute) {
        return a.name.localeCompare(b.name);
      }
      const ar = a as ApiRoute;
      const br = b as ApiRoute;
      const byMethod = String(ar.method).localeCompare(String(br.method));
      if (byMethod !== 0) return byMethod;
      return String(ar.path).localeCompare(String(br.path));
    });
  };

  const printNode = (
    node: ApiFolder | ApiRoute,
    prefix: string,
    isLast: boolean,
    depth: number,
  ) => {
    const branch = isLast ? "└─ " : "├─ ";
    if (isRoute(node)) {
      const routeLabel = opts.redact
        ? `${String(node.method)} ${label(node.path)}`
        : `${node.name}  (${node.path})`;
      console.log(prefix + branch + routeLabel);
      return;
    }

    const folderCount = getRouteCount(node);
    console.log(prefix + branch + `${label(node.name)} (${folderCount})`);

    if (depth >= opts.maxDepth) {
      const nextPrefix = prefix + (isLast ? "   " : "│  ");
      console.log(nextPrefix + "└─ … (depth limit)");
      return;
    }

    const nextPrefix = prefix + (isLast ? "   " : "│  ");
    const children = getSortedChildren(node.children);
    const toShow = children.slice(0, opts.maxChildrenPerFolder);
    for (let i = 0; i < toShow.length; i++) {
      const child = toShow[i];
      const childIsLast =
        i === toShow.length - 1 && children.length <= toShow.length;
      printNode(child, nextPrefix, childIsLast, depth + 1);
    }
    if (children.length > toShow.length) {
      console.log(
        nextPrefix +
          `└─ +${children.length - toShow.length} more… (use --tree-limit to increase)`,
      );
    }
  };

  for (let i = 0; i < nodes.length; i++) {
    printNode(nodes[i], "", i === nodes.length - 1, 0);
  }
}

async function main() {
  const {
    projectPath,
    jsonOut,
    maxExamples,
    redact,
    tree,
    treeDepth,
    treeLimit,
    treeSort,
  } = parseArgs(process.argv);
  const rootPath = path.resolve(projectPath);

  const startedAt = Date.now();
  const result = await scanProjectAst(rootPath, [
    expressParser,
    nextParser,
    nextAppParser,
    nestParser,
  ]);
  const ms = Date.now() - startedAt;

  const routes = result.routes;

  if (tree) {
    const apiRoutes: ApiRoute[] = routes.map((r) => ({
      id: r.id,
      name: toDisplayName(r.method, r.path),
      method: r.method as any,
      path: r.path,
      file: path.relative(rootPath, r.file).replace(/\\/g, "/"),
      handler: r.handler,
      middlewares: r.middlewares,
    }));

    const apiTree = buildTreeFromRoutePaths(apiRoutes);
    console.log("\n--- API Tree ---");
    printTree(apiTree, {
      maxDepth: treeDepth,
      maxChildrenPerFolder: treeLimit,
      sort: treeSort,
      redact,
    });
  }

  const byFramework = new Map<string, number>();
  const byMethod = new Map<string, number>();
  const byTopFolder = new Map<string, number>();

  // duplicates by method+path (across files/handlers)
  const byMethodPath = new Map<
    string,
    { method: string; path: string; files: Set<string> }
  >();

  for (const r of routes) {
    byFramework.set(r.framework, (byFramework.get(r.framework) ?? 0) + 1);
    byMethod.set(r.method, (byMethod.get(r.method) ?? 0) + 1);

    const segs = normalizePathSegments(r.path);
    const top = segs[0] ? toTitleCaseFromSlug(segs[0]) : "(root)";
    byTopFolder.set(top, (byTopFolder.get(top) ?? 0) + 1);

    const key = `${r.method} ${r.path}`;
    const entry = byMethodPath.get(key) ?? {
      method: r.method,
      path: r.path,
      files: new Set<string>(),
    };
    entry.files.add(path.relative(rootPath, r.file).replace(/\\/g, "/"));
    byMethodPath.set(key, entry);
  }

  const duplicates = Array.from(byMethodPath.values())
    .filter((d) => d.files.size > 1)
    .sort((a, b) => b.files.size - a.files.size);

  const topFolders = Array.from(byTopFolder.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  const fmtKeyCount = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

  const displayRoot = redact ? `<redacted:${stableHash(rootPath)}>` : rootPath;

  console.log("\n=== DevDash API Scan Report ===");
  console.log(`Project: ${displayRoot}`);
  console.log(`Time: ${ms} ms`);
  console.log(`Routes (deduped): ${routes.length}`);
  console.log(`Frameworks: ${fmtKeyCount(byFramework) || "(none)"}`);
  console.log(`Methods: ${fmtKeyCount(byMethod) || "(none)"}`);
  console.log(
    `Top folders: ${topFolders
      .slice(0, 12)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")}`,
  );

  if (duplicates.length) {
    console.log(`\nDuplicates by method+path: ${duplicates.length}`);
    for (const d of duplicates.slice(0, Math.min(25, maxExamples))) {
      const p = redact ? `<redacted:${stableHash(d.path)}>` : d.path;
      const files = redact
        ? `<files:${d.files.size}>`
        : Array.from(d.files).slice(0, 6).join(", ") +
          (d.files.size > 6 ? " ..." : "");
      console.log(`- ${d.method} ${p}  (files=${d.files.size})  ${files}`);
    }
  } else {
    console.log("\nDuplicates by method+path: 0");
  }

  // Print some examples for the largest top folders
  console.log("\nExamples:");
  const topFolderSet = new Set(topFolders.slice(0, 8).map(([k]) => k));
  const examples: string[] = [];
  for (const r of routes) {
    const segs = normalizePathSegments(r.path);
    const top = segs[0] ? toTitleCaseFromSlug(segs[0]) : "(root)";
    if (!topFolderSet.has(top)) continue;

    const p = redact ? `<redacted:${stableHash(r.path)}>` : r.path;
    examples.push(`${top}: ${r.method} ${p}`);
    if (examples.length >= maxExamples) break;
  }
  for (const e of examples) console.log(`- ${e}`);

  if (jsonOut) {
    const payload = {
      project: redact ? stableHash(rootPath) : rootPath,
      scannedAt: new Date().toISOString(),
      timeMs: ms,
      routeCount: routes.length,
      byFramework: Object.fromEntries(byFramework),
      byMethod: Object.fromEntries(byMethod),
      byTopFolder: Object.fromEntries(byTopFolder),
      duplicates: duplicates.map((d) => ({
        method: d.method,
        path: redact ? stableHash(d.path) : d.path,
        fileCount: d.files.size,
        files: redact ? [] : Array.from(d.files),
      })),
      routes: routes.map((r) => ({
        id: r.id,
        framework: r.framework,
        method: r.method,
        path: redact ? stableHash(r.path) : r.path,
        file: redact
          ? stableHash(r.file)
          : path.relative(rootPath, r.file).replace(/\\/g, "/"),
        handler: redact ? undefined : r.handler,
        middlewares: redact ? undefined : r.middlewares,
        description: r.description,
        pathParams: r.pathParams,
        inferredBodyFields: r.inferredBodyFields,
        inferredQueryFields: r.inferredQueryFields,
      })),
      logs: result.logs,
    };

    const outPath = path.resolve(jsonOut);
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    await fs.promises.writeFile(
      outPath,
      JSON.stringify(payload, null, 2),
      "utf-8",
    );
    console.log(`\nWrote JSON: ${outPath}`);
  }

  // Print scanner logs last (useful for debugging)
  console.log("\n--- Scanner Logs (tail) ---");
  for (const line of result.logs.slice(-30)) console.log(line);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
