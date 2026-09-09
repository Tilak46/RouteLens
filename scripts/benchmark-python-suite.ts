import path from "node:path";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

interface PythonBenchmarkTarget {
  name: string;
  level: string;
  description: string;
  projectPath: string;
  framework: string;
  realRoutes: number;
}

const PYTHON_TARGETS: PythonBenchmarkTarget[] = [
  {
    name: "tiangolo/fastapi",
    level: "Level 1 (Volume & Production Stress)",
    description: "Official FastAPI framework repository (hundreds of tutorial apps & documentation apps)",
    projectPath: path.resolve(".temp-benchmarks/python-eval/fastapi-core/docs_src"),
    framework: "FastAPI",
    realRoutes: 430, // 430 unique method endpoints across tutorial apps
  },
  {
    name: "tiangolo/full-stack-fastapi-template",
    level: "Level 2 (Ground-Truth Accuracy)",
    description: "Official FastAPI template with APIRouter endpoints",
    projectPath: path.resolve(".temp-benchmarks/python-eval/fastapi-template"),
    framework: "FastAPI",
    realRoutes: 23,
  },
  {
    name: "nsidnev/fastapi-realworld-example-app",
    level: "Level 2/3 (Hierarchical Sub-Routers)",
    description: "Conduit API spec implementation with nested APIRouters",
    projectPath: path.resolve(".temp-benchmarks/python-eval/fastapi-realworld"),
    framework: "FastAPI",
    realRoutes: 19,
  },
  {
    name: "miguelgrinberg/microblog",
    level: "Level 2/3 (Production Flask Blueprints)",
    description: "Canonical Flask app with auth, main, and API blueprints",
    projectPath: path.resolve(".temp-benchmarks/python-eval/microblog"),
    framework: "Flask",
    realRoutes: 35,
  },
  {
    name: "pallets/flask",
    level: "Level 3 (Flask Core & Examples)",
    description: "Official Flask framework examples (auth, blog, task app, tutorial)",
    projectPath: path.resolve(".temp-benchmarks/python-eval/flask-core/examples"),
    framework: "Flask",
    realRoutes: 20,
  },
];

async function runPythonSuite() {
  console.log("==================================================================================================");
  console.log("  🐍 OmniRoute Python Enterprise Certification — Initial Baseline");
  console.log("==================================================================================================\n");

  const results: any[] = [];
  const routeSamples: Record<string, any[]> = {};

  for (let i = 0; i < PYTHON_TARGETS.length; i++) {
    const target = PYTHON_TARGETS[i];
    console.log(`▶ [${i + 1}/${PYTHON_TARGETS.length}] Evaluating ${target.name} [${target.level}]...`);

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
      const sliceCount = target.name === "pallets/flask" ? 30 : 6;
      routeSamples[target.name] = res.routes.slice(0, sliceCount).map((r: any) => ({
        method: r.method,
        path: r.path,
        file: path.relative(target.projectPath, r.file),
      }));
    }

    console.log(`   • Result: ${routesFound}/${target.realRoutes} (${accuracy}%) extracted from ${candidatesCount} candidates in ${duration}ms.\n`);
  }

  console.log("==================================================================================================");
  console.log("  📊 Python Certification Summary Table");
  console.log("==================================================================================================");
  console.table(results);
  fs.writeFileSync(path.resolve("scripts/python-results.json"), JSON.stringify(results, null, 2));
  console.log("Results saved to scripts/python-results.json");

  console.log("\n==================================================================================================");
  console.log("  🔍 Route Extraction Samples (First 6 per repository)");
  console.log("==================================================================================================");
  for (const [name, samples] of Object.entries(routeSamples)) {
    console.log(`\n--- ${name} ---`);
    console.table(samples);
  }
}

runPythonSuite().catch(console.error);
