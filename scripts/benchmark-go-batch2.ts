import path from "node:path";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

interface GoBenchmarkBatch2Target {
  name: string;
  level: string;
  description: string;
  projectPath: string;
  framework: string;
  realRoutes: number;
}

const BATCH2_TARGETS: GoBenchmarkBatch2Target[] = [
  {
    name: "apache/answer",
    level: "Level 1 (Volume & Production Stress)",
    description: "Apache enterprise Q&A platform (real Gin backend routes across controllers)",
    projectPath: path.resolve(".temp-benchmarks/go-eval-batch2/apache-answer"),
    framework: "Gin",
    realRoutes: 218,
  },
  {
    name: "gofiber/recipes",
    level: "Level 2 (Ground-Truth Accuracy & Multi-App)",
    description: "Official Fiber repository (real endpoints across 100+ recipe services)",
    projectPath: path.resolve(".temp-benchmarks/go-eval-batch2/gofiber-recipes"),
    framework: "Fiber",
    realRoutes: 264,
  },
  {
    name: "labstack/echo",
    level: "Level 3 (Routing Core & Complexity)",
    description: "Official Echo framework repository (route groups, URI matchers, sub-routers)",
    projectPath: path.resolve(".temp-benchmarks/go-eval-batch2/labstack-echo"),
    framework: "Echo",
    realRoutes: 4,
  },
  {
    name: "gin-gonic/examples",
    level: "Level 2/3 (Canonical Gin Patterns)",
    description: "Official Gin framework examples (real endpoints across microservices)",
    projectPath: path.resolve(".temp-benchmarks/go-eval-batch2/gin-examples"),
    framework: "Gin",
    realRoutes: 65,
  },
];

async function runGoBatch2() {
  console.log("==================================================================================================");
  console.log("  🌍 OmniRoute Go Enterprise Certification — Batch 2 (4 Brand New Repositories)");
  console.log("==================================================================================================\n");

  const results: any[] = [];
  const routeSamples: Record<string, any[]> = {};

  for (let i = 0; i < BATCH2_TARGETS.length; i++) {
    const target = BATCH2_TARGETS[i];
    console.log(`▶ [${i + 1}/${BATCH2_TARGETS.length}] Evaluating ${target.name} [${target.level}]...`);

    const start = performance.now();
    let res: any = null;
    let err: string | null = null;

    try {
      res = await scanOmniRoutes(target.projectPath, { mode: "ast" });
    } catch (e: any) {
      err = e.message;
    }

    const duration = Math.round(performance.now() - start);
    const routesFound = res ? res.routes.length : 0;
    const candidatesCount = res ? res.candidateFilesCount : 0;
    const filesScanned = res ? res.totalFilesScanned : 0;
    const accuracy = ((routesFound / target.realRoutes) * 100).toFixed(1);

    results.push({
      Target: target.name,
      Level: target.level,
      Framework: target.framework,
      "Files Scanned": filesScanned,
      "Candidate Files": candidatesCount,
      "Real Routes": target.realRoutes,
      "Routes Found": `${routesFound}/${target.realRoutes}`,
      "Accuracy %": `${accuracy}%`,
      "Latency (ms)": `${duration}ms`,
      Status: err ? "FAILED" : routesFound >= target.realRoutes * 0.9 ? "PASSED" : "NEEDS_REVIEW",
    });

    if (res && res.routes.length > 0) {
      routeSamples[target.name] = res.routes.slice(0, 6).map((r: any) => ({
        method: r.method,
        path: r.path,
        file: path.relative(target.projectPath, r.file),
      }));
    }

    console.log(`   • Result: ${routesFound}/${target.realRoutes} (${accuracy}%) extracted from ${candidatesCount} candidates in ${duration}ms.\n`);
  }

  console.log("==================================================================================================");
  console.log("  📊 Go Batch 2 Certification Summary Table");
  console.log("==================================================================================================");
  console.table(results);

  console.log("\n==================================================================================================");
  console.log("  🔍 Route Extraction Samples (First 6 per repository)");
  console.log("==================================================================================================");
  for (const [name, samples] of Object.entries(routeSamples)) {
    console.log(`\n--- ${name} ---`);
    console.table(samples);
  }
}

runGoBatch2().catch(console.error);
