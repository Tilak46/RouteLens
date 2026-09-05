import { ipcMain } from "electron";
import { scanProjectForRoutes } from "../lib/apiScanner";
import {
  ApiFolder,
  ApiHttpRequest,
  ApiHttpResponse,
  ApiKeyValueRow,
  CookieItem,
} from "../../types";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { CookieJarService } from "../services/cookieJar";

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
    "api-explorer:detect-port",
    async (_, projectPath: string): Promise<number | null> => {
      if (!projectPath) return null;
      try {
        // 1. Try to find the port in env files
        const envFiles = [".env", ".env.local", ".env.development", ".env.dev", ".env.example"];
        for (const file of envFiles) {
          const fullPath = path.join(projectPath, file);
          if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, "utf-8");
            const matches = content.match(/^(?:PORT|APP_PORT|SERVER_PORT|BACKEND_PORT)\s*=\s*(\d+)/im);
            if (matches && matches[1]) {
              const port = parseInt(matches[1], 10);
              if (port > 0 && port < 65536) {
                console.log(`[PortDetector] Found port ${port} in env file: ${file}`);
                return port;
              }
            }
          }
        }

        // 2. Try to find in package.json scripts or config
        const pkgPath = path.join(projectPath, "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkgContent = fs.readFileSync(pkgPath, "utf-8");
          try {
            const pkg = JSON.parse(pkgContent);
            if (pkg.scripts) {
              for (const [_, scriptVal] of Object.entries(pkg.scripts)) {
                if (typeof scriptVal === "string") {
                  // check for PORT=1234 or --port 1234 or -p 1234
                  const m1 = scriptVal.match(/(?:PORT|APP_PORT|SERVER_PORT|BACKEND_PORT)\s*=\s*(\d+)/i);
                  if (m1 && m1[1]) return parseInt(m1[1], 10);

                  const m2 = scriptVal.match(/(?:--port|-p)\s+(\d+)/i);
                  if (m2 && m2[1]) return parseInt(m2[1], 10);
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }

        // 3. Scan common source files like server.ts/js, app.ts/js, index.ts/js
        const srcFiles = [
          path.join(projectPath, "src", "server.ts"),
          path.join(projectPath, "src", "server.js"),
          path.join(projectPath, "src", "app.ts"),
          path.join(projectPath, "src", "app.js"),
          path.join(projectPath, "src", "index.ts"),
          path.join(projectPath, "src", "index.js"),
          path.join(projectPath, "server.ts"),
          path.join(projectPath, "server.js"),
          path.join(projectPath, "app.ts"),
          path.join(projectPath, "app.js"),
          path.join(projectPath, "index.ts"),
          path.join(projectPath, "index.js"),
        ];

        for (const file of srcFiles) {
          if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, "utf-8");
            // Match things like: app.listen(8000), port = 8000, || 8000
            const listenMatch = content.match(/listen\(\s*(\d+)\s*\)/i);
            if (listenMatch && listenMatch[1]) {
              return parseInt(listenMatch[1], 10);
            }
            const portMatch = content.match(/(?:PORT|port)\s*=\s*(\d+)/);
            if (portMatch && portMatch[1]) {
              return parseInt(portMatch[1], 10);
            }
            const orPortMatch = content.match(/(?:PORT|port)\s*\|\|\s*(\d+)/);
            if (orPortMatch && orPortMatch[1]) {
              return parseInt(orPortMatch[1], 10);
            }
          }
        }
      } catch (err) {
        console.error(`[PortDetector] Error detecting port in ${projectPath}:`, err);
      }
      return null;
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

        // Enable self-signed certificates for local HTTPS development
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        // Safely normalize URL (auto-prepend http:// if scheme is missing)
        let rawUrl = String(request.url || "").trim();
        if (!/^https?:\/\//i.test(rawUrl)) {
          rawUrl = `http://${rawUrl}`;
        }

        const url = new URL(rawUrl);
        const addQueryRows = (rows: ApiKeyValueRow[] | undefined) => {
          if (!Array.isArray(rows)) return;
          for (const row of rows) {
            if (!row) continue;
            const k = String(row.key || "").trim();
            if (!k) continue;
            if (row.enabled === false) {
              // Delete disabled query param from URL so disabling works
              url.searchParams.delete(k);
            } else {
              // Use set instead of append to prevent duplicate query params
              url.searchParams.set(k, String(row.value ?? ""));
            }
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
              url.searchParams.set(key, value);
            } else {
              headers[key] = value;
            }
          }
        }

        // Body
        let body: any;
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
          } else if (bodyCfg?.mode === "javascript") {
            body = String(bodyCfg.text ?? "");
            if (
              !Object.keys(headers).some(
                (h) => h.toLowerCase() === "content-type",
              )
            ) {
              headers["Content-Type"] = "application/javascript";
            }
          } else if (bodyCfg?.mode === "html") {
            body = String(bodyCfg.text ?? "");
            if (
              !Object.keys(headers).some(
                (h) => h.toLowerCase() === "content-type",
              )
            ) {
              headers["Content-Type"] = "text/html";
            }
          } else if (bodyCfg?.mode === "xml") {
            body = String(bodyCfg.text ?? "");
            if (
              !Object.keys(headers).some(
                (h) => h.toLowerCase() === "content-type",
              )
            ) {
              headers["Content-Type"] = "application/xml";
            }
          } else if (bodyCfg?.mode === "urlencoded" || bodyCfg?.mode === "form") {
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
          } else if (bodyCfg?.mode === "form-data") {
            const formData = new FormData();
            const fields = Array.isArray(bodyCfg.fields) ? bodyCfg.fields : [];
            for (const row of fields) {
              if (!row || row.enabled === false) continue;
              const k = String(row.key || "").trim();
              if (!k) continue;
              if (row.type === "file" && row.value) {
                try {
                  const fs = require("node:fs");
                  const path = require("node:path");
                  const fileBuffer = fs.readFileSync(row.value);
                  const fileName = path.basename(row.value);
                  const fileBlob = new Blob([fileBuffer]);
                  formData.append(k, fileBlob, fileName);
                } catch (err) {
                  console.error("Failed to append file to FormData:", err);
                  formData.append(k, String(row.value ?? ""));
                }
              } else {
                formData.append(k, String(row.value ?? ""));
              }
            }
            body = formData as any;
          } else if (bodyCfg?.mode === "binary") {
            const filePath = String(bodyCfg.filePath || "").trim();
            if (filePath) {
              try {
                const fs = require("node:fs");
                body = fs.readFileSync(filePath);
                if (
                  !Object.keys(headers).some(
                    (h) => h.toLowerCase() === "content-type",
                  )
                ) {
                  headers["Content-Type"] = "application/octet-stream";
                }
              } catch (err) {
                console.error("Failed to read binary file:", err);
              }
            }
          }
        }

        // If body is FormData, delete Content-Type from headers so fetch can set boundary automatically
        if (body instanceof FormData) {
          delete headers["Content-Type"];
          delete headers["content-type"];
        }

        // Auto-inject matching cookies from CookieJar
        const jarCookieStr = CookieJarService.getCookieHeader(url.toString());
        if (jarCookieStr) {
          const userCookieKey = Object.keys(headers).find(
            (k) => k.toLowerCase() === "cookie"
          );
          if (userCookieKey) {
            headers[userCookieKey] = `${headers[userCookieKey]}; ${jarCookieStr}`;
          } else {
            headers["Cookie"] = jarCookieStr;
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

        // Extract and store Set-Cookie headers into CookieJar
        let rawSetCookies: string[] = [];
        if (typeof (res.headers as any).getSetCookie === "function") {
          rawSetCookies = (res.headers as any).getSetCookie();
        } else {
          const single = res.headers.get("set-cookie");
          if (single) rawSetCookies = [single];
        }

        const responseCookies = CookieJarService.saveSetCookieHeaders(
          rawSetCookies,
          url.toString()
        );

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
          cookies: responseCookies,
        };
      } catch (err: any) {
        const ended = performance.now();
        const cause = err?.cause?.message || (err?.cause ? String(err.cause) : "");
        const errorDetail = cause ? `${err?.message || "Network Error"}: ${cause}` : String(err?.message || err);
        return {
          ok: false,
          status: 0,
          statusText: "Network Error",
          timeMs: Math.round(ended - started),
          sizeBytes: 0,
          headers: {},
          bodyText: "",
          error: errorDetail,
        };
      }
    },
  );

  // --- Cookie Jar IPC Handlers ---
  ipcMain.handle("cookies:get-all", async () => {
    return CookieJarService.getAllCookies();
  });

  ipcMain.handle("cookies:get-for-url", async (_, targetUrl: string) => {
    return CookieJarService.getCookiesForUrl(targetUrl);
  });

  ipcMain.handle("cookies:set-cookie", async (_, cookie: CookieItem) => {
    return CookieJarService.setCookie(cookie);
  });

  ipcMain.handle("cookies:delete-cookie", async (_, domain: string, name: string) => {
    return CookieJarService.deleteCookie(domain, name);
  });

  ipcMain.handle("cookies:delete-domain", async (_, domain: string) => {
    return CookieJarService.deleteDomain(domain);
  });

  ipcMain.handle("cookies:clear-all", async () => {
    return CookieJarService.clearAll();
  });

  ipcMain.handle("cookies:get-allowlist", async () => {
    return CookieJarService.getAllowlist();
  });

  ipcMain.handle("cookies:set-allowlist", async (_, domains: string[]) => {
    return CookieJarService.setAllowlist(domains);
  });
}
