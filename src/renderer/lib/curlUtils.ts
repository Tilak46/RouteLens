import { ApiAuth, ApiKeyValueRow } from "../../../types";

export interface RequestSnippetParams {
  method: string;
  url: string;
  headers?: ApiKeyValueRow[];
  query?: ApiKeyValueRow[];
  bodyMode?: string;
  bodyText?: string;
  formFields?: ApiKeyValueRow[];
  urlencodedFields?: ApiKeyValueRow[];
  auth?: ApiAuth;
}

/**
 * Build the complete URL with enabled query parameters appended
 */
export function buildFullUrl(rawUrl: string, query?: ApiKeyValueRow[]): string {
  let cleanUrl = (rawUrl || "").trim();
  if (!cleanUrl) return "http://localhost:3000";
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `http://${cleanUrl}`;
  }

  try {
    const urlObj = new URL(cleanUrl);
    if (Array.isArray(query)) {
      for (const q of query) {
        if (!q || q.enabled === false) {
          if (q && q.key) urlObj.searchParams.delete(q.key);
          continue;
        }
        const k = String(q.key || "").trim();
        if (k) {
          urlObj.searchParams.set(k, String(q.value ?? ""));
        }
      }
    }
    return urlObj.toString();
  } catch {
    return cleanUrl;
  }
}

/**
 * Build resolved headers including Auth headers
 */
export function buildResolvedHeaders(
  headers?: ApiKeyValueRow[],
  auth?: ApiAuth,
  bodyMode?: string
): Record<string, string> {
  const resolved: Record<string, string> = {};

  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h && h.enabled !== false) {
        const k = String(h.key || "").trim();
        if (k) resolved[k] = String(h.value ?? "");
      }
    }
  }

  // Inject Auth
  if (auth?.type === "bearer" && auth.token) {
    resolved["Authorization"] = `Bearer ${auth.token.trim()}`;
  } else if (auth?.type === "basic") {
    const creds = `${auth.username ?? ""}:${auth.password ?? ""}`;
    try {
      resolved["Authorization"] = `Basic ${btoa(creds)}`;
    } catch {
      // Fallback
    }
  } else if (auth?.type === "apiKey" && auth.key && auth.in !== "query") {
    resolved[auth.key.trim()] = String(auth.value ?? "");
  }

  // Inject default Content-Type if missing
  const hasContentType = Object.keys(resolved).some(
    (k) => k.toLowerCase() === "content-type"
  );

  if (!hasContentType) {
    if (bodyMode === "json") {
      resolved["Content-Type"] = "application/json";
    } else if (bodyMode === "urlencoded" || bodyMode === "form") {
      resolved["Content-Type"] = "application/x-www-form-urlencoded";
    } else if (bodyMode === "text") {
      resolved["Content-Type"] = "text/plain";
    } else if (bodyMode === "javascript") {
      resolved["Content-Type"] = "application/javascript";
    } else if (bodyMode === "html") {
      resolved["Content-Type"] = "text/html";
    } else if (bodyMode === "xml") {
      resolved["Content-Type"] = "application/xml";
    }
  }

  // For multipart/form-data, do not set Content-Type header so boundary can be generated
  if (bodyMode === "form-data") {
    for (const k of Object.keys(resolved)) {
      if (k.toLowerCase() === "content-type") {
        delete resolved[k];
      }
    }
  }

  return resolved;
}

/**
 * Generate a cURL command string from request parameters
 */
export function generateCurlCommand(params: RequestSnippetParams): string {
  const method = (params.method || "GET").toUpperCase();
  const fullUrl = buildFullUrl(params.url, params.query);
  const headers = buildResolvedHeaders(params.headers, params.auth, params.bodyMode);

  const lines: string[] = [`curl --location '${fullUrl}'`];

  if (method !== "GET") {
    lines.push(`--request ${method}`);
  }

  for (const [key, value] of Object.entries(headers)) {
    lines.push(`--header '${key}: ${value.replace(/'/g, "'\\''")}'`);
  }

  if (method !== "GET" && method !== "HEAD") {
    if (
      params.bodyMode === "json" ||
      params.bodyMode === "text" ||
      params.bodyMode === "javascript" ||
      params.bodyMode === "html" ||
      params.bodyMode === "xml"
    ) {
      const body = params.bodyText || "";
      if (body.trim()) {
        lines.push(`--data-raw '${body.replace(/'/g, "'\\''")}'`);
      }
    } else if (params.bodyMode === "urlencoded" || params.bodyMode === "form") {
      const fields = (params.urlencodedFields || []).filter(
        (f) => f.enabled !== false && f.key?.trim()
      );
      for (const field of fields) {
        lines.push(
          `--data-urlencode '${field.key}=${(field.value || "").replace(/'/g, "'\\''")}'`
        );
      }
    } else if (params.bodyMode === "form-data") {
      const fields = (params.formFields || []).filter(
        (f) => f.enabled !== false && f.key?.trim()
      );
      for (const field of fields) {
        if (field.type === "file") {
          lines.push(`--form '${field.key}=@${(field.value || "").replace(/'/g, "'\\''")}'`);
        } else {
          lines.push(`--form '${field.key}="${(field.value || "").replace(/"/g, '\\"')}"'`);
        }
      }
    }
  }

  return lines.join(" \\\n  ");
}

/**
 * Generate JavaScript fetch code
 */
