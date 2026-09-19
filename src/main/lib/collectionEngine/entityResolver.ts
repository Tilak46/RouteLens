// ============================================================================
// Multi-Signal Consensus Collection Engine - Entity Resolver
// ============================================================================

import type { ApiRoute } from "../../../types";
import { isDynamicSegment, extractParamName, toTitleCaseFromSlug } from "../../../shared/apiTree";
import {
  KNOWN_VERBS,
  NON_PLURAL_S_WORDS,
  singularizeNoun,
  formatEntityName,
  parseCompoundAction,
  SINGLETON_DOMAINS
} from "./tokenizer";

export interface AnalyzedRoute {
  raw: ApiRoute;
  method: string;
  path: string;
  segments: string[];
  cleanSegments: string[];
  domain: string;
  subFolders: string[];
  operationName: string;
  hasTenantScope: boolean;
  isPublic: boolean;
}

// Universal filesystem boilerplate directories across Java, Python, Go, Node, Next.js
const BOILERPLATE_DIRS = new Set([
  "src", "app", "api", "routes", "controllers", "controller", "handlers", "handler", "routers", "router",
  "pkg", "internal", "main", "java", "com", "features", "v1", "v2", "v3", "backend", "lib", "dist", "build", "core",
  "route", "index", "server"
]);

/**
 * Universal architectural domain extraction from file path across Java, Python, Go, Next.js, Node
 */
export function extractDomainFromFile(filePath: string, repoRoot?: string): string[] {
  if (!filePath) return [];
  let normalized = filePath.replace(/\\/g, "/");
  if (repoRoot) {
    const normRoot = repoRoot.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized.toLowerCase().startsWith(normRoot.toLowerCase())) {
      normalized = normalized.slice(normRoot.length);
    }
  } else {
    // If repoRoot not provided, skip drive letters and look for landmark project directories
    const segs = normalized.split("/").filter(Boolean);
    const landmarkIdx = segs.findIndex(s => {
      const l = s.toLowerCase();
      return ["src", "app", "pkg", "internal", "routes", "controllers", "backend"].includes(l);
    });
    if (landmarkIdx >= 0) {
      normalized = segs.slice(landmarkIdx).join("/");
    }
  }

  normalized = normalized.replace(/^[/\\]+/, "");
  const parts = normalized.split("/").filter(Boolean);

  const meaningful: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    // Skip Windows drive letters (e.g. "c:", "d:")
    if (/^[a-zA-Z]:$/.test(p)) continue;
    const pLower = p.toLowerCase().replace(/\.[^/.]+$/, ""); // strip extension

    // Check if filename is a controller/router file
    if (i === parts.length - 1) {
      if (BOILERPLATE_DIRS.has(pLower)) continue; // e.g. "route.ts" in Next.js

      let fileClean = pLower
        .replace(/(controller|routes|router|handler|client|service|features|view|endpoint|endpoints)s?$/i, "")
        .replace(/^(routes|router|controller|handler)_/i, "");

      if (fileClean && !BOILERPLATE_DIRS.has(fileClean) && fileClean !== "index" && fileClean !== "app") {
        meaningful.push(formatEntityName(fileClean));
      }
    } else {
      if (!BOILERPLATE_DIRS.has(pLower) && !/^v[0-9]+$/i.test(pLower)) {
        // Skip common project wrapper names like "nyaysetu-backend" or "repo-backend"
        if (!pLower.endsWith("-backend") && !pLower.endsWith("-server") && !pLower.endsWith("-api")) {
          meaningful.push(formatEntityName(pLower));
        }
      }
    }
  }

  return meaningful;
}

/**
 * Detects version tokens relative to their local subtree (e.g. "v1", "v2.0")
 */
export function isVersionSegment(seg: string): boolean {
  const s = seg.toLowerCase();
  return /^v[0-9]+(\.[0-9]+)?$/.test(s);
}

/**
 * Detects tenant scope prefix patterns (e.g. /workspaces/:id, /accounts/:id, /orgs/:id)
 */
export function isTenantScope(seg: string, nextSeg?: string): boolean {
  const s = seg.toLowerCase();
  const knownScopes = new Set(["workspaces", "workspace", "accounts", "account", "orgs", "org", "tenants", "tenant"]);
  return knownScopes.has(s) && !!nextSeg && isDynamicSegment(nextSeg);
}

/**
 * Derives a canonical Entity Anchor, Domain, and Operation Name for any route
 * across REST, RPC, CQRS, monoliths, and microservices.
 */
