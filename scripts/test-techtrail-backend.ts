import path from "node:path";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";
import { scanProjectAst } from "../src/main/lib/scanner/core/scanner";
import { expressParser } from "../src/main/lib/scanner/parsers/expressParser";

async function benchmarkTechTrailBackend() {
  const targetRepo = "c:\\Office-Work\\TechTail-DMC\\TechTrailDMC-Server";
  console.log("================================================================================");
  console.log("  Benchmark Test: TechTrailDMC-Server");
  console.log(`  Target: ${targetRepo}`);
  console.log("================================================================================\n");

  // 1. Existing DevDash AST Scanner Benchmark (Old Style Babel)
  console.log("--- 1. Testing Existing DevDash AST Scanner (Babel Old Style) ---");
  const astStart = performance.now();
  let astResult: any = { routes: [] };
  try {
    astResult = await scanProjectAst(targetRepo, [expressParser]);
  } catch (err: any) {
    console.error("AST scan error:", err.message);
  }
  const astDuration = Math.round(performance.now() - astStart);

  const astMethods: Record<string, number> = {};
  for (const r of astResult.routes) {
    astMethods[r.method] = (astMethods[r.method] || 0) + 1;
  }

  console.log(`✓ Routes Discovered: ${astResult.routes.length}`);
  console.log(`✓ Scan Duration: ${astDuration} ms`);
  console.log(`✓ HTTP Methods:`, astMethods);
  console.log(`✓ Sample Routes (AST):`);
  for (const r of astResult.routes.slice(0, 10)) {
    console.log(`    • ${r.method.padEnd(6)} ${r.path}`);
  }

  // 2. New OmniRoute Pipeline Benchmark (Invariant Filter + Mount Linker)
  console.log("\n--- 2. Testing New OmniRoute Pipeline ---");
  const omniStart = performance.now();
  let omniResult: any = { routes: [], totalFilesScanned: 0, candidateFilesCount: 0, fastMatchedRoutesCount: 0 };
  try {
    omniResult = await scanOmniRoutes(targetRepo, { enableAi: false });
  } catch (err: any) {
    console.error("OmniRoute scan error:", err.message);
  }
  const omniDuration = Math.round(performance.now() - omniStart);

  const omniMethods: Record<string, number> = {};
  for (const r of omniResult.routes) {
    omniMethods[r.method] = (omniMethods[r.method] || 0) + 1;
  }

  console.log(`✓ Total Files in Repo: ${omniResult.totalFilesScanned}`);
  console.log(`✓ Candidate Route Files Identified: ${omniResult.candidateFilesCount}`);
  console.log(`✓ Routes Discovered: ${omniResult.routes.length}`);
  console.log(`✓ Scan Duration: ${omniDuration} ms`);
  console.log(`✓ HTTP Methods:`, omniMethods);
  console.log(`\nSample Assembled Production Routes (OmniRoute):`);
  for (const r of omniResult.routes.slice(0, 15)) {
    console.log(`    • ${r.method.padEnd(6)} ${r.path}`);
  }

  console.log("\n================================================================================");
  console.log("  Benchmark Comparison Summary");
  console.log("================================================================================");
  console.table([
    {
      Engine: "Existing AST Scanner (Babel Old Style)",
      Language: "JS/TS Only",
      Routes: astResult.routes.length,
      Duration: `${astDuration} ms`,
    },
    {
      Engine: "New OmniRoute (Invariant Filter + Mount Linker)",
      Language: "Universal (Multi-Lang)",
      Routes: omniResult.routes.length,
      Duration: `${omniDuration} ms`,
    },
  ]);
}

benchmarkTechTrailBackend().catch(console.error);
