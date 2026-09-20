import { parentPort } from "node:worker_threads";
import { scanOmniRoutes } from "./lib/scanner/omniroute";

if (parentPort) {
  parentPort.on("message", async (msg) => {
    if (msg.type === "start-scan") {
      try {
        const { projectPath, options } = msg;
        let lastHeartbeat = 0;
        const result = await scanOmniRoutes(projectPath, {
          ...(options || {}),
          onProgress: (progress) => {
            parentPort?.postMessage({ type: "progress", progress });
          },
          onHeartbeat: () => {
            const now = Date.now();
            if (now - lastHeartbeat >= 1000) {
              lastHeartbeat = now;
              parentPort?.postMessage({ type: "heartbeat" });
            }
          },
        });
        parentPort?.postMessage({ type: "done", result });
      } catch (err: any) {
        parentPort?.postMessage({ type: "error", error: err?.message || String(err) });
      }
    }
  });
}
