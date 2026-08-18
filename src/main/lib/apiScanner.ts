import path from "node:path";
import { ApiFolder, ApiRoute } from "../../types";
import { scanProjectAst } from "./scanner/core/scanner";
import { expressParser, nextAppParser, nextParser, nestParser } from "./scanner/parsers";
import type { DetectedRoute } from "./scanner/core/types";

import { buildTreeFromRoutePaths } from "../../shared/apiTree";
import { maybeApplyAiRouteNames } from "./apiExplorer/aiRouteNaming";

function toDisplayName(method: string, fullPath: string): string {
  const cleaned = String(fullPath || "")
    .split("?")[0]
    .split("#")[0];
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length === 0) return "/";

  const leaf = parts[parts.length - 1];

  // Express style :param or Next.js style [param] dynamic segments
  const isDynamic = leaf.startsWith(":") || (leaf.startsWith("[") && leaf.endsWith("]"));

  if (isDynamic && leaf.length > 1) {
    const paramName = leaf.startsWith(":") ? leaf.slice(1) : leaf.slice(1, -1);
    const parentSegment = parts.length > 1 ? parts[parts.length - 2] : "";

    if (parentSegment) {
      const uppercaseMethod = String(method || "GET").toUpperCase();
      
      // Singularize parent segment if plural
      let singularParent = parentSegment;
      if (parentSegment.toLowerCase().endsWith("s") && parentSegment.length > 3) {
        singularParent = parentSegment.slice(0, -1);
      }

      // Capitalize first letter of parent segment
      const capParent = singularParent.charAt(0).toUpperCase() + singularParent.slice(1);
      
      if (uppercaseMethod === "GET") {
        const isVerb = ["verify", "search", "find", "get", "check"].includes(parentSegment.toLowerCase());
        if (isVerb) {
          return `${capParent} by ${paramName}`;
        }
        return `Get ${capParent} by ${paramName}`;
      }
      if (uppercaseMethod === "DELETE") {
        return `Delete ${capParent} by ${paramName}`;
      }
      if (["PUT", "PATCH", "POST"].includes(uppercaseMethod)) {
        return `Update ${capParent} by ${paramName}`;
      }
      
      return `${capParent} by ${paramName}`;
    }
    
    return `Get by ${paramName}`;
  }

  // Standard static leaf segment - humanize it!
  const humanize = (str: string) => {
    const words = str
      .replace(/([A-Z])/g, " $1")
      .replace(/[-_]/g, " ")
      .split(" ")
      .filter(Boolean);
    return words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  return humanize(leaf);
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
      nestParser,
    ]);

    const apiRoutes = result.routes.map((r) =>
      mapDetectedToApiRoute(projectPath, r),
    );

    apiRoutes.forEach((r) => {
      log(`[Scanner Debug] Pre-AI path="${r.path}" name="${r.name}" method="${r.method}"`);
    });

    const namedRoutes = await maybeApplyAiRouteNames(apiRoutes, {
      logs,
      projectPath,
    });

    namedRoutes.forEach((r) => {
      log(`[Scanner Debug] Post-AI path="${r.path}" name="${r.name}" method="${r.method}"`);
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
