import fs from "fs";
import path from "path";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";
import { synthesizeApiCollection } from "../src/main/lib/collectionEngine";
import type { ApiFolder, ApiRoute } from "../src/types";

interface BenchmarkTarget {
  name: string;
  path: string;
  architecture: string;
  language: string;
}

const TARGETS: BenchmarkTarget[] = [
  {
    name: "Art-Backend",
    path: "c:\\Office-Work\\CRM\\Art-Backend",
    architecture: "Modular CRM Monolith (Express)",
    language: "TypeScript / Express",
  },
  {
    name: "TechTrailDMC-Server",
    path: "c:\\Office-Work\\TechTail-DMC\\TechTrailDMC-Server",
    architecture: "Multi-Tier B2B Travel Platform (Express)",
    language: "TypeScript / Express",
  },
  {
    name: "Drone CI",
    path: "c:\\building-future\\devdash\\.temp-benchmarks\\go-holdout\\drone",
    architecture: "Relational Sub-resource Router (Chi)",
    language: "Go / Chi",
  },
  {
    name: "Traefik",
    path: "c:\\building-future\\devdash\\.temp-benchmarks\\go-holdout\\traefik",
    architecture: "Cloud-Native API Gateway (Gorilla Mux)",
    language: "Go / Gorilla Mux",
  },
  {
    name: "Booking Microservices",
    path: "c:\\Office-Work\\Testing\\booking-microservices-expressjs",
    architecture: "Distributed Poly-Service Express",
    language: "JavaScript / Express",
  },
];

async function runBenchmark() {
  console.log("================================================================================");
  console.log("       MULTI-SIGNAL CONSENSUS COLLECTION ENGINE - PRODUCTION BENCHMARK          ");
  console.log("================================================================================\n");

  const results: any[] = [];

  for (const target of TARGETS) {
    if (!fs.existsSync(target.path)) {
      console.warn(`[WARN] Skipping missing target: ${target.path}`);
      continue;
    }

    const t0 = Date.now();
    const scanResult = await scanOmniRoutes(target.path, { mode: "ast" });
    const scanMs = Date.now() - t0;

    const apiRoutes: ApiRoute[] = scanResult.routes.map((r, i) => ({
      id: r.id || `r-${i}`,
      method: r.method,
      path: r.path,
      name: "",
      file: r.file,
      source: r.source,
    }));

    const synthStart = Date.now();
    const collection = synthesizeApiCollection(apiRoutes, { repoRoot: target.path });
    const synthMs = Date.now() - synthStart;

    let totalFolders = 0;
    let singleRouteSubfolders = 0;
    let singleRouteRootFolders = 0;
    let maxDepth = 0;
    let totalRoutesFound = 0;
    let nameCollisionCount = 0;

    for (const f of collection) {
      if (f.children.length === 1 && !("children" in f.children[0]) && f.name !== "General" && f.name !== "System & Health") {
        singleRouteRootFolders++;
      }
    }

    function walk(folder: ApiFolder, depth = 1) {
      totalFolders++;
      if (depth > maxDepth) maxDepth = depth;

      const routeSet = new Set<string>();
      for (const item of folder.children) {
        if ("children" in item) {
          const sub = item as ApiFolder;
          if (sub.children.length === 1 && !("children" in sub.children[0])) {
            singleRouteSubfolders++;
          }
          walk(sub, depth + 1);
        } else {
          totalRoutesFound++;
          const r = item as ApiRoute;
          const key = `${r.method} ${r.name}`;
          if (routeSet.has(key)) nameCollisionCount++;
          else routeSet.add(key);
        }
      }
    }

    for (const f of collection) walk(f, 1);

    const rootHygiene = collection.length > 0 ? ((collection.length - singleRouteRootFolders) / collection.length) * 100 : 100;
    const subfolderHygiene = totalFolders > 0 ? ((totalFolders - singleRouteSubfolders) / totalFolders) * 100 : 100;
    const nameUniqueness = totalRoutesFound > 0 ? ((totalRoutesFound - nameCollisionCount) / totalRoutesFound) * 100 : 100;
    const score = Math.round(subfolderHygiene * 0.4 + rootHygiene * 0.3 + nameUniqueness * 0.3);

    results.push({
      target: target.name,
      routes: apiRoutes.length,
      folders: totalFolders,
      maxDepth,
      rootHygiene,
      subfolderHygiene,
      nameUniqueness,
      synthMs,
      score,
      topFolders: collection.slice(0, 6).map((f) => `📁 ${f.name} (${f.children.length})`),
    });

    console.log(`[${target.name.padEnd(22)}] ${String(apiRoutes.length).padStart(4)} routes -> ${String(totalFolders).padStart(3)} folders (${synthMs}ms) | Score: ${score}%`);
  }

  console.log("\n================================================================================");
  console.log("                             QUALITY MATRIX SUMMARY                             ");
  console.log("================================================================================\n");

  console.log(
    "Target".padEnd(25) +
    "Routes".padEnd(8) +
    "Folders".padEnd(9) +
    "MaxDepth".padEnd(10) +
    "SubHygiene".padEnd(12) +
    "RootHygiene".padEnd(13) +
    "UniqueNames".padEnd(13) +
    "Speed".padEnd(9) +
    "Score"
  );
  console.log("-".repeat(99));

  for (const r of results) {
    console.log(
      r.target.padEnd(25) +
      String(r.routes).padEnd(8) +
      String(r.folders).padEnd(9) +
      String(r.maxDepth).padEnd(10) +
      `${r.subfolderHygiene.toFixed(1)}%`.padEnd(12) +
      `${r.rootHygiene.toFixed(1)}%`.padEnd(13) +
      `${r.nameUniqueness.toFixed(1)}%`.padEnd(13) +
      `${r.synthMs}ms`.padEnd(9) +
      `${r.score}%`
    );
  }

  console.log("\nSample Generated Collections:");
  for (const r of results) {
    console.log(`  • ${r.target}: ${r.topFolders.join(", ")}`);
  }
}

runBenchmark().catch(console.error);
