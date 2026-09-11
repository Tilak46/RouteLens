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
  abortSignal?: AbortSignal,
): Promise<{ tree: ApiFolder[]; logs: string[]; potentialRoutesCount: number; detectedRoutesCount: number; cancelled?: boolean }> {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  log(`[OmniRoute Engine] Starting universal AST scan for: ${projectPath}`);

  if (abortSignal?.aborted) {
    return { tree: [], logs: ["Scan cancelled by user before start"], potentialRoutesCount: 0, detectedRoutesCount: 0, cancelled: true };
  }

  let lastActivityTimestamp = Date.now();
  let watchdogInterval: NodeJS.Timeout | null = null;
  let watchdogReject: ((err: Error) => void) | null = null;

  const INACTIVITY_LIMIT_MS = 60_000; // 60 seconds of total silence = deadlock
  const watchdogPromise = new Promise<never>((_, reject) => {
    watchdogReject = reject;
  });

  watchdogInterval = setInterval(() => {
    if (abortSignal?.aborted) {
      if (watchdogReject) {
        watchdogReject(new Error("Scan cancelled by user"));
      }
      return;
    }
    const idleTime = Date.now() - lastActivityTimestamp;
    if (idleTime > INACTIVITY_LIMIT_MS) {
      if (watchdogReject) {
        watchdogReject(new Error(`Inactivity Watchdog: Scanner stalled with no progress for ${Math.round(idleTime / 1000)}s`));
      }
    }
  }, 2000);

  const heartbeat = () => {
    lastActivityTimestamp = Date.now();
  };

  try {
    const t0 = performance.now();
    const scanPromise = (async () => {
      const result = await scanOmniRoutes(projectPath, {
        mode: "ast",
        abortSignal,
        onHeartbeat: heartbeat,
      });
      const durationMs = Math.round(performance.now() - t0);

      if (abortSignal?.aborted) {
        log(`[OmniRoute Engine] Scan was cancelled by user after ${durationMs}ms.`);
        return {
          tree: [],
          logs,
          potentialRoutesCount: 0,
          detectedRoutesCount: 0,
          cancelled: true,
        };
      }

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
        potentialRoutesCount: apiRoutes.length,
        detectedRoutesCount: apiRoutes.length,
        cancelled: false,
      };
    })();

    return await Promise.race([scanPromise, watchdogPromise]);
  } catch (error: any) {
    if (abortSignal?.aborted || error?.message?.includes("cancelled by user")) {
      log(`[OmniRoute Engine] Scan cancelled by user.`);
      return { tree: [], logs, potentialRoutesCount: 0, detectedRoutesCount: 0, cancelled: true };
    }
    const errorMsg = `Failed to scan project: ${error?.message || error}`;
    console.error(errorMsg);
    logs.push(errorMsg);
    return { tree: [], logs, potentialRoutesCount: 0, detectedRoutesCount: 0 };
  } finally {
    if (watchdogInterval) clearInterval(watchdogInterval);
  }
}
