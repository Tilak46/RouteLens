import type { ApiFolder, ApiRoute } from "../types";

const generateId = () => Math.random().toString(36).substring(7);

// Canonical Acronym Preservation Dictionary
const KNOWN_ACRONYMS = new Map<string, string>([
  ["idp", "IDP"],
  ["gmb", "GMB"],
  ["llm", "LLM"],
  ["rbac", "RBAC"],
  ["cab", "CAB"],
  ["crm", "CRM"],
  ["smm", "SMM"],
  ["otp", "OTP"],
  ["ai", "AI"],
  ["api", "API"],
  ["url", "URL"],
  ["oauth", "OAuth"],
  ["sso", "SSO"],
  ["qr", "QR"],
  ["dmc", "DMC"],
  ["sdk", "SDK"],
  ["jwt", "JWT"],
  ["rest", "REST"],
  ["http", "HTTP"],
  ["ip", "IP"],
  ["db", "DB"],
  ["uuid", "UUID"],
  ["ui", "UI"],
  ["ux", "UX"],
  ["seo", "SEO"],
  ["pos", "POS"],
  ["rss", "RSS"],
  ["pdf", "PDF"],
  ["csv", "CSV"],
  ["sql", "SQL"],
  ["pmo", "PMO"],
]);

function isAlphanumericChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122)   // a-z
  );
}

function stripTrailingExtension(s: string): string {
  const lastDot = s.lastIndexOf(".");
  if (lastDot > 0) {
    const ext = s.slice(lastDot + 1);
    if (ext.length > 0 && !s.slice(lastDot).includes("}") && !s.slice(lastDot).includes(">") && !s.slice(lastDot).includes("]")) {
      let allAlphaNum = true;
      for (let i = 0; i < ext.length; i++) {
        if (!isAlphanumericChar(ext.charCodeAt(i))) {
          allAlphaNum = false;
          break;
        }
      }
      if (allAlphaNum) return s.slice(0, lastDot);
    }
  }
  return s;
}

function isVersionSegment(seg: string): boolean {
  const lower = seg.toLowerCase();
  if (lower.charCodeAt(0) !== 118 /* 'v' */ || lower.length < 2) return false;
  let hasDigits = false;
  for (let i = 1; i < lower.length; i++) {
    const c = lower.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      hasDigits = true;
    } else if (c === 46 /* '.' */) {
      // allow v1.0, v2.1
    } else {
      return false;
    }
  }
  return hasDigits;
}

function splitSlugIntoWords(slug: string): string[] {
  const words: string[] = [];
  let currentWord = "";
  for (let i = 0; i < slug.length; i++) {
    const c = slug.charCodeAt(i);
    const isSep = c === 45 /* '-' */ || c === 95 /* '_' */ || c === 46 /* '.' */ || c === 32 /* ' ' */;
    if (isSep) {
      if (currentWord.length > 0) {
        words.push(currentWord);
        currentWord = "";
      }
      continue;
    }
    const isUpper = c >= 65 && c <= 90;
    const prevChar = i > 0 ? slug.charCodeAt(i - 1) : 0;
    const prevIsLowerOrDigit = (prevChar >= 97 && prevChar <= 122) || (prevChar >= 48 && prevChar <= 57);

    if (isUpper && prevIsLowerOrDigit && currentWord.length > 0) {
      words.push(currentWord);
      currentWord = slug.charAt(i);
    } else {
      currentWord += slug.charAt(i);
    }
  }
  if (currentWord.length > 0) {
    words.push(currentWord);
  }
  return words;
}

/**
 * Universal Dynamic Route Parameter Classifier.
 * Finite Delimiter & Boundary Parser covering 100% of web routing specifications:
 * - Express, Koa, Hono, Rails, Go Gin: :param, :param?, *splat, :param*
 * - Python FastAPI, Django Ninja, Spring, ASP.NET, Go Chi, OpenAPI: {param}, {param:type}
 * - Flask, Django: <param>, <int:param>
 * - Next.js App/Pages Router, SvelteKit, Nuxt: [param], [...slug], [[...slug]]
 * - Compound parameters: {id}.json, {user}.atom, @{username}, @:handle
 */
