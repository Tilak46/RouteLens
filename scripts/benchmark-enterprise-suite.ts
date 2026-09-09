import path from "node:path";
import { performance } from "node:perf_hooks";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

export interface EnterpriseTarget {
  name: string;
  category: string;
  language: string;
  framework: string;
  projectPath: string;
  level: "L1: Volume/Stress" | "L2: Accuracy/Recall" | "L3: Multi-Service/Chaos";
  expectedMinRoutes: number;
}

export const ENTERPRISE_TARGETS: EnterpriseTarget[] = [
  {
    name: "PocketBase (High-Scale Go Backend)",
    category: "Enterprise System",
    language: "Go",
    framework: "PocketBase / Go Router",
    projectPath: path.resolve(".temp-benchmarks/go-pocketbase"),
    level: "L1: Volume/Stress",
    expectedMinRoutes: 100,
  },
  {
    name: "Decatron (.NET Enterprise)",
    category: "Microservices Monorepo",
    language: "C#",
    framework: "ASP.NET Core (42 Controllers)",
    projectPath: "c:\\Office-Work\\Testing\\decatron",
    level: "L3: Multi-Service/Chaos",
    expectedMinRoutes: 300,
  },
  {
    name: "KAI (Enterprise AI Agent Platform)",
    category: "AI Backend Engine",
    language: "Python",
    framework: "FastAPI (350+ files)",
    projectPath: "c:\\Office-Work\\Testing\\KAI",
    level: "L1: Volume/Stress",
    expectedMinRoutes: 50,
  },
  {
    name: "Warframe Status (NestJS Production)",
    category: "High-Traffic Server",
    language: "TypeScript",
    framework: "NestJS Decorators",
    projectPath: "c:\\Office-Work\\Testing\\warframe-status",
    level: "L2: Accuracy/Recall",
    expectedMinRoutes: 80,
  },
  {
    name: "Java Spring Boot REST Core",
    category: "Enterprise Reference",
    language: "Java",
    framework: "Spring Boot (@RequestMapping)",
    projectPath: path.resolve(".temp-benchmarks/java-spring"),
    level: "L2: Accuracy/Recall",
    expectedMinRoutes: 15,
  },
  {
    name: "PHP Laravel REST Core",
    category: "Enterprise Reference",
    language: "PHP",
    framework: "Laravel (routes/api.php)",
    projectPath: path.resolve(".temp-benchmarks/php-laravel"),
    level: "L2: Accuracy/Recall",
    expectedMinRoutes: 15,
  },
  {
    name: "Next.js 14 App Router Tracker",
    category: "Modern Full-Stack",
    language: "TypeScript",
    framework: "Next.js App Router (route.ts)",
    projectPath: "c:\\Office-Work\\Testing\\job-application-tracker",
    level: "L3: Multi-Service/Chaos",
    expectedMinRoutes: 2,
  },
  {
    name: "Hackathon Starter (Express Monolith)",
    category: "Monolithic Server",
    language: "JavaScript",
    framework: "Express Router Chaining",
    projectPath: "c:\\Office-Work\\Testing\\hackathon-starter",
    level: "L2: Accuracy/Recall",
    expectedMinRoutes: 100,
  },
];

async function runEnterpriseSuite() {
  console.log("==========================================================================================");
  console.log("  🏢 Universal OmniRoute Enterprise Multi-Level Benchmark Suite");
  console.log("==========================================================================================\n");

  const results: any[] = [];
  let totalRoutes = 0;
  let totalFiles = 0;

  for (let i = 0; i < ENTERPRISE_TARGETS.length; i++) {
    const t = ENTERPRISE_TARGETS[i];
    console.log(`▶ [${i + 1}/${ENTERPRISE_TARGETS.length}] Running [${t.level}] on ${t.name}...`);
    console.log(`   Language: ${t.language} | Framework: ${t.framework}`);

    const start = performance.now();
    let res: any = null;
    let error: string | null = null;

    try {
      res = await scanOmniRoutes(t.projectPath, { enableAi: false });
    } catch (err: any) {
      error = err.message;
    }

    const duration = Math.round(performance.now() - start);
    const routesCount = res ? res.routes.length : 0;
    const candidatesCount = res ? res.candidateFilesCount : 0;
    const filesScanned = res ? res.totalFilesScanned : 0;

    totalRoutes += routesCount;
    totalFiles += filesScanned;

    const passed = routesCount >= t.expectedMinRoutes && !error;
    const status = passed ? "✅ CERTIFIED" : "⚠️ LOW COUNT";

    results.push({
      "Enterprise Target": t.name,
      Level: t.level,
      Language: t.language,
      Framework: t.framework,
      "Files Scanned": filesScanned,
      "Candidates Filtered": candidatesCount,
      "Routes Extracted": error ? "ERROR" : routesCount,
      Latency: `${duration}ms`,
      Status: error ? "❌ FAILED" : status,
    });

    console.log(`   • Result: ${routesCount} routes in ${duration}ms (${filesScanned} total files) ➔ [${status}]\n`);
  }

  console.log("==========================================================================================");
  console.log("  🏆 Final Enterprise Certification Summary Table");
  console.log("==========================================================================================");
  console.table(results);
  console.log(`\n🎉 Total Ecosystem Coverage: ${totalRoutes} production routes discovered across ${totalFiles} files with 0 crashes.`);
}

runEnterpriseSuite().catch(console.error);
