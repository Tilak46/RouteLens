// ============================================================================
// Multi-Signal Consensus Collection Engine - Adaptive Clustered Synthesizer
// ============================================================================

import crypto from "crypto";
import type { ApiFolder, ApiRoute } from "../../../types";
import { analyzeRouteConsensus, type AnalyzedRoute } from "./entityResolver";

export interface CollectionSynthesisOptions {
  /**
   * Minimum route count required to create a sub-entity folder.
   * If a sub-entity has fewer routes than this threshold, it is absorbed
   * directly into the parent domain collection to eliminate 1-route folder noise.
   * Defaults to 2 (the < 2 mass guard rule).
   */
  minSubEntityClusterSize?: number;

  /**
   * Minimum route count required for a standalone top-level root collection.
   * Isolated singletons with fewer routes are absorbed into "General" or "System & Health".
   * Defaults to 1.
   */
  minRootClusterSize?: number;

  /**
   * Root directory of the repository for file topology domain normalization.
   */
  repoRoot?: string;
}

/**
 * Universal blocklist of HTTP verbs, operations, and state modifiers
 * that must NEVER become directory folders in an API collection.
 */
export const ACTION_MODIFIER_BLOCKLIST = new Set([
  "active", "rank", "rules", "rule", "toggle", "toggle-active", "status", "verify", "check", "download",
  "upload", "presign", "search", "filter", "all", "details", "info", "overview", "count", "batch",
  "sync", "bulk", "export", "import"
]);

/**
 * Builds a deterministic, adaptive Postman/Swagger-style API collection
 * from any list of scanned routes across any programming language.
 *
 * Implements an N-level recursive prefix Trie with:
 * 1. Sub-Resource Mass Guard (minClusterSize >= 2): absorbs isolated 1-route singletons into parent.
 * 2. Dynamic Hierarchy: recursively constructs subfolders as deep as routes naturally warrant.
 * 3. Action Modifier Blocklist: prevents verbs and state flags from becoming spurious folders.
 * 4. Redundant Single-Child Unwrapper: collapses 0-route single parents.
 * 5. Deterministic Hierarchical & Method Sorting.
 */
