import path from "node:path";
import { ApiFolder, ApiRoute } from "../../types";
import { scanOmniRoutes } from "./scanner/omniroute";
import type { OmniRoute } from "./scanner/omniroute/types";
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

function mapOmniToApiRoute(
  projectPath: string,
  r: OmniRoute,
): ApiRoute {
  const fileRel = path.relative(projectPath, r.file).replace(/\\/g, "/");

  return {
    id: r.id,
    name: toDisplayName(r.method, r.path),
    method: r.method,
    path: r.path,
    file: fileRel,
    description: r.summary || `${r.framework.toUpperCase()} route`,
    pathParams: r.params,
    inferredBodyFields: r.body,
    inferredQueryFields: r.query,
    confidence: r.confidence,
    bodyConfidence: ["POST", "PUT", "PATCH"].includes(r.method)
      ? r.body && r.body.length > 0 ? "high" : "medium"
      : undefined,
  };
}

export async function scanProjectForRoutes(
  projectPath: string,
): Promise<{ tree: ApiFolder[]; logs: string[]; potentialRoutesCount: number; detectedRoutesCount: number }> {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  log(`[OmniRoute Engine] Starting universal AST scan for: ${projectPath}`);
  try {
    const t0 = performance.now();
    const fullScanPipeline = async () => {
      const result = await scanOmniRoutes(projectPath, { mode: "ast" });
      const durationMs = Math.round(performance.now() - t0);

      log(`[OmniRoute Engine] Scan completed in ${durationMs} ms. Found ${result.routes.length} routes across ${result.candidateFilesCount} candidate files.`);

      const apiRoutes = result.routes.map((r) =>
        mapOmniToApiRoute(projectPath, r),
      );

      // AI route naming is bypassed by default so the UI gets instantaneous speed (<1s)
      const namedRoutes = await maybeApplyAiRouteNames(apiRoutes, {
        logs,
        projectPath,
      });

      const tree = buildTreeFromRoutePaths(namedRoutes);

      return { 
        tree, 
        logs,
        potentialRoutesCount: Math.max(result.candidateFilesCount, apiRoutes.length),
        detectedRoutesCount: apiRoutes.length
      };
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Scanner timed out after 25 seconds")), 25000),
    );

    return await Promise.race([fullScanPipeline(), timeoutPromise]);
  } catch (error) {
    const errorMsg = `Failed to scan project: ${error}`;
    console.error(errorMsg);
    logs.push(errorMsg);
    return { tree: [], logs, potentialRoutesCount: 0, detectedRoutesCount: 0 };
  }
}