export function generateFetchCode(params: RequestSnippetParams): string {
  const method = (params.method || "GET").toUpperCase();
  const fullUrl = buildFullUrl(params.url, params.query);
  const headers = buildResolvedHeaders(params.headers, params.auth, params.bodyMode);

  let bodyCode = "";
  if (method !== "GET" && method !== "HEAD") {
    if (params.bodyMode === "json") {
      const body = params.bodyText || "{}";
      bodyCode = `\n  body: JSON.stringify(${body.trim() || "{}"}),`;
    } else if (params.bodyMode === "urlencoded") {
      const fields = (params.urlencodedFields || []).filter(
        (f) => f.enabled !== false && f.key?.trim()
      );
      const entries = fields.map((f) => `["${f.key}", "${f.value || ""}"]`).join(", ");
      bodyCode = `\n  body: new URLSearchParams([${entries}]),`;
    } else if (params.bodyText?.trim()) {
      bodyCode = `\n  body: ${JSON.stringify(params.bodyText)},`;
    }
  }

  return `const response = await fetch("${fullUrl}", {
  method: "${method}",
  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, "\n  ")},${bodyCode}
});

const data = await response.json();
console.log(data);`;
}

/**
 * Generate Axios code
 */
export function generateAxiosCode(params: RequestSnippetParams): string {
  const method = (params.method || "GET").toLowerCase();
  const fullUrl = buildFullUrl(params.url, params.query);
  const headers = buildResolvedHeaders(params.headers, params.auth, params.bodyMode);

  let dataCode = "";
  if (method !== "get" && method !== "head") {
    if (params.bodyMode === "json") {
      dataCode = `\n  data: ${params.bodyText?.trim() || "{}"},`;
    } else if (params.bodyText?.trim()) {
      dataCode = `\n  data: ${JSON.stringify(params.bodyText)},`;
    }
  }

  return `import axios from "axios";

const response = await axios({
  method: "${method}",
  url: "${fullUrl}",
  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, "\n  ")},${dataCode}
});

console.log(response.data);`;
}

/**
 * Generate Python requests code
 */
export function generatePythonCode(params: RequestSnippetParams): string {
  const method = (params.method || "GET").toUpperCase();
  const fullUrl = buildFullUrl(params.url, params.query);
  const headers = buildResolvedHeaders(params.headers, params.auth, params.bodyMode);

  let payloadCode = "payload = {}";
  let payloadArg = "";

  if (method !== "GET" && method !== "HEAD") {
    if (params.bodyMode === "json" && params.bodyText?.trim()) {
      payloadCode = `payload = ${params.bodyText.trim()}`;
      payloadArg = ", json=payload";
    } else if (params.bodyText?.trim()) {
      payloadCode = `payload = """${params.bodyText.replace(/"""/g, '\\"\\"\\"')}"""`;
      payloadArg = ", data=payload";
    }
  }

  const headersPy = Object.entries(headers)
    .map(([k, v]) => `    "${k}": "${v}"`)
    .join(",\n");

  return `import requests

url = "${fullUrl}"
${payloadCode}
headers = {
${headersPy}
}

response = requests.request("${method}", url, headers=headers${payloadArg})
print(response.text)`;
}

/**
 * Parse a raw cURL command into structured request parameters
 */
export function parseCurlCommand(rawCurl: string): Partial<RequestSnippetParams> | null {
  if (!rawCurl || typeof rawCurl !== "string") return null;
  const clean = rawCurl.trim();
  if (!clean.toLowerCase().startsWith("curl")) return null;

  // Normalize line continuations (\ at end of line)
  const normalized = clean.replace(/\\\r?\n/g, " ").replace(/\s+/g, " ");

  // Extract URL
  let url = "";
  const urlMatch =
    normalized.match(/curl\s+(?:--location\s+)?['"]([^'"]+)['"]/i) ||
    normalized.match(/curl\s+([^\s\-][^\s]+)/i) ||
    normalized.match(/--url\s+['"]([^'"]+)['"]/i);

  if (urlMatch && urlMatch[1]) {
    url = urlMatch[1];
  }

  // Extract Method
  let method = "GET";
  const methodMatch = normalized.match(/(?:-X|--request)\s+([A-Z]+)/i);
  if (methodMatch && methodMatch[1]) {
    method = methodMatch[1].toUpperCase();
  }

  // Extract Headers
  const headers: ApiKeyValueRow[] = [];
  const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/gi;
  let hMatch: RegExpExecArray | null;

  while ((hMatch = headerRegex.exec(normalized)) !== null) {
    const fullHeader = hMatch[1];
    const colonIdx = fullHeader.indexOf(":");
    if (colonIdx !== -1) {
      const key = fullHeader.substring(0, colonIdx).trim();
      const value = fullHeader.substring(colonIdx + 1).trim();
      headers.push({
        id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        enabled: true,
        key,
        value,
      });
    }
  }

  // Extract Body
  let bodyMode = "none";
  let bodyText = "";
  const dataMatch =
    normalized.match(/(?:--data|--data-raw|-d)\s+['"]([\s\S]*?)['"](?:\s+|$)/i);

  if (dataMatch && dataMatch[1]) {
    bodyText = dataMatch[1];
    if (method === "GET") method = "POST";
    try {
      JSON.parse(bodyText);
      bodyMode = "json";
    } catch {
      bodyMode = "text";
    }
  }

  return {
    method,
    url,
    headers,
    bodyMode,
    bodyText,
  };
}
