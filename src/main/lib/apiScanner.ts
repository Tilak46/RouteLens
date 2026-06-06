import path from "node:path";
import { ApiFolder, ApiRoute } from "../../types";
import { scanProjectAst } from "./scanner/core/scanner";
import { expressParser, nextAppParser, nextParser } from "./scanner/parsers";
import type { DetectedRoute } from "./scanner/core/types";

import { buildTreeFromRoutePaths } from "../../shared/apiTree";
import { maybeApplyAiRouteNames } from "./apiExplorer/aiRouteNaming";

function toDisplayName(method: string, fullPath: string): string {
  const cleaned = String(fullPath || "")
    .split("?")[0]
    .split("#")[0];
  const parts = cleaned.split("/").filter(Boolean);
  const leaf = parts.length ? parts[parts.length - 1] : undefined;
  return leaf ? `${leaf}` : `${cleaned || "/"}`;
}

function mapDetectedToApiRoute(
  projectPath: string,
  r: DetectedRoute,
): ApiRoute {
  const fileRel = path.relative(projectPath, r.file).replace(/\\/g, "/");
  const middlewares = Array.isArray(r.middlewares) ? r.middlewares : [];
  return {
    id: r.id,
    name: toDisplayName(r.method, r.path),
    method: r.method,
    path: r.path,
    file: fileRel,
    handler: r.handler,
    middlewares,
    description: r.description,
    pathParams: r.pathParams,
    inferredBodyFields: r.inferredBodyFields,
    inferredQueryFields: r.inferredQueryFields,
  };
}

export async function scanProjectForRoutes(
  projectPath: string,
): Promise<{ tree: ApiFolder[]; logs: string[] }> {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  log(`[Scanner] (AST) Starting scan for: ${projectPath}`);
  try {
    const result = await scanProjectAst(projectPath, [
      expressParser,
      nextParser,
      nextAppParser,
    ]);

    const apiRoutes = result.routes.map((r) =>
      mapDetectedToApiRoute(projectPath, r),
    );

    const namedRoutes = await maybeApplyAiRouteNames(apiRoutes, {
      logs,
      projectPath,
    });
    const tree = buildTreeFromRoutePaths(namedRoutes);

    return { tree, logs: [...logs, ...result.logs] };
  } catch (error) {
    const errorMsg = `Failed to scan project: ${error}`;
    console.error(errorMsg);
    logs.push(errorMsg);
    return { tree: [], logs };
  }
}