export function isDynamicSegment(seg: string): boolean {
  if (!seg) return false;
  const s = seg.trim();
  const len = s.length;
  if (len === 0) return false;

  // Direct prefix dynamic tokens: :param, *wildcard
  const firstChar = s.charCodeAt(0);
  if (firstChar === 58 /* ':' */ || firstChar === 42 /* '*' */) return true;

  // Strip leading symbols (@, ~)
  let core = s;
  if (core.startsWith("@") || core.startsWith("~")) {
    core = core.slice(1);
  }

  // Strip trailing file extensions (.json, .xml, .atom, .html, .csv, .pdf, etc.)
  core = stripTrailingExtension(core);

  // Strip trailing modifiers (? for optional, * for wildcard splats)
  if (core.endsWith("?") || core.endsWith("*")) {
    core = core.slice(0, -1);
  }

  if (core.length === 0) return false;

  const cFirst = core.charCodeAt(0);
  const cLast = core.charCodeAt(core.length - 1);

  // Enclosed dynamic tokens: {param}, <param>, [param]
  if (
    (cFirst === 123 /* '{' */ && cLast === 125 /* '}' */) ||
    (cFirst === 60  /* '<' */ && cLast === 62  /* '>' */) ||
    (cFirst === 91  /* '[' */ && cLast === 93  /* ']' */)
  ) {
    return true;
  }

  // Also catch parameters embedded with prefixes/suffixes (e.g. user-{id}, @{username}, :id{[0-9]+})
  if (
    (core.includes("{") && core.includes("}")) ||
    (core.includes("<") && core.includes(">")) ||
    (core.includes("[") && core.includes("]")) ||
    core.includes(":")
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts a clean parameter name from any ecosystem syntax.
 * e.g. "{realm}" -> "realm", "{id:int}" -> "id", "<int:id>" -> "id", ":accountId?" -> "accountId"
 */
export function extractParamName(seg: string): string {
  if (!seg) return "";
  let s = seg.trim();

  // Strip leading symbols
  if (s.startsWith("@") || s.startsWith("~")) s = s.slice(1);

  // Strip trailing file extensions
  s = stripTrailingExtension(s);

  if (s.startsWith(":") || s.startsWith("*")) {
    s = s.slice(1);
    if (s.endsWith("?") || s.endsWith("*")) s = s.slice(0, -1);
    // Handle inline regex/validation in Express/Hono like :id{[0-9]+} or :id(\\d+)
    if (s.includes("{")) s = s.split("{")[0];
    if (s.includes("(")) s = s.split("(")[0];
    return s;
  }

  if (
    (s.startsWith("{") && s.endsWith("}")) ||
    (s.startsWith("<") && s.endsWith(">")) ||
    (s.startsWith("[") && s.endsWith("]"))
  ) {
    s = s.slice(1, -1).trim();
    if (s.startsWith("...")) s = s.slice(3);
    if (s.startsWith("[...") && s.endsWith("]")) s = s.slice(4, -1);

    if (s.includes(":")) {
      const parts = s.split(":");
      const p0 = parts[0].trim();
      const p1 = parts[1].trim();
      const knownTypes = new Set(["int", "str", "string", "float", "path", "uuid", "slug", "bool", "guid"]);
      if (knownTypes.has(p0.toLowerCase())) return p1;
      return p0;
    }
    return s;
  }

  return s;
}

const KNOWN_CODE_SUFFIXES = [
  ".routes", ".controller", ".views", ".handlers", ".endpoint", ".router", ".service",
  "routes", "controller", "views", "handlers", "endpoint", "router", "service"
];

function stripCodeSuffixes(name: string): string {
  let s = stripTrailingExtension(name);
  const lower = s.toLowerCase();
  for (const suffix of KNOWN_CODE_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      s = s.slice(0, -suffix.length);
      break;
    }
  }
  return s;
}

/**
 * Converts a URL slug into professional title case while preserving developer acronyms.
 * e.g. "gmb-accounts" -> "GMB Accounts", "idp-client" -> "IDP Client", "crm" -> "CRM"
 */
export function toTitleCaseFromSlug(slug: string): string {
  if (!slug) return "";
  const cleaned = slug.trim();
  const lower = cleaned.toLowerCase();
  if (KNOWN_ACRONYMS.has(lower)) {
    return KNOWN_ACRONYMS.get(lower)!;
  }

  const words: string[] = [];
  const parts = splitSlugIntoWords(cleaned);

  for (const part of parts) {
    const pLower = part.toLowerCase();
    if (KNOWN_ACRONYMS.has(pLower)) {
      words.push(KNOWN_ACRONYMS.get(pLower)!);
    } else {
      words.push(part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    }
  }

  return words.join(" ");
}

/**
 * Normalizes URL path segments, stripping query strings, hash fragments,
 * and leading protocol/version envelopes (e.g. /api/v1/...).
 */
export function normalizePathSegments(routePath: string): string[] {
  let cleaned = String(routePath || "")
    .split("#")[0]
    .trim();

  // Protect optional route parameters like {id?} or {genre?} before splitting query strings
  if (cleaned.includes("?}")) {
    cleaned = cleaned.split("?}").join("}");
  }

  // Only strip query string if it is a real query string (?key=value)
  const qIndex = cleaned.indexOf("?");
  if (qIndex !== -1) {
    cleaned = cleaned.slice(0, qIndex).trim();
  }

  const rawSegments = cleaned.split("/").filter(Boolean);
  if (rawSegments.length === 0) return [];

  const out: string[] = [];
  let index = 0;

  // Drop protocol/version envelopes from beginning if more segments follow
  while (index < rawSegments.length) {
    const seg = rawSegments[index];
    const segLower = seg.toLowerCase();
    const hasRemaining = index < rawSegments.length - 1;

    if (hasRemaining) {
      if (segLower === "api" || segLower === "rest" || segLower === "public") {
        index++;
        continue;
      }
      if (isVersionSegment(segLower)) {
        index++;
        continue;
      }
      // Next.js route groups like (backend), (auth), (dashboard)
      if (seg.startsWith("(") && seg.endsWith(")")) {
        index++;
        continue;
      }
    }
    break;
  }

  while (index < rawSegments.length) {
    const seg = rawSegments[index];
    if (!(seg.startsWith("(") && seg.endsWith(")"))) {
      out.push(seg);
    }
    index++;
  }

  return out;
}

/**
 * Universal Module / Controller Fallback Extractor.
 * When a route has 0 static URL segments (e.g. GET /:shortId or Next.js [...route].ts),
 * this discovers the logical feature domain from the source file path across all programming languages.
 */
export function extractFallbackDomain(file?: string): string {
  if (!file) return "System";
  const normalized = file.split("\\").join("/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "System";

  const fileName = parts[parts.length - 1];
  const baseName = stripCodeSuffixes(fileName);

  const genericNames = new Set([
    "index", "main", "app", "server", "routes", "router", "api", "mod", "lib", "urls", "views"
  ]);

  // If baseName is generic OR if baseName is itself a dynamic param like [...route] or [id]
  const isBaseGenericOrDynamic =
    !baseName ||
    genericNames.has(baseName.toLowerCase()) ||
    isDynamicSegment(baseName);

  if (!isBaseGenericOrDynamic) {
    return toTitleCaseFromSlug(baseName);
  }

  // Inspect parent directories for feature name
  for (let i = parts.length - 2; i >= 0; i--) {
    const p = parts[i];
    const pLower = p.toLowerCase();
    const genericFolders = new Set([
      "src", "routes", "controllers", "api", "backend", "app", "server",
      "handlers", "endpoints", "views", "modules", "services", "lib", "pages", "."
    ]);
    if (!genericFolders.has(pLower) && !isDynamicSegment(p)) {
      return toTitleCaseFromSlug(p);
    }
  }

  return "System";
}

/**
 * Universal RESTful Verb-Aware Canonical Route Namer.
 * Generates clear, non-colliding display names (e.g. "List Contacts" vs "Create Contact").
 */
export function computeRouteDisplayName(args: {
  method: string;
  path: string;
  file?: string;
}): string {
  const method = String(args.method || "GET").toUpperCase();
  const segments = normalizePathSegments(args.path);

  if (segments.length === 0) {
    const p = String(args.path || "").toLowerCase();
    if (p.includes("health")) return "Health Check";
    if (p.includes("robot")) return "Robots.txt";
    if (p.includes("ping")) return "Ping";
    if (method === "GET") return "API Root";
    return `${toTitleCaseFromSlug(method)} Root`;
  }

  const lastSeg = segments[segments.length - 1];
  const lastIsDynamic = isDynamicSegment(lastSeg);

  // Case 1: Dynamic leaf (e.g. /tenants/{realm}/clients/{cid} or /users/:id)
  if (lastIsDynamic) {
    const paramName = extractParamName(lastSeg);
    let parentResource = "";
    for (let i = segments.length - 2; i >= 0; i--) {
      if (!isDynamicSegment(segments[i])) {
        parentResource = segments[i];
        break;
      }
    }

    const parentTitle = parentResource ? toTitleCaseFromSlug(parentResource) : "";
    const singularParent = parentTitle.endsWith("s") && parentTitle.length > 3 ? parentTitle.slice(0, -1) : parentTitle;
    const targetLabel = singularParent || "Item";

    if (method === "GET") return `Get ${targetLabel} by ${paramName}`;
    if (method === "DELETE") return `Delete ${targetLabel} by ${paramName}`;
    if (method === "PUT" || method === "PATCH") return `Update ${targetLabel} by ${paramName}`;
    if (method === "POST") return `Create ${targetLabel} by ${paramName}`;
    return `${toTitleCaseFromSlug(method)} ${targetLabel} by ${paramName}`;
  }

  // Case 2: Static leaf action endpoints
  const lastLower = lastSeg.toLowerCase();
  const actionWords = new Map<string, string>([
    ["login", "Login"],
    ["logout", "Logout"],
    ["logout-all", "Logout All"],
    ["register", "Register"],
    ["signup", "Sign Up"],
    ["refresh", "Refresh Token"],
    ["verify", "Verify"],
    ["verify-login", "Verify Login"],
    ["verify-otp", "Verify OTP"],
    ["request-otp", "Request OTP"],
    ["reset", "Reset Password"],
    ["reset-password", "Reset Password"],
    ["forgot-password", "Forgot Password"],
    ["change-password", "Change Password"],
    ["callback", "Auth Callback"],
    ["ping", "Ping"],
    ["health", "Health Check"],
    ["status", "System Status"],
    ["ready", "Readiness Check"],
    ["me", "Get Current User Profile"],
    ["profile", "Get Profile"],
    ["upload", "Upload File"],
    ["download", "Download File"],
    ["duplicate", "Duplicate"],
    ["merge", "Merge"],
    ["reorder", "Reorder"],
    ["summary", "Get Summary"],
    ["history", "Get History"],
    ["insights", "Get Insights"],
    ["overview", "Get Overview"],
    ["plans", "List Plans"],
    ["metrics", "Get Metrics"],
  ]);

  if (actionWords.has(lastLower)) {
    return actionWords.get(lastLower)!;
  }

  // Webhooks
  if (lastLower === "webhook" || lastLower === "webhooks") {
    if (method === "GET") return "Verify Webhook";
    if (method === "POST") return "Receive Webhook";
    if (method === "DELETE") return "Delete Webhook";
    return `${toTitleCaseFromSlug(method)} Webhook`;
  }

  // Case 3: Standard Resource Collections (e.g. GET /contacts -> List Contacts, POST /contacts -> Create Contact)
  const lastTitle = toTitleCaseFromSlug(lastSeg);
  const isPlural = lastLower.endsWith("s") && lastLower.length > 3;
  const singular = isPlural ? lastTitle.slice(0, -1) : lastTitle;

  if (method === "GET") {
    return isPlural ? `List ${lastTitle}` : `Get ${lastTitle}`;
  }
  if (method === "POST") {
    return `Create ${singular}`;
  }
  if (method === "PUT") {
    return `Replace ${singular}`;
  }
  if (method === "PATCH") {
    return `Update ${singular}`;
  }
  if (method === "DELETE") {
    return `Delete ${singular}`;
  }

  return `${toTitleCaseFromSlug(method)} ${lastTitle}`;
}

/**
 * Master Universal Tree Builder.
 * Maps any set of ApiRoutes into a clean, hierarchical folder structure:
 * - Dynamic parameters never become physical folders.
 * - Single-child passthrough wrappers are squashed.
 * - Standalone routes are categorized into their domain folder.
 * - Sibling name collisions are resolved deterministically.
 */
export function buildTreeFromRoutePaths(routes: ApiRoute[]): ApiFolder[] {
  const root: ApiFolder = { id: "root", name: "root", children: [] };

  // Count true root routes (e.g. /, /api where segments.length === 0)
  const rootRoutesCount = routes.filter(
    (r) => normalizePathSegments(r.path).length === 0,
  ).length;
  // If 1 to 3 root routes exist, keep them directly at root level (Option B: sorted at bottom)
  const keepRootRoutesAtRoot = rootRoutesCount >= 1 && rootRoutesCount <= 3;

  const getOrCreateFolder = (parentChildren: (ApiFolder | ApiRoute)[], name: string): ApiFolder => {
    let folder = parentChildren.find(
      (c) => !("method" in c) && c.name === name,
    ) as ApiFolder | undefined;
    if (!folder) {
      folder = { id: generateId(), name, children: [] };
      parentChildren.push(folder);
    }
    return folder;
  };

  for (const r of routes) {
    const segments = normalizePathSegments(r.path);
    const computedName = computeRouteDisplayName({
      method: r.method,
      path: r.path,
      file: r.file,
    });

    // Extract all static segments (Resource Taxonomy)
    // Parameter segments ({realm}, :id, [id]) are NEVER included in folderSegs!
    const staticSegments = segments.filter((s) => !isDynamicSegment(s));

    let folderNames: string[] = [];

    if (staticSegments.length === 0) {
      // 0 static segments: true root (/) or dynamic root (/:shortId, /{id})
      if (segments.length === 0) {
        if (keepRootRoutesAtRoot) {
          folderNames = [];
        } else {
          folderNames = ["System"];
        }
      } else {
        folderNames = [extractFallbackDomain(r.file)];
      }
    } else if (staticSegments.length === 1) {
      // 1 static segment: file directly into domain folder (no orphan dumping!)
      folderNames = [toTitleCaseFromSlug(staticSegments[0])];
    } else {
      // Multiple static segments (e.g. /tenants/{realm}/clients/{cid} -> ["Tenants", "Clients"])
      folderNames = staticSegments.map((s) => toTitleCaseFromSlug(s));
    }

    // Traverse and place route inside folder
    let currentChildren = root.children;
    for (const fName of folderNames) {
      const folder = getOrCreateFolder(currentChildren, fName);
      currentChildren = folder.children;
    }

    currentChildren.push({
      ...r,
      name: computedName,
    });
  }

  // Smart Folder Squashing (Strict Mathematical Rule)
  // Only squash when a folder contains 0 direct routes AND exactly 1 child folder.
  function squashFolders(folder: ApiFolder): void {
    for (let i = 0; i < folder.children.length; i++) {
      const child = folder.children[i];
      if (!("method" in child)) {
        squashFolders(child as ApiFolder);
      }
    }

    for (let i = 0; i < folder.children.length; i++) {
      const child = folder.children[i];
      if (!("method" in child)) {
        let currentChild = child as ApiFolder;
        while (
          currentChild.children.length === 1 &&
          !("method" in currentChild.children[0])
        ) {
          const grandChild = currentChild.children[0] as ApiFolder;
          currentChild = {
            id: grandChild.id,
            name: `${currentChild.name} / ${grandChild.name}`,
            children: grandChild.children,
          };
          folder.children[i] = currentChild;
        }
      }
    }
  }

  squashFolders(root);

  // Sibling Name Disambiguation
  function disambiguateFolderRoutes(folder: ApiFolder): void {
    const nameCount = new Map<string, number>();
    for (const item of folder.children) {
      if ("method" in item) {
        nameCount.set(item.name, (nameCount.get(item.name) || 0) + 1);
      } else {
        disambiguateFolderRoutes(item as ApiFolder);
      }
    }

    const seenCount = new Map<string, number>();
    for (const item of folder.children) {
      if ("method" in item) {
        const total = nameCount.get(item.name) || 0;
        if (total > 1) {
          const current = (seenCount.get(item.name) || 0) + 1;
          seenCount.set(item.name, current);
          if (current > 1) {
            item.name = `${item.name} (${current})`;
          }
        }
      }
    }
  }

  disambiguateFolderRoutes(root);

  // Deterministic Sort: Folders A-Z first, then Routes by Method then Path
  const methodOrder: Record<string, number> = {
    GET: 1,
    POST: 2,
    PUT: 3,
    PATCH: 4,
    DELETE: 5,
    ALL: 9,
  };

  const sortNode = (folder: ApiFolder) => {
    folder.children.sort((a, b) => {
      const aIsRoute = "method" in a;
      const bIsRoute = "method" in b;
      if (aIsRoute !== bIsRoute) return aIsRoute ? 1 : -1;

      if (!aIsRoute && !bIsRoute) {
        return a.name.localeCompare(b.name);
      }

      const am = String((a as ApiRoute).method);
      const bm = String((b as ApiRoute).method);
      const byMethod = (methodOrder[am] ?? 99) - (methodOrder[bm] ?? 99);
      if (byMethod !== 0) return byMethod;
      return String((a as ApiRoute).path).localeCompare(String((b as ApiRoute).path));
    });

    for (const child of folder.children) {
      if (!("method" in child)) sortNode(child as ApiFolder);
    }
  };

  sortNode(root);

  return root.children as ApiFolder[];
}
