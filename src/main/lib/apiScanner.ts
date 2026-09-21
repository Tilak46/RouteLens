import path from "node:path";
import { ApiFolder, ApiRoute } from "../../types";
import { scanOmniRoutes } from "./scanner/omniroute";
import type { OmniRoute } from "./scanner/omniroute/types";
import { computeRouteDisplayName } from "../../shared/apiTree";
import { synthesizeApiCollection } from "./collectionEngine";
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

import fs from "node:fs";
import { Worker } from "node:worker_threads";
import type { OmniScanResult } from "./scanner/omniroute/types";
import type { ScanProgressUpdate } from "../../types";

function getScannerWorkerPath(): string | null {
  const candidates = [
    path.join(__dirname, "scannerWorker.js"),
    path.join(__dirname, "../scannerWorker.js"),
    path.resolve(process.cwd(), "out/main/scannerWorker.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const unpacked = c.replace("app.asar", "app.asar.unpacked");
      if (fs.existsSync(unpacked)) return unpacked;
      return c;
    }
  }
  return null;
}

export async function scanProjectForRoutes(
  projectPath: string,
  abortSignal?: AbortSignal,
  onProgress?: (progress: ScanProgressUpdate) => void,
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
    const workerPath = getScannerWorkerPath();

    let scanPromise: Promise<{
      tree: ApiFolder[];
      logs: string[];
      potentialRoutesCount: number;
      detectedRoutesCount: number;
      cancelled?: boolean;
    }>;

    if (workerPath) {
      log(`[OmniRoute Engine] Offloading scan to background worker thread: ${workerPath}`);
      scanPromise = new Promise((resolve, reject) => {
        const worker = new Worker(workerPath);

        const cleanup = () => {
          worker.removeAllListeners();
        };

        if (abortSignal) {
          const onAbort = () => {
            log(`[OmniRoute Engine] Abort signal received. Terminating worker thread immediately.`);
            cleanup();
            worker.terminate().finally(() => {
              resolve({
                tree: [],
                logs,
                potentialRoutesCount: 0,
                detectedRoutesCount: 0,
                cancelled: true,
              });
            });
          };

          if (abortSignal.aborted) {
            onAbort();
            return;
          }
          abortSignal.addEventListener("abort", onAbort, { once: true });
        }

        worker.on("message", async (msg) => {
          if (msg.type === "heartbeat") {
            heartbeat();
          } else if (msg.type === "progress") {
            heartbeat();
            if (onProgress && msg.progress) {
              try {
                onProgress(msg.progress);
              } catch {
                // ignore
              }
            }
          } else if (msg.type === "done") {
            cleanup();
            worker.terminate();
            const result: OmniScanResult = msg.result;
            const durationMs = Math.round(performance.now() - t0);

            if (abortSignal?.aborted) {
              log(`[OmniRoute Engine] Scan was cancelled by user after ${durationMs}ms.`);
              resolve({
                tree: [],
                logs,
                potentialRoutesCount: 0,
                detectedRoutesCount: 0,
                cancelled: true,
              });
              return;
            }

            log(`[OmniRoute Engine] Background worker scan completed in ${durationMs} ms. Found ${result.routes.length} routes across ${result.candidateFilesCount} candidate files.`);

            const apiRoutes = result.routes.map((r) =>
              mapOmniToApiRoute(projectPath, r),
            );

            const namedRoutes = await maybeApplyAiRouteNames(apiRoutes, {
              logs,
              projectPath,
            });

            const tree = synthesizeApiCollection(namedRoutes, { repoRoot: projectPath });

            resolve({
              tree,
              logs,
              potentialRoutesCount: apiRoutes.length,
              detectedRoutesCount: apiRoutes.length,
              cancelled: false,
            });
          } else if (msg.type === "error") {
            cleanup();
            worker.terminate();
            reject(new Error(msg.error));
          }
        });

        worker.on("error", (err) => {
          cleanup();
          reject(err);
        });

        worker.on("exit", (code) => {
          if (code !== 0 && !abortSignal?.aborted) {
            cleanup();
            reject(new Error(`Scanner worker exited unexpectedly with code ${code}`));
          }
        });

        worker.postMessage({
          type: "start-scan",
          projectPath,
          options: {
            mode: "ast",
          },
        });
      });
    } else {
      // In-process fallback when running in scripts/dev without bundled worker
      log(`[OmniRoute Engine] Running in-process AST scan fallback.`);
      scanPromise = (async () => {
        const result = await scanOmniRoutes(projectPath, {
          mode: "ast",
          abortSignal,
          onProgress,
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

        const namedRoutes = await maybeApplyAiRouteNames(apiRoutes, {
          logs,
          projectPath,
        });

        const tree = synthesizeApiCollection(namedRoutes, { repoRoot: projectPath });

        return {
          tree,
          logs,
          potentialRoutesCount: apiRoutes.length,
          detectedRoutesCount: apiRoutes.length,
          cancelled: false,
        };
      })();
    }

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
