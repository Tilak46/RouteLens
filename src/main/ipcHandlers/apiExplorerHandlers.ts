import { ipcMain } from "electron";
import { scanProjectForRoutes } from "../lib/apiScanner";
import {
  ApiFolder,
  ApiHttpRequest,
  ApiHttpResponse,
  ApiKeyValueRow,
} from "../../types";
import { performance } from "node:perf_hooks";

export function registerApiExplorerHandlers() {
  ipcMain.handle(
    "api-explorer:scan-project",
    async (_, projectPath: string) => {
      console.log(`[IPC] Received scan-project request for: ${projectPath}`);
      if (!projectPath) {
        return { tree: [], logs: ["No project path provided"] };
      }

      try {
        const result = await scanProjectForRoutes(projectPath);
        return result;
      } catch (err) {
        console.error("Scan failed", err);
        return { tree: [], logs: [`Scan failed: ${err}`] };
      }
    },
  );

  ipcMain.handle(
    "api-explorer:run-request",
    async (_, request: ApiHttpRequest): Promise<ApiHttpResponse> => {
      const started = performance.now();

      try {
        if (!request || !request.url) {
          return {
            ok: false,
            status: 0,
            statusText: "Invalid Request",
            timeMs: Math.round(performance.now() - started),
            sizeBytes: 0,
            headers: {},
            bodyText: "",
            error: "Missing request.url",
          };
        }

        const method = String(request.method || "GET").toUpperCase();

        const url = new URL(String(request.url));
        const addQueryRows = (rows: ApiKeyValueRow[] | undefined) => {
          if (!Array.isArray(rows)) return;
          for (const row of rows) {
            if (!row || row.enabled === false) continue;
            const k = String(row.key || "").trim();
            if (!k) continue;
            url.searchParams.append(k, String(row.value ?? ""));
          }
        };

        addQueryRows(request.query);

        const headers: Record<string, string> = {};
        const addHeaderRows = (rows: ApiKeyValueRow[] | undefined) => {
          if (!Array.isArray(rows)) return;
          for (const row of rows) {
            if (!row || row.enabled === false) continue;
            const k = String(row.key || "").trim();
            if (!k) continue;
            headers[k] = String(row.value ?? "");
          }
        };
        addHeaderRows(request.headers);

        // Apply auth
        const auth = request.auth as any;
        if (auth?.type === "bearer") {
          const token = String(auth.token || "").trim();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } else if (auth?.type === "basic") {
          const username = String(auth.username ?? "");
          const password = String(auth.password ?? "");
          const b64 = Buffer.from(`${username}:${password}`, "utf8").toString(
            "base64",
          );
          headers["Authorization"] = `Basic ${b64}`;
        } else if (auth?.type === "apiKey") {
          const key = String(auth.key || "").trim();
          const value = String(auth.value ?? "");
          const loc = auth.in;
          if (key) {
            if (loc === "query") {
              url.searchParams.append(key, value);
            } else {
              headers[key] = value;
            }
          }
        }

        // Body
        let body: string | undefined;
        const bodyCfg = request.body as any;
        if (method !== "GET" && method !== "HEAD") {
          if (bodyCfg?.mode === "json") {
            body = String(bodyCfg.text ?? "");
            if (
              !Object.keys(headers).some(
                (h) => h.toLowerCase() === "content-type",
              )
            ) {
              headers["Content-Type"] = "application/json";
            }
          } else if (bodyCfg?.mode === "text") {
            body = String(bodyCfg.text ?? "");
            if (
              !Object.keys(headers).some(
                (h) => h.toLowerCase() === "content-type",
              )
            ) {
              headers["Content-Type"] = "text/plain";
            }
          } else if (bodyCfg?.mode === "form") {
            const params = new URLSearchParams();
            const fields = Array.isArray(bodyCfg.fields) ? bodyCfg.fields : [];
            for (const row of fields) {
              if (!row || row.enabled === false) continue;
              const k = String(row.key || "").trim();
              if (!k) continue;
              params.append(k, String(row.value ?? ""));
            }
            body = params.toString();
            if (
              !Object.keys(headers).some(
                (h) => h.toLowerCase() === "content-type",
              )
            ) {
              headers["Content-Type"] =
                "application/x-www-form-urlencoded;charset=UTF-8";
            }
          }
        }

        const controller = new AbortController();
        const timeoutMs =
          typeof request.timeoutMs === "number" && request.timeoutMs > 0
            ? request.timeoutMs
            : 30_000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let res: Response;
        try {
          res = await fetch(url.toString(), {
            method,
            headers,
            body,
            signal: controller.signal,
          } as any);
        } finally {
          clearTimeout(timer);
        }

        const bodyText = await res.text();
        const ended = performance.now();
        const sizeBytes = Buffer.byteLength(bodyText, "utf8");

        const responseHeaders: Record<string, string> = {};
        for (const [k, v] of (res.headers as any).entries()) {
          responseHeaders[String(k)] = String(v);
        }

        const contentType = String(res.headers.get("content-type") || "");
        let parsedJson: unknown | undefined;
        if (contentType.toLowerCase().includes("application/json")) {
          try {
            parsedJson = bodyText ? JSON.parse(bodyText) : null;
          } catch {
            parsedJson = undefined;
          }
        }

        return {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          timeMs: Math.round(ended - started),
          sizeBytes,
          headers: responseHeaders,
          bodyText,
          parsedJson,
        };
      } catch (err: any) {
        const ended = performance.now();
        return {
          ok: false,
          status: 0,
          statusText: "Network Error",
          timeMs: Math.round(ended - started),
          sizeBytes: 0,
          headers: {},
          bodyText: "",
          error: String(err?.message || err),
        };
      }
    },
  );
}
