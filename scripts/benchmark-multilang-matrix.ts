import path from "node:path";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

interface MatrixProject {
  name: string;
  language: string;
  framework: string;
  projectPath: string;
  expectedMinRoutes: number;
}

const MATRIX_SUITE: MatrixProject[] = [
  {
    name: "Go Gin RealWorld",
    language: "Go",
    framework: "Gin",
    projectPath: path.resolve(".temp-benchmarks/go-gin"),
    expectedMinRoutes: 20,
  },
  {
    name: "Python FastAPI RealWorld",
    language: "Python",
    framework: "FastAPI",
    projectPath: path.resolve(".temp-benchmarks/python-fastapi"),
    expectedMinRoutes: 18,
  },
  {
    name: "Java Spring Boot RealWorld",
    language: "Java",
    framework: "Spring Boot",
    projectPath: path.resolve(".temp-benchmarks/java-spring"),
    expectedMinRoutes: 15,
  },
  {
    name: "PHP Laravel RealWorld",
    language: "PHP",
    framework: "Laravel",
    projectPath: path.resolve(".temp-benchmarks/php-laravel"),
    expectedMinRoutes: 18,
  },
  {
    name: "C# ASP.NET Core (Decatron)",
    language: "C#",
    framework: "ASP.NET Core",
    projectPath: "c:\\Office-Work\\Testing\\decatron",
    expectedMinRoutes: 300,
  },
  {
    name: "NestJS Decorators RealWorld",
    language: "TypeScript",
    framework: "NestJS",
    projectPath: "c:\\Office-Work\\Testing\\nestjs-realworld-example-app",
    expectedMinRoutes: 21,
  },
  {
    name: "Next.js 14 App Router Tracker",
    language: "TypeScript",
    framework: "Next.js (App Router)",
    projectPath: "c:\\Office-Work\\Testing\\job-application-tracker",
    expectedMinRoutes: 2,
  },
  {
    name: "Express Classic (Hackathon Starter)",
    language: "JavaScript",
    framework: "Express",
    projectPath: "c:\\Office-Work\\Testing\\hackathon-starter",
    expectedMinRoutes: 100,
  },
  {
    name: "Python Production Enterprise (KAI)",
    language: "Python",
    framework: "FastAPI (Large)",
    projectPath: "c:\\Office-Work\\Testing\\KAI",
    expectedMinRoutes: 50,
  },
];

async function runMultiLangMatrix() {
  console.log("================================================================================");
  console.log("  🌍 Universal OmniRoute Multi-Language Benchmark Matrix (7 Ecosystems)");
  console.log("================================================================================\n");

  const results: any[] = [];

  for (let i = 0; i < MATRIX_SUITE.length; i++) {
    const proj = MATRIX_SUITE[i];
    console.log(`▶ [${i + 1}/${MATRIX_SUITE.length}] Benchmarking ${proj.name} (${proj.language} / ${proj.framework})...`);

    const start = performance.now();
    let res: any = null;
    let error: string | null = null;

    try {
      res = await scanOmniRoutes(proj.projectPath, { enableAi: false });
    } catch (err: any) {
      error = err.message;
    }

    const duration = Math.round(performance.now() - start);
    const routesCount = res ? res.routes.length : 0;
    const candidatesCount = res ? res.candidateFilesCount : 0;
    const filesScanned = res ? res.totalFilesScanned : 0;
    const status = routesCount >= proj.expectedMinRoutes ? "✅ PASSED" : "⚠️ LOW COUNT";

    results.push({
      "Project / Target": proj.name,
      Language: proj.language,
      Framework: proj.framework,
      "Files Scanned": filesScanned,
      "Candidates": candidatesCount,
      "Routes Found": error ? "ERROR" : routesCount,
      "Scan Latency": `${duration}ms`,
      Status: error ? "❌ FAILED" : status,
    });

    console.log(`   • Result: ${routesCount} routes found in ${duration}ms across ${candidatesCount} candidates. [${status}]\n`);
  }

  console.log("================================================================================");
  console.log("  🏆 Final Multi-Language Benchmark Summary Table");
  console.log("================================================================================");
  console.table(results);
}

runMultiLangMatrix().catch(console.error);