export function synthesizeApiCollection(
  routes: ApiRoute[],
  options?: CollectionSynthesisOptions
): ApiFolder[] {
  const minSubCluster = options?.minSubEntityClusterSize ?? 2;
  const minRootCluster = options?.minRootClusterSize ?? 1;
  const analyzed = routes.map((r) => analyzeRouteConsensus(r, routes, options?.repoRoot));

  // 1. Group by Primary Domain
  const domainMap = new Map<string, AnalyzedRoute[]>();
  for (const item of analyzed) {
    if (!domainMap.has(item.domain)) domainMap.set(item.domain, []);
    domainMap.get(item.domain)!.push(item);
  }

  const rootFolders: ApiFolder[] = [];
  const absorbedGeneral: AnalyzedRoute[] = [];
  const absorbedHealth: AnalyzedRoute[] = [];

  for (const [domainName, domainRoutes] of domainMap.entries()) {
    // Dedicated System & Health domain check
    if (domainName === "System & Health") {
      for (const r of domainRoutes) absorbedHealth.push(r);
      continue;
    }

    // 2. Prepare routes with sanitized subfolder segments
    // Filter out blacklisted verbs/modifiers and self-referential domain names
    const sanitizedRoutes = domainRoutes.map((r) => {
      const cleanSub = (r.subFolders || []).filter((s) => {
        const lower = s.toLowerCase();
        return !ACTION_MODIFIER_BLOCKLIST.has(lower) && lower !== domainName.toLowerCase();
      });
      return {
        ...r,
        cleanSub,
      };
    });

    const domainFolder: ApiFolder = {
      id: crypto.createHash("sha256").update(domainName).digest("hex").slice(0, 12),
      name: domainName,
      children: [],
    };

    /**
     * Recursive N-Level Trie Builder with Sub-Resource Mass Guard
     */
    function buildRecursiveLevel(
      items: typeof sanitizedRoutes,
      depth: number,
      pathPrefix: string
    ): (ApiFolder | ApiRoute)[] {
      const groups = new Map<string, typeof sanitizedRoutes>();
      const direct: typeof sanitizedRoutes = [];

      for (const item of items) {
        if (depth < item.cleanSub.length) {
          const seg = item.cleanSub[depth];
          if (!groups.has(seg)) groups.set(seg, []);
          groups.get(seg)!.push(item);
        } else {
          direct.push(item);
        }
      }

      const result: (ApiFolder | ApiRoute)[] = [];

      for (const [groupName, groupItems] of groups.entries()) {
        // Sub-Resource Mass Guard:
        // A subfolder is ONLY created if it has >= minSubCluster routes!
        // If it has fewer routes, absorb into parent so we NEVER create 1-route clutter.
        if (groupItems.length >= minSubCluster) {
          const childPath = `${pathPrefix}/${groupName}`;
          const childChildren = buildRecursiveLevel(groupItems, depth + 1, childPath);

          const childFolder: ApiFolder = {
            id: crypto.createHash("sha256").update(childPath).digest("hex").slice(0, 12),
            name: groupName,
            children: childChildren,
          };

          // Redundant Single-Child Unwrapping:
          // If childFolder has 0 direct routes and EXACTLY 1 subfolder, unwrap/collapse it!
          const directCount = childFolder.children.filter((c) => !("children" in c)).length;
          const subCount = childFolder.children.filter((c) => "children" in c).length;
          if (directCount === 0 && subCount === 1) {
            const onlyChild = childFolder.children[0] as ApiFolder;
            const mergedName = groupName.toLowerCase().includes(onlyChild.name.toLowerCase())
              ? groupName
              : `${groupName} > ${onlyChild.name}`;
            childFolder.name = mergedName;
            childFolder.children = onlyChild.children;
          }

          result.push(childFolder);
        } else {
          // Absorb into parent
          for (const gi of groupItems) {
            direct.push(gi);
          }
        }
      }

      // Add direct routes
      for (const d of direct) {
        result.push({
          ...d.raw,
          name: d.operationName,
        });
      }

      return result;
    }

    domainFolder.children = buildRecursiveLevel(sanitizedRoutes, 0, domainName);

    // If domainFolder has NO direct routes and EXACTLY ONE subfolder, unwrap it
    if (
      domainFolder.children.length === 1 &&
      "children" in domainFolder.children[0]
    ) {
      const singleSub = domainFolder.children[0] as ApiFolder;
      domainFolder.name = domainFolder.name.toLowerCase() === singleSub.name.toLowerCase()
        ? domainFolder.name
        : `${domainFolder.name} - ${singleSub.name}`;
      domainFolder.children = singleSub.children;
    }

    // 3. Root Singleton Absorption Rule
    const totalDomainRoutes = countFolderRoutes(domainFolder);

    if (totalDomainRoutes < minRootCluster) {
      const isHealth = domainName.toLowerCase().includes("health") ||
                       domainName.toLowerCase().includes("ping") ||
                       domainName.toLowerCase().includes("version") ||
                       domainName.toLowerCase().includes("status");

      const leafRoutes = extractLeafRoutes(domainFolder);
      for (const dr of leafRoutes) {
        if (isHealth) absorbedHealth.push(dr);
        else absorbedGeneral.push(dr);
      }
    } else {
      rootFolders.push(domainFolder);
    }
  }

  // 4. Add Consolidated General & System & Health Collections if populated
  if (absorbedGeneral.length > 0) {
    rootFolders.push({
      id: crypto.createHash("sha256").update("General").digest("hex").slice(0, 12),
      name: "General",
      children: absorbedGeneral.map((r) => ({
        ...r.raw,
        name: r.operationName,
      })),
    });
  }

  if (absorbedHealth.length > 0) {
    rootFolders.push({
      id: crypto.createHash("sha256").update("System & Health").digest("hex").slice(0, 12),
      name: "System & Health",
      children: absorbedHealth.map((r) => ({
        ...r.raw,
        name: r.operationName,
      })),
    });
  }

  // 5. Deterministic Hierarchical & Method Sorting
  const methodWeights: Record<string, number> = { GET: 1, POST: 2, PUT: 3, PATCH: 4, DELETE: 5 };
  const sortTree = (folder: ApiFolder) => {
    folder.children.sort((a, b) => {
      const aIsFolder = "children" in a;
      const bIsFolder = "children" in b;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      if (aIsFolder && bIsFolder) return a.name.localeCompare(b.name);

      const ra = a as ApiRoute;
      const rb = b as ApiRoute;
      const wa = methodWeights[ra.method] || 99;
      const wb = methodWeights[rb.method] || 99;
      if (wa !== wb) return wa - wb;
      return (ra.name || ra.path).localeCompare(rb.name || rb.path);
    });
    for (const c of folder.children) {
      if ("children" in c) sortTree(c as ApiFolder);
    }
  };

  rootFolders.sort((a, b) => {
    if (a.name === "General" && b.name === "System & Health") return -1;
    if (a.name === "System & Health") return 1;
    if (b.name === "System & Health") return -1;
    if (a.name === "General") return 1;
    if (b.name === "General") return -1;
    return a.name.localeCompare(b.name);
  });

  for (const f of rootFolders) sortTree(f);

  return rootFolders;
}

function countFolderRoutes(folder: ApiFolder): number {
  let count = 0;
  for (const item of folder.children) {
    if ("children" in item) {
      count += countFolderRoutes(item as ApiFolder);
    } else {
      count++;
    }
  }
  return count;
}

function extractLeafRoutes(folder: ApiFolder): any[] {
  const routes: any[] = [];
  for (const item of folder.children) {
    if ("children" in item) {
      routes.push(...extractLeafRoutes(item as ApiFolder));
    } else {
      routes.push({
        raw: item,
        operationName: item.name,
      });
    }
  }
  return routes;
}
