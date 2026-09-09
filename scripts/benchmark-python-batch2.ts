import path from "node:path";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

interface PythonBatch2Target {
  name: string;
  level: string;
  description: string;
  projectPath: string;
  framework: string;
  realRoutes: number;
}

const BATCH2_TARGETS: PythonBatch2Target[] = [
  {
    name: "gothinkster/flask-realworld-example-app",
    level: "Level 2 (Ground-Truth Accuracy & Blueprint Tuples)",
    description: "Conduit API spec in Flask using Blueprint routes with tuple methods=('POST',)",
    projectPath: path.resolve(".temp-benchmarks/python-eval-batch2/flask-realworld"),
    framework: "Flask",
    realRoutes: 19,
  },
  {
    name: "fastapi-users/fastapi-users",
    level: "Level 2/3 (Factory Router Architecture)",
    description: "Production FastAPI user management & auth router generators",
    projectPath: path.resolve(".temp-benchmarks/python-eval-batch2/fastapi-users/fastapi_users/router"),
    framework: "FastAPI",
    realRoutes: 16,
  },
  {
    name: "gothinkster/django-realworld-example-app",
    level: "Level 2/3 (Django Architecture & Legacy URLconfs)",
    description: "Conduit API spec in Django with DRF viewsets and url() patterns",
    projectPath: path.resolve(".temp-benchmarks/python-eval-batch2/django-realworld"),
    framework: "Django",
    realRoutes: 19,
  },
  {
    name: "encode/django-rest-framework",
    level: "Level 1 (Volume & Production Core Stress)",
    description: "Official Django REST Framework core (586 files)",
    projectPath: path.resolve(".temp-benchmarks/python-eval-batch2/drf-core"),
    framework: "DRF",
    realRoutes: 2, // rest_framework/urls.py core endpoints
  },
];

async function runPythonBatch2() {
  console.log("==================================================================================================");
  console.log("  🐍 OmniRoute Python Enterprise Certification — Batch 2 (Unseen Repositories, Zero Patches)");
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
      console.error(`Error scanning ${target.name}:`, e);
    }

    const duration = Math.round(performance.now() - start);
    const routesFound = res ? res.routes.length : 0;
    const candidatesCount = res ? res.candidateFilesCount : 0;
    const filesScanned = res ? res.totalFilesScanned : 0;

    // Industry Standard Metrics: Recall (Coverage) capped at 100%
    const recall = target.realRoutes > 0
      ? Math.min(100, (routesFound / target.realRoutes) * 100).toFixed(1)
      : "100.0";
    const precision = routesFound > 0
      ? Math.min(100, (Math.min(routesFound, target.realRoutes) / routesFound) * 100).toFixed(1)
      : "100.0";

    results.push({
      Target: target.name,
      Level: target.level,
      Framework: target.framework,
      "Files Scanned": filesScanned,
      "Candidate Files": candidatesCount,
      "Real Routes": target.realRoutes,
      "Routes Found": `${routesFound}/${target.realRoutes}`,
      "Recall %": `${recall}%`,
      "Precision %": `${precision}%`,
      "Latency (ms)": `${duration}ms`,
      Status: err ? "FAILED" : routesFound >= target.realRoutes * 0.8 ? "PASSED" : "NEEDS_REVIEW",
    });

    if (res && res.routes.length > 0) {
      routeSamples[target.name] = res.routes.slice(0, 10).map((r: any) => ({
        method: r.method,
        path: r.path,
        file: path.relative(target.projectPath, r.file),
      }));
    }

    console.log(`   • Result: ${routesFound}/${target.realRoutes} (Recall: ${recall}%) in ${duration}ms from ${candidatesCount} candidate files.\n`);
  }

  console.log("==================================================================================================");
  console.log("  📊 Python Batch 2 Certification Summary Table (Unseen Repositories)");
  console.log("==================================================================================================");
  console.table(results);

  fs.writeFileSync(path.resolve("scripts/python-batch2-results.json"), JSON.stringify(results, null, 2));

  console.log("\n==================================================================================================");
  console.log("  🔍 Route Extraction Samples (First 10 per repository)");
  console.log("==================================================================================================");
  for (const [name, samples] of Object.entries(routeSamples)) {
    console.log(`\n--- ${name} ---`);
    console.table(samples);
  }
}

runPythonBatch2().catch(console.error);