export function analyzeRouteConsensus(route: ApiRoute, allRoutes: ApiRoute[], repoRoot?: string): AnalyzedRoute {
  const method = String(route.method || "GET").toUpperCase();
  const rawPath = String(route.path || "").split("#")[0].split("?")[0].trim();
  const rawSegments = rawPath.split("/").filter(Boolean);

  // Check Singletons & Root Endpoints first
  const pathLower = rawPath.toLowerCase();
  if (rawSegments.length === 0 || pathLower === "/" || SINGLETON_DOMAINS.has(pathLower.replace(/^\//, ""))) {
    const slug = rawSegments.length === 0 ? "root" : rawSegments[rawSegments.length - 1].toLowerCase();
    const domain = SINGLETON_DOMAINS.get(slug) || "System & Health";
    const opName = method === "GET" ? `Get ${toTitleCaseFromSlug(slug)}` : `${method} ${toTitleCaseFromSlug(slug)}`;
    return {
      raw: route,
      method,
      path: rawPath,
      segments: rawSegments,
      cleanSegments: [],
      domain,
      subFolders: [],
      operationName: opName,
      hasTenantScope: false,
      isPublic: false,
    };
  }

  let isPublic = false;
  let hasTenantScope = false;

  // Filter infrastructure envelopes & tenant scopes
  const meaningfulSegs: string[] = [];
  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    const segLower = seg.toLowerCase();

    if (segLower === "public") {
      isPublic = true;
      continue;
    }

    // Skip root "api", "rest" if not leaf
    if (i < rawSegments.length - 1 && (segLower === "api" || segLower === "rest")) {
      continue;
    }
    // Skip version segment if followed by more segments (e.g. /v1/login -> skips v1)
    if (i < rawSegments.length - 1 && isVersionSegment(segLower)) {
      continue;
    }
    // Skip tenant scopes if followed by dynamic id (e.g. /workspaces/:id/posts -> skips workspaces/:id)
    if (i < rawSegments.length - 2 && isTenantScope(seg, rawSegments[i + 1])) {
      hasTenantScope = true;
      i++; // skip both scope noun and dynamic param
      continue;
    }
    meaningfulSegs.push(seg);
  }

  if (meaningfulSegs.length === 0) {
    return {
      raw: route,
      method,
      path: rawPath,
      segments: rawSegments,
      cleanSegments: [],
      domain: "General",
      subFolders: [],
      operationName: `${method} Root`,
      hasTenantScope,
      isPublic,
    };
  }

  // --- 1. DOMAIN & SUBFOLDERS RESOLUTION ---
  const fileDomains = extractDomainFromFile(route.file || "", repoRoot);
  const staticSegs = meaningfulSegs.filter(s => !isDynamicSegment(s));

  let domain = "General";
  const subFolders: string[] = [];

  const isFirstSegNakedVerb = staticSegs.length > 0 && (
    KNOWN_VERBS.has(staticSegs[0].toLowerCase()) ||
    staticSegs[0].toLowerCase() === "by-id" ||
    staticSegs[0].toLowerCase() === "all"
  );

  if (staticSegs.length >= 1 && (!isFirstSegNakedVerb || fileDomains.length === 0)) {
    // Prefer URL path domain hierarchy if structured and not starting with a naked action verb
    domain = formatEntityName(staticSegs[0]);
    for (let s = 1; s < staticSegs.length && s < 4; s++) {
      const name = formatEntityName(staticSegs[s]);
      if (name && name.toLowerCase() !== domain.toLowerCase()) {
        subFolders.push(name);
      }
    }
  } else if (fileDomains.length >= 1) {
    domain = fileDomains[0];
    for (let f = 1; f < fileDomains.length; f++) {
      if (fileDomains[f]) subFolders.push(fileDomains[f]);
    }
    // If there were static segments, keep them as subfolders if meaningful
    if (staticSegs.length > 0 && !isFirstSegNakedVerb) {
      for (const s of staticSegs) {
        const name = formatEntityName(s);
        if (name && name.toLowerCase() !== domain.toLowerCase()) {
          subFolders.push(name);
        }
      }
    }
  }

  if (!domain || !domain.trim()) {
    domain = "General";
  }

  // --- 2. OPERATION NAME DERIVATION ---
  let opName = "";
  let lastStaticIndex = meaningfulSegs.length - 1;
  while (lastStaticIndex >= 0 && isDynamicSegment(meaningfulSegs[lastStaticIndex])) {
    lastStaticIndex--;
  }

  const trailingDynamics = meaningfulSegs.slice(lastStaticIndex + 1);
  const effectiveLeaf = lastStaticIndex >= 0 ? meaningfulSegs[lastStaticIndex] : "";
  const compound = parseCompoundAction(effectiveLeaf);

  let actionVerb = compound.verb;
  let targetNoun = compound.noun;

  const leafLower = effectiveLeaf.toLowerCase();
  if (leafLower === "likes" && method === "POST") {
    actionVerb = "Like";
    targetNoun = "";
  } else if (leafLower === "replies" && method === "POST") {
    actionVerb = "Reply";
    targetNoun = "";
  } else if (leafLower === "connect") {
    actionVerb = method === "DELETE" ? "Disconnect" : "Connect";
    targetNoun = "";
  }

  // Preceding noun resolution if action verb found without noun
  if (actionVerb && !targetNoun) {
    for (let k = lastStaticIndex - 1; k >= 0; k--) {
      if (!isDynamicSegment(meaningfulSegs[k])) {
        const prevCompound = parseCompoundAction(meaningfulSegs[k]);
        const rawNoun = prevCompound.noun || formatEntityName(meaningfulSegs[k]);
        targetNoun = singularizeNoun(rawNoun);
        break;
      }
    }
    if (!targetNoun) targetNoun = singularizeNoun(domain);
  }

  // Multi-segment context: e.g. /billing/ai-credits/history -> "AI Credits History"
  if (!actionVerb && lastStaticIndex >= 1 && staticSegs.length >= 2) {
    const parentStatic = staticSegs[staticSegs.length - 2];
    const parentLower = parentStatic.toLowerCase();
    if (!KNOWN_VERBS.has(parentLower) && !["api", "v1", "v2"].includes(parentLower)) {
      if (["history", "status", "logs", "stats", "spend", "analytics"].includes(leafLower)) {
        targetNoun = `${formatEntityName(parentStatic)} ${formatEntityName(effectiveLeaf)}`;
      }
    }
  }

  const isPlural = effectiveLeaf.toLowerCase().endsWith("s") && !NON_PLURAL_S_WORDS.has(effectiveLeaf.toLowerCase()) && !effectiveLeaf.toLowerCase().endsWith("ss");
  const singularLeaf = singularizeNoun(targetNoun || formatEntityName(effectiveLeaf));
  const prefixPublic = isPublic ? "Public " : "";

  if (actionVerb) {
    const specificParam = trailingDynamics.find(d => {
      const p = extractParamName(d).toLowerCase();
      return !p.includes("workspace") && !p.includes("account") && !p.includes("tenant") && !p.includes("org");
    });

    if (specificParam && actionVerb.toLowerCase() === "confirm") {
      opName = `Confirm ${prefixPublic}${extractParamName(specificParam).replace(/Id$/i, "") || targetNoun}`.trim();
    } else if (targetNoun && targetNoun.toLowerCase() !== actionVerb.toLowerCase()) {
      opName = `${actionVerb} ${prefixPublic}${singularizeNoun(targetNoun)}`.trim();
    } else {
      opName = `${actionVerb} ${prefixPublic}${singularizeNoun(domain)}`.trim();
    }
  } else if (trailingDynamics.length > 0) {
    const lastParam = trailingDynamics[trailingDynamics.length - 1];
    const lastParamName = extractParamName(lastParam);
    const lastParamLower = lastParamName.toLowerCase();

    const isGenericTenantParam = (lastParamLower === "workspaceid" || lastParamLower === "accountid" || lastParamLower === "tenantid") && !effectiveLeaf.toLowerCase().includes("account") && !effectiveLeaf.toLowerCase().includes("workspace");

    if (isGenericTenantParam) {
      if (method === "GET") {
        opName = isPlural ? `List ${prefixPublic}${formatEntityName(effectiveLeaf)}` : `Get ${prefixPublic}${formatEntityName(effectiveLeaf)}`;
      } else if (method === "POST" || method === "PUT") {
        opName = `Update ${prefixPublic}${singularLeaf}`;
      } else if (method === "DELETE") {
        opName = `Delete ${prefixPublic}${singularLeaf}`;
      } else {
        opName = `${method} ${prefixPublic}${singularLeaf}`;
      }
    } else {
      if (method === "GET") opName = `Get ${prefixPublic}${singularLeaf} by ${lastParamName}`;
      else if (method === "DELETE") opName = `Delete ${prefixPublic}${singularLeaf} by ${lastParamName}`;
      else if (method === "PUT") opName = `Replace ${prefixPublic}${singularLeaf} by ${lastParamName}`;
      else if (method === "PATCH") opName = `Update ${prefixPublic}${singularLeaf} by ${lastParamName}`;
      else if (method === "POST") opName = `Create ${prefixPublic}${singularLeaf} by ${lastParamName}`;
      else opName = `${method} ${prefixPublic}${singularLeaf} by ${lastParamName}`;
    }
  } else {
    const leafNoun = targetNoun || formatEntityName(effectiveLeaf);
    if (method === "GET") {
      opName = isPlural ? `List ${prefixPublic}${leafNoun}` : `Get ${prefixPublic}${leafNoun}`;
    } else if (method === "POST") {
      opName = `Create ${prefixPublic}${singularLeaf}`;
    } else if (method === "PUT") {
      opName = `Replace ${prefixPublic}${singularLeaf}`;
    } else if (method === "PATCH") {
      opName = `Update ${prefixPublic}${singularLeaf}`;
    } else if (method === "DELETE") {
      opName = `Delete ${prefixPublic}${singularLeaf}`;
    } else {
      opName = `${method} ${prefixPublic}${singularLeaf}`;
    }
  }

  return {
    raw: route,
    method,
    path: rawPath,
    segments: rawSegments,
    cleanSegments: meaningfulSegs,
    domain,
    subFolders,
    operationName: opName,
    hasTenantScope,
    isPublic,
  };
}

