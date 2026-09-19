import fs from "fs";
import { synthesizeApiCollection } from "../src/main/lib/collectionEngine";
import type { ApiRoute } from "../src/types";

async function run() {
  const data = JSON.parse(fs.readFileSync("C:\\Users\\Tilak\\.gemini\\antigravity\\brain\\03ad2d72-255e-4593-a5ab-7767805aa896\\scratch\\baseline_18_repos.json", "utf8"));

  const targets = [
    { label: "Java / Spring Boot", key: "nyay-setu-working", root: "c:\\Office-Work\\Testing\\nyay-setu-working" },
    { label: "Python / FastAPI", key: "Nexus-11", root: "c:\\Office-Work\\Testing\\Nexus-11" },
    { label: "Next.js 14 App Router", key: "crypto-data-aggregator", root: "c:\\Office-Work\\Testing\\crypto-data-aggregator" },
    { label: "Node.js / Express Enterprise", key: "Art-Backend", root: "c:\\Office-Work\\CRM\\Art-Backend" },
  ];

  console.log("================================================================================");
  console.log("UNIVERSAL MULTI-SIGNAL API COLLECTION ENGINE BENCHMARK");
  console.log("================================================================================");

  for (const t of targets) {
    const item = data.find((d: any) => d.repo.toLowerCase().includes(t.key.toLowerCase()));
    if (!item) {
      console.warn(`Target ${t.key} not found in baseline.`);
      continue;
    }

    const apiRoutes: ApiRoute[] = item.allRoutes.map((r: any, idx: number) => ({
      id: `r-${idx}`,
      method: r.method,
      path: r.path,
      name: "",
      file: r.file,
      source: "ast",
    }));

    const startTime = performance.now();
    const collection = synthesizeApiCollection(apiRoutes, { repoRoot: t.root });
    const duration = Math.round(performance.now() - startTime);

    let subfolderCount = 0;
    let singleRouteRootCount = 0;
    let collisionCount = 0;

    for (const f of collection) {
      const subs = f.children.filter((c: any) => "children" in c);
      const routes = f.children.filter((c: any) => !("children" in c));
      subfolderCount += subs.length;
      if (f.children.length === 1 && subs.length === 0 && f.name !== "General" && f.name !== "System & Health") {
        singleRouteRootCount++;
      }

      const routeSet = new Set<string>();
      for (const r of routes as ApiRoute[]) {
        const key = `${r.method} ${r.name}`;
        if (routeSet.has(key)) collisionCount++;
        else routeSet.add(key);
      }
    }

    console.log(`\n[${t.label}] ${t.key}:`);
    console.log(`  - Scanned Routes          : ${apiRoutes.length}`);
    console.log(`  - Total Root Collections  : ${collection.length}`);
    console.log(`  - Subfolders Formed       : ${subfolderCount}`);
    console.log(`  - 1-Route Root Noise      : ${singleRouteRootCount}`);
    console.log(`  - Sibling Name Collisions : ${collisionCount}`);
    console.log(`  - Processing Speed        : ${duration}ms`);

    // Verify key qualities
    if (singleRouteRootCount > 0) {
      console.error(`  ❌ FAIL: Found ${singleRouteRootCount} 1-route root folders!`);
    } else {
      console.log(`  ✅ PASS: 0 single-route root folder noise.`);
    }
  }

  console.log("\n================================================================================");
}

run().catch(console.error);
