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
   * Defaults to 2.
   */
  minSubEntityClusterSize?: number;

  /**
   * Minimum route count required for a standalone top-level root collection.
   * Isolated singletons with fewer routes are absorbed into "General" or "System & Health".
   * Defaults to 2.
   */
  minRootClusterSize?: number;

  /**
   * Root directory of the repository for file topology domain normalization.
   */
  repoRoot?: string;
}

/**
 * Builds a deterministic, adaptive Postman/Swagger-style API collection
 * from any list of scanned routes across any programming language.
 */
export function synthesizeApiCollection(
  routes: ApiRoute[],
  options?: CollectionSynthesisOptions
): ApiFolder[] {
  const minSubCluster = options?.minSubEntityClusterSize ?? 2;
  const minRootCluster = options?.minRootClusterSize ?? 2;
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
    // Check if domain is a dedicated System & Health domain
    if (domainName === "System & Health") {
      for (const r of domainRoutes) absorbedHealth.push(r);
      continue;
    }

    // 2. Sub-Entity clustering inside domain
    const subGroups = new Map<string, AnalyzedRoute[]>();
    const rootDirect: AnalyzedRoute[] = [];

    for (const r of domainRoutes) {
      if (r.subFolders.length > 0 && r.subFolders[0].toLowerCase() !== domainName.toLowerCase()) {
        const primarySub = r.subFolders[0];
        if (!subGroups.has(primarySub)) subGroups.set(primarySub, []);
        subGroups.get(primarySub)!.push(r);
      } else {
        rootDirect.push(r);
      }
    }

    const domainFolder: ApiFolder = {
      id: crypto.createHash("sha256").update(domainName).digest("hex").slice(0, 12),
      name: domainName,
      children: [],
    };

    // 3. Sub-Entity Absorption Rule:
    // Only create a subfolder if it has >= minSubCluster routes!
    for (const [subName, subRoutes] of subGroups.entries()) {
      if (subRoutes.length >= minSubCluster) {
        // Check for 3rd level sub-clusters (e.g. GMB -> Rank Tracker -> Keywords)
        const deepGroups = new Map<string, AnalyzedRoute[]>();
        const subDirect: AnalyzedRoute[] = [];

        for (const sr of subRoutes) {
          if (sr.subFolders.length > 1 && sr.subFolders[1].toLowerCase() !== subName.toLowerCase()) {
            const secondarySub = sr.subFolders[1];
            if (!deepGroups.has(secondarySub)) deepGroups.set(secondarySub, []);
            deepGroups.get(secondarySub)!.push(sr);
          } else {
            subDirect.push(sr);
          }
        }

        const subFolder: ApiFolder = {
          id: crypto.createHash("sha256").update(`${domainName}/${subName}`).digest("hex").slice(0, 12),
          name: subName,
          children: [],
        };

        const validDeepFolders: ApiFolder[] = [];
        for (const [deepName, deepRoutes] of deepGroups.entries()) {
          if (deepRoutes.length >= minSubCluster) {
            const deepFolder: ApiFolder = {
              id: crypto.createHash("sha256").update(`${domainName}/${subName}/${deepName}`).digest("hex").slice(0, 12),
              name: deepName,
              children: deepRoutes.map(dr => ({
                ...dr.raw,
                name: dr.operationName,
              })),
            };
            validDeepFolders.push(deepFolder);
          } else {
            for (const dr of deepRoutes) subDirect.push(dr);
          }
        }

        // If subDirect is empty and there is only 1 deep folder, collapse redundant intermediate chain!
        // e.g. Support -> Tickets becomes "Support Tickets" directly under parent
        if (subDirect.length === 0 && validDeepFolders.length === 1) {
          const singleDeep = validDeepFolders[0];
          const collapsedName = subName.toLowerCase().includes(singleDeep.name.toLowerCase())
            ? singleDeep.name
            : `${subName} ${singleDeep.name}`;
          domainFolder.children.push({
            id: crypto.createHash("sha256").update(`${domainName}/${collapsedName}`).digest("hex").slice(0, 12),
            name: collapsedName,
            children: singleDeep.children,
          });
        } else {
          for (const df of validDeepFolders) {
            subFolder.children.push(df);
          }
          for (const dr of subDirect) {
            subFolder.children.push({
              ...dr.raw,
              name: dr.operationName,
            });
          }
          domainFolder.children.push(subFolder);
        }
      } else {
        // Absorb single route directly into parent domain! Zero 1-route subfolders!
        for (const sr of subRoutes) rootDirect.push(sr);
      }
    }

    for (const dr of rootDirect) {
      domainFolder.children.push({
        ...dr.raw,
        name: dr.operationName,
      });
    }

    // Unnecessary intermediate single-subfolder elimination:
    // If domainFolder has NO direct routes and EXACTLY ONE subfolder,
    // promote the subfolder's items directly into domainFolder to eliminate redundant 1:1 nesting!
    if (rootDirect.length === 0 && domainFolder.children.length === 1 && "children" in domainFolder.children[0]) {
      const singleSub = domainFolder.children[0] as ApiFolder;
      domainFolder.children = singleSub.children;
    }

    // 4. Root Singleton Absorption Rule:
    // If an entire root collection has < minRootCluster routes (isolated 1-route endpoint),
    // absorb it into General or System & Health to eliminate 1-route root folder noise!
    const totalDomainRoutes = domainFolder.children.reduce((acc, c) => {
      return acc + ("children" in c ? (c as ApiFolder).children.length : 1);
    }, 0);

    if (totalDomainRoutes < minRootCluster) {
      const isHealth = domainName.toLowerCase().includes("health") ||
                       domainName.toLowerCase().includes("ping") ||
                       domainName.toLowerCase().includes("version") ||
                       domainName.toLowerCase().includes("status");

      for (const dr of rootDirect) {
        if (isHealth) absorbedHealth.push(dr);
        else absorbedGeneral.push(dr);
      }
    } else {
      rootFolders.push(domainFolder);
    }
  }

  // 5. Add Consolidated General & System & Health Collections if populated
  if (absorbedGeneral.length > 0) {
    rootFolders.push({
      id: crypto.createHash("sha256").update("General").digest("hex").slice(0, 12),
      name: "General",
      children: absorbedGeneral.map(r => ({
        ...r.raw,
        name: r.operationName,
      })),
    });
  }

  if (absorbedHealth.length > 0) {
    rootFolders.push({
      id: crypto.createHash("sha256").update("System & Health").digest("hex").slice(0, 12),
      name: "System & Health",
      children: absorbedHealth.map(r => ({
        ...r.raw,
        name: r.operationName,
      })),
    });
  }

  // 6. Deterministic Hierarchical Sorting
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
      return ra.path.localeCompare(rb.path);
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

