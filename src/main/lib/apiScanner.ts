import path from "node:path";
import { ApiFolder, ApiRoute } from "../../types";
import { scanOmniRoutes } from "./scanner/omniroute";
import type { OmniRoute } from "./scanner/omniroute/types";
import { buildTreeFromRoutePaths, computeRouteDisplayName } from "../../shared/apiTree";
import { maybeApplyAiRouteNames } from "./apiExplorer/aiRouteNaming";

function mapOmniToApiRoute(
  projectPath: string,
  r: OmniRoute,
): ApiRoute {
  const fileRel = path.relative(projectPath, r.file).replace(/\\/g, "/");

  return {
    id: r.id,
    name: computeRouteDisplayName({ method: r.method, path: r.path, file: fileRel }),
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
