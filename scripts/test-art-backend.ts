import path from "node:path";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";
import { scanProjectAst } from "../src/main/lib/scanner/core/scanner";
import { expressParser } from "../src/main/lib/scanner/parsers/expressParser";

async function benchmarkArtBackend() {
  const targetRepo = "c:\\Office-Work\\CRM\\Art-Backend";
  console.log("================================================================================");
  console.log("  Benchmark Test: Art-Backend (cc-product-server)");
  console.log(`  Target: ${targetRepo}`);
  console.log("================================================================================\n");

  // 1. Existing DevDash AST Scanner Benchmark
  console.log("--- 1. Testing Existing DevDash AST Scanner ---");
  const astStart = performance.now();
  const astResult = await scanProjectAst(targetRepo, [expressParser]);
  const astDuration = Math.round(performance.now() - astStart);

  const astMethods: Record<string, number> = {};
  for (const r of astResult.routes) {
    astMethods[r.method] = (astMethods[r.method] || 0) + 1;
  }

  console.log(`✓ Routes Discovered: ${astResult.routes.length}`);
  console.log(`✓ Scan Duration: ${astDuration} ms`);
  console.log(`✓ HTTP Methods:`, astMethods);
  console.log(`✓ Sample Routes:`);
  for (const r of astResult.routes.slice(0, 5)) {
    console.log(`    • ${r.method.padEnd(6)} ${r.path}`);
  }

  // 2. New OmniRoute Pipeline Benchmark (Fast Invariant Filter + Fast Matcher)
  console.log("\n--- 2. Testing New OmniRoute Pipeline ---");
  const omniStart = performance.now();
  const omniResult = await scanOmniRoutes(targetRepo, { enableAi: false });
  const omniDuration = Math.round(performance.now() - omniStart);

  const omniMethods: Record<string, number> = {};
  for (const r of omniResult.routes) {
    omniMethods[r.method] = (omniMethods[r.method] || 0) + 1;
  }

  console.log(`✓ Total Files in Repo: ${omniResult.totalFilesScanned}`);
  console.log(`✓ Candidate Route Files Identified: ${omniResult.candidateFilesCount}`);
  console.log(`✓ Fast Matched Routes Discovered: ${omniResult.fastMatchedRoutesCount}`);
  console.log(`✓ Unique Routes (Raw Unmounted): ${omniResult.routes.length}`);
  console.log(`✓ Scan Duration: ${omniDuration} ms`);
  console.log(`✓ HTTP Methods:`, omniMethods);
  console.log(`✓ Sample Routes:`);
  for (const r of omniResult.routes.slice(0, 5)) {
    console.log(`    • ${r.method.padEnd(6)} ${r.path}`);
  }

  console.log("\n================================================================================");
  console.log("  Benchmark Comparison Summary");
  console.log("================================================================================");
  console.table([
    {
      Engine: "Existing AST Scanner (Babel)",
      Language: "JS/TS Only",
      Routes: astResult.routes.length,
      MountLinked: "YES (/api/v1/...)",
      Duration: `${astDuration} ms`,
    },
    {
      Engine: "New OmniRoute (Filter + FastMatcher)",
      Language: "Universal (Multi-Lang)",
      Routes: omniResult.routes.length,
      MountLinked: "NO (Per-file raw)",
      Duration: `${omniDuration} ms`,
    },
  ]);
}

benchmarkArtBackend().catch(console.error);
