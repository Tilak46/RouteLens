import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";
import { scanProjectAst } from "../src/main/lib/scanner/core/scanner";
import { expressParser, nestParser } from "../src/main/lib/scanner/parsers";

const TESTING_DIR = "c:\\Office-Work\\Testing";

// Selected diverse test repositories (including Node Express, NestJS, and C# decatron)
const TEST_PROJECTS = [
  "decatron", // C# ASP.NET Core
  "bulletproof-nodejs", // Node.js Clean Architecture Express
  "booking-microservices-expressjs", // Microservices Express
  "clean-arch-express-starter", // Express Clean Architecture
  "express-api-starter-ts", // TypeScript Express Starter
  "express-typescript-2024", // Modern Express TypeScript
  "hackathon-starter", // Classic Multi-Route Express
  "hagopj13-express-boilerplate", // Modular Express Boilerplate
  "irctc-backend", // Production IRCTC Clone Backend
  "job-application-tracker", // Full-stack Express Tracker
  "nestjs-pg-crud", // NestJS Decorators
  "nestjs-realworld-example-app", // NestJS RealWorld
  "node-mongo-signup-verification-api", // Auth API
  "realworld-express", // RealWorld Express
  "warframe-status", // Status API
];

async function runBenchmark() {
  console.log("================================================================================");
  console.log(`  Testing Suite Multi-Project Benchmark (${TEST_PROJECTS.length} Projects)`);
  console.log(`  Root: ${TESTING_DIR}`);
  console.log("================================================================================\n");

  const results = [];

  for (let i = 0; i < TEST_PROJECTS.length; i++) {
    const projName = TEST_PROJECTS[i];
    const projPath = path.join(TESTING_DIR, projName);

    if (!fs.existsSync(projPath)) {
      console.log(`[Skip] Directory not found: ${projPath}`);
      continue;
    }

    console.log(`\n▶ [${i + 1}/${TEST_PROJECTS.length}] Benchmarking: ${projName}`);

    // 1. Old Style Babel AST Scanner
    let astRoutes = 0;
    let astDuration = 0;
    let astError = null;
    const astStart = performance.now();
    try {
      const res = await scanProjectAst(projPath, [expressParser, nestParser]);
      astRoutes = res.routes.length;
      astDuration = Math.round(performance.now() - astStart);
    } catch (err: any) {
      astDuration = Math.round(performance.now() - astStart);
      astError = err.message;
    }

    // 2. New OmniRoute Pipeline
    let omniRoutes = 0;
    let omniDuration = 0;
    let omniCandidates = 0;
    let omniError = null;
    const omniStart = performance.now();
    try {
      const res = await scanOmniRoutes(projPath, { enableAi: false });
      omniRoutes = res.routes.length;
      omniCandidates = res.candidateFilesCount;
      omniDuration = Math.round(performance.now() - omniStart);
    } catch (err: any) {
      omniDuration = Math.round(performance.now() - omniStart);
      omniError = err.message;
    }

    const speedup =
      astDuration > 0 && omniDuration > 0
        ? (astDuration / omniDuration).toFixed(1) + "x"
        : "N/A";

    results.push({
      Project: projName,
      "AST Routes": astError ? "ERROR" : astRoutes,
      "AST Time": `${astDuration}ms`,
      "Omni Routes": omniError ? "ERROR" : omniRoutes,
      "Omni Candidates": omniCandidates,
      "Omni Time": `${omniDuration}ms`,
      Speedup: speedup,
    });

    console.log(`   • Babel AST:  ${astRoutes} routes (${astDuration}ms)`);
    console.log(`   • OmniRoute:  ${omniRoutes} routes (${omniDuration}ms) [${omniCandidates} candidates] | Speedup: ${speedup}`);
  }

  console.log("\n================================================================================");
  console.log("  Benchmark Summary & Comparison Table");
  console.log("================================================================================");
  console.table(results);
}

runBenchmark().catch(console.error);
