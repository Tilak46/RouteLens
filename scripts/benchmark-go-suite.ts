import path from "node:path";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

interface GoBenchmarkTarget {
  name: string;
  level: string;
  description: string;
  projectPath: string;
  framework: string;
  realRoutes: number;
  skipOptionBReason?: string;
  optionBMaxCandidates?: number;
}

const GO_TARGETS: GoBenchmarkTarget[] = [
  {
    name: "bxcodec/go-clean-arch",
    level: "Level 2 (Ground-Truth Accuracy)",
    description: "Industry standard Clean Architecture REST API (Echo, 11k stars)",
    projectPath: path.resolve(".temp-benchmarks/go-eval/bxcodec-go-clean-arch"),
    framework: "Echo",
    realRoutes: 4,
    optionBMaxCandidates: 2,
  },
  {
    name: "swaggo/swag",
    level: "Level 3 (Nested Groups & Complexity)",
    description: "Official Swagger generator with nested Gin route groups",
    projectPath: path.resolve(".temp-benchmarks/go-eval/swag"),
    framework: "Gin / Multi",
    realRoutes: 20,
    optionBMaxCandidates: 3,
  },
  {
    name: "go-chi/chi",
    level: "Level 2/3 (Sub-Routers & Dynamic Routing)",
    description: "Canonical Chi router with sub-routers and rest examples",
    projectPath: path.resolve(".temp-benchmarks/go-eval/go-chi"),
    framework: "Chi",
    realRoutes: 44,
    optionBMaxCandidates: 3,
  },
  {
    name: "1Panel-dev/1Panel",
    level: "Level 1 (Volume & Throughput Stress)",
    description: "Enterprise Linux management panel (1,800+ files, 781 real routes)",
    projectPath: path.resolve(".temp-benchmarks/go-eval/1panel"),
    framework: "Gin",
    realRoutes: 781,
    skipOptionBReason: "216 files (~11 min on CPU LLM)",
  },
];

async function runGoEvaluation() {
  console.log("==================================================================================================");
  console.log("  🚀 OmniRoute Go Enterprise Suite: Side-by-Side Comparison (Option A vs. Option B)");
  console.log("==================================================================================================\n");

  const comparisonTable: any[] = [];
  const routeSamplesA: Record<string, any[]> = {};
  const routeSamplesB: Record<string, any[]> = {};

  for (let i = 0; i < GO_TARGETS.length; i++) {
    const target = GO_TARGETS[i];
    console.log(`▶ [${i + 1}/${GO_TARGETS.length}] Evaluating ${target.name} (Real Routes: ${target.realRoutes})...`);

    // --- 1. Run Option A (Universal Invariant AST) ---
    process.stdout.write("   • Running Option A (Universal Invariant AST)... ");
    const startA = performance.now();
    let resA: any = null;
    let errA: string | null = null;
    try {
      resA = await scanOmniRoutes(target.projectPath, { mode: "ast" });
    } catch (e: any) {
      errA = e.message;
    }
    const durationA = Math.round(performance.now() - startA);
    const countA = resA ? resA.routes.length : 0;
    const accA = ((countA / target.realRoutes) * 100).toFixed(1);
    console.log(`Found ${countA}/${target.realRoutes} (${accA}%) in ${durationA}ms.`);

    if (resA && resA.routes.length > 0) {
      routeSamplesA[target.name] = resA.routes.slice(0, 5).map((r: any) => ({
        method: r.method,
        path: r.path,
        file: path.basename(r.file),
      }));
    }

    // --- 2. Run Option B (AI-First Semantic Extraction) ---
    let countBStr = "N/A";
    let durationBStr = "N/A";
    let accBStr = "N/A";

    if (target.skipOptionBReason) {
      countBStr = `Skipped`;
      durationBStr = target.skipOptionBReason;
      accBStr = "N/A";
      console.log(`   • Skipping Option B on ${target.name}: ${target.skipOptionBReason}`);
    } else {
      process.stdout.write(`   • Running Option B (AI-First on top ${target.optionBMaxCandidates || 3} candidates)... `);
      const startB = performance.now();
      let resB: any = null;
      let errB: string | null = null;
      try {
        resB = await scanOmniRoutes(target.projectPath, {
          mode: "ai",
          maxAiRescues: target.optionBMaxCandidates || 3,
        });
      } catch (e: any) {
        errB = e.message;
      }
      const durationB = Math.round(performance.now() - startB);
      const countB = resB ? resB.routes.length : 0;
      const accB = ((countB / target.realRoutes) * 100).toFixed(1);
      countBStr = `${countB}/${target.realRoutes}`;
      durationBStr = `${durationB}ms`;
      accBStr = `${accB}%`;
      console.log(`Found ${countB}/${target.realRoutes} (${accB}%) in ${durationB}ms.`);

      if (resB && resB.routes.length > 0) {
        routeSamplesB[target.name] = resB.routes.slice(0, 5).map((r: any) => ({
          method: r.method,
          path: r.path,
          file: path.basename(r.file),
        }));
      }
    }

    comparisonTable.push({
      Target: target.name,
      Framework: target.framework,
      "Real Routes": target.realRoutes,
      "Option A (AST) Found": `${countA}/${target.realRoutes}`,
      "Opt A Acc %": `${accA}%`,
      "Opt A Latency": `${durationA}ms`,
      "Option B (AI) Found": countBStr,
      "Opt B Acc %": accBStr,
      "Opt B Latency": durationBStr,
    });
    console.log();
  }

  console.log("==================================================================================================");
  console.log("  🏆 Final Side-by-Side Benchmark Scorecard: Option A vs. Option B");
  console.log("==================================================================================================");
  console.table(comparisonTable);

  console.log("\n==================================================================================================");
  console.log("  🔍 Option A Route Extraction Samples (First 5 per repository)");
  console.log("==================================================================================================");
  for (const [name, samples] of Object.entries(routeSamplesA)) {
    console.log(`\n--- ${name} (Option A) ---`);
    console.table(samples);
  }
}

runGoEvaluation().catch(console.error);
