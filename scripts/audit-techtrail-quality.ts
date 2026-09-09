import path from "node:path";
import fs from "node:fs";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";
import { scanProjectAst } from "../src/main/lib/scanner/core/scanner";
import { expressParser } from "../src/main/lib/scanner/parsers/expressParser";

async function auditQuality() {
  const targetRepo = "c:\\Office-Work\\TechTail-DMC\\TechTrailDMC-Server";

  console.log("================================================================================");
  console.log("  In-Depth Quality Audit: TechTrailDMC-Server");
  console.log("================================================================================\n");

  const omniResult = await scanOmniRoutes(targetRepo, { enableAi: false });
  const astResult = await scanProjectAst(targetRepo, [expressParser]);

  // Check 1: Where do routes originate from? (Route files vs Controller files)
  let omniFromRouteFiles = 0;
  let omniFromControllerFiles = 0;
  let omniFromOtherFiles = 0;

  const omniControllerRoutes: any[] = [];
  const omniRouteFileRoutes: any[] = [];

  for (const r of omniResult.routes) {
    const rel = path.relative(targetRepo, r.file).replace(/\\/g, "/");
    if (rel.includes("src/routes/")) {
      omniFromRouteFiles++;
      omniRouteFileRoutes.push({ ...r, relFile: rel });
    } else if (rel.includes("src/controllers/")) {
      omniFromControllerFiles++;
      omniControllerRoutes.push({ ...r, relFile: rel });
    } else {
      omniFromOtherFiles++;
    }
  }

  console.log("--- 1. Route Source Origin Breakdown (OmniRoute) ---");
  console.log(`Total Routes Discovered: ${omniResult.routes.length}`);
  console.log(`  • Defined in src/routes/ (Actual Server Route Files): ${omniFromRouteFiles}`);
  console.log(`  • Found in src/controllers/ (Outgoing Axios Client Calls): ${omniFromControllerFiles}`);
  console.log(`  • Other files (src/app.ts, etc.): ${omniFromOtherFiles}`);

  // Check 2: Prefix Quality Check
  // Proper routes should start with /api/v1/ or /airports or /
  let fullPrefixCount = 0;
  let partialPrefixCount = 0;
  const samplePrefixes: Record<string, number> = {};

  for (const r of omniResult.routes) {
    const firstTwo = r.path.split("/").slice(0, 4).join("/");
    samplePrefixes[firstTwo] = (samplePrefixes[firstTwo] || 0) + 1;
    if (r.path.startsWith("/api/v1/")) {
      fullPrefixCount++;
    } else {
      partialPrefixCount++;
    }
  }

  console.log("\n--- 2. Route Path Prefix Quality ---");
  console.log(`Routes with Full /api/v1/... Prefix: ${fullPrefixCount}`);
  console.log(`Routes without /api/v1/ Prefix (unmounted or raw): ${partialPrefixCount}`);
  console.log("\nTop URL Prefixes in OmniRoute:");
  console.table(
    Object.entries(samplePrefixes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([prefix, count]) => ({ Prefix: prefix || "/", Count: count }))
  );

  // Check 3: Check AST Scanner on the same origin check
  let astFromRouteFiles = 0;
  let astFromControllerFiles = 0;
  for (const r of astResult.routes) {
    const rel = path.relative(targetRepo, r.file).replace(/\\/g, "/");
    if (rel.includes("src/routes/")) {
      astFromRouteFiles++;
    } else if (rel.includes("src/controllers/")) {
      astFromControllerFiles++;
    }
  }

  console.log("\n--- 3. AST Scanner Origin Comparison ---");
  console.log(`AST Total Routes: ${astResult.routes.length}`);
  console.log(`  • AST Routes from src/routes/: ${astFromRouteFiles}`);
  console.log(`  • AST Routes from src/controllers/: ${astFromControllerFiles}`);

  // Check 4: Route Method Integrity Sample
  // Let's verify 5 real route files against their true definitions
  console.log("\n--- 4. Ground Truth Route Verification on Specific Route Files ---");

  // File A: src/routes/travelAgent/auth/auth.route.ts
  const authRoutesOmni = omniResult.routes.filter((r) =>
    r.file.includes("travelAgent\\auth\\auth.route.ts") || r.file.includes("travelAgent/auth/auth.route.ts")
  );
  console.log(`\nTravel Agent Auth Routes (File: travelAgent/auth/auth.route.ts):`);
  console.log(`Expected Base URL: /api/v1/travel-agent/auth`);
  for (const r of authRoutesOmni) {
    console.log(`   [${r.method}] ${r.path}`);
  }

  // File B: src/routes/admin/flight/flight.route.ts
  const adminFlightOmni = omniResult.routes.filter((r) =>
    r.file.includes("admin\\flight\\flight.route.ts") || r.file.includes("admin/flight/flight.route.ts")
  );
  console.log(`\nAdmin Flight Routes (File: admin/flight/flight.route.ts):`);
  console.log(`Expected Base URL: /api/v1/admin/flight-data`);
  for (const r of adminFlightOmni) {
    console.log(`   [${r.method}] ${r.path}`);
  }

  // Check 5: False Positive Outgoing Axios Calls
  console.log("\n--- 5. Outgoing Client Calls Mistaken as Routes (In Controllers) ---");
  for (const r of omniControllerRoutes.slice(0, 8)) {
    console.log(`   [${r.method}] ${r.path.padEnd(25)} (in ${r.relFile})`);
  }
}

auditQuality().catch(console.error);
