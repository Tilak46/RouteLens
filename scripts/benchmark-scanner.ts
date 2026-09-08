import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { scanProjectAst } from "../src/main/lib/scanner/core/scanner";
import { expressParser } from "../src/main/lib/scanner/parsers/expressParser";
import { nestParser } from "../src/main/lib/scanner/parsers/nestParser";
import type { DetectedRoute } from "../src/main/lib/scanner/core/types";

// Ensure AI route naming is completely bypassed to save API tokens
process.env.DISABLE_AI_ROUTE_NAMING = "1";

const TESTING_DIR = "c:\\Office-Work\\Testing";
const TARGET_DIR = path.join(TESTING_DIR, "easy");

// Existing 37 repos to strictly avoid re-testing
const EXISTING_REPOS = new Set([
  "acadelia",
  "booking-microservices-expressjs",
  "build.new",
  "builtforjob-be",
  "bulletproof-nodejs",
  "CallingAgnet",
  "clean-arch-express-starter",
  "Clone test",
  "decatron",
  "ECommerce-api",
  "endlessChat-Backend",
  "express-api-starter-ts",
  "express-rest-es2017",
  "express-typescript-2024",
  "FinalRound",
  "Group-5-Petopia_Market",
  "hackathon-starter",
  "hagopj13-express-boilerplate",
  "InterviewMinds",
  "irctc-backend",
  "job-application-tracker",
  "KAI",
  "nestjs-pg-crud",
  "nestjs-realworld-example-app",
  "node-mongo-signup-verification-api",
  "nodejs-microservices",
  "nodejs-microservices-demo",
  "open-budget-api",
  "parse-server",
  "quizMasterTurbo",
  "realworld-express",
  "rest-express-mongo-ugglr",
  "tandem-browser",
  "teampoint",
  "ts-express-mongoose-dahkenangnon",
  "VisionClaw-Agent-Public-Release",
  "warframe-status",
]);

type RepoCandidate = {
  name: string;
  fullName: string;
  stars: number;
  cloneUrl: string;
  description?: string;
  defaultBranch?: string;
};

type RepoBenchmarkResult = {
  repoName: string;
  repoPath: string;
  filesIndexed: number;
  potentialRoutes: number;
  detectedRoutes: number;
  detectionRate: number; // percentage
  scanDurationMs: number;
  methods: Record<string, number>;
  routesWithBody: number;
  routesWithQuery: number;
  routesWithParams: number;
  routesWithMiddlewares: number;
  missedFiles: Array<{ file: string; estimatedRoutes: number }>;
  sampleRoutes: Array<{ method: string; path: string; bodyFields?: string[] }>;
  error?: string;
};

async function fetchGitHubCandidates(count: number): Promise<RepoCandidate[]> {
  console.log(`[Benchmark] Querying GitHub API for popular Node + Express backend repositories...`);

  const searchQueries = [
    "express+rest+api+language:JavaScript+stars:>80",
    "express+rest+api+language:TypeScript+stars:>80",
    "node+express+backend+api+stars:>60",
    "express+crud+api+stars:>40",
    "node+express+jwt+authentication+stars:>50",
    "express+mongo+rest+api+stars:>60",
    "express+postgresql+api+stars:>40",
    "express+clean+architecture+stars:>40",
    "node+express+microservice+stars:>40",
    "express+ecommerce+backend+stars:>30",
    "express+blog+api+stars:>30",
    "express+typescript+starter+stars:>100",
    "express+api+template+stars:>50",
  ];

  const foundMap = new Map<string, RepoCandidate>();

  for (const q of searchQueries) {
    if (foundMap.size >= count * 1.5) break;

    try {
      console.log(`[Benchmark] Searching: ${q}`);
      const res = await fetch(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`, {
        headers: {
          "User-Agent": "RouteLens-Benchmark-Suite",
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!res.ok) {
        console.warn(`[Benchmark] GitHub query error (${res.status}): ${res.statusText}`);
        continue;
      }

      const data = await res.json();
      for (const item of (data.items || [])) {
        const repoName = item.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        // Skip if already in existing 37 repos
        if (EXISTING_REPOS.has(item.name) || EXISTING_REPOS.has(repoName)) continue;
        if (foundMap.has(item.full_name)) continue;

        foundMap.set(item.full_name, {
          name: item.name,
          fullName: item.full_name,
          stars: item.stargazers_count,
          cloneUrl: item.clone_url,
          description: item.description,
          defaultBranch: item.default_branch,
        });
      }

      // Respect rate limit with a small delay
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      console.warn(`[Benchmark] Search failed for ${q}:`, err);
    }
  }

  const sorted = Array.from(foundMap.values()).sort((a, b) => b.stars - a.stars);
  console.log(`[Benchmark] Total candidates fetched: ${sorted.length}`);
  return sorted.slice(0, count);
}

function cloneRepoShallow(candidate: RepoCandidate, targetParentDir: string): string | null {
  const safeName = candidate.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const destDir = path.join(targetParentDir, safeName);

  if (fs.existsSync(destDir)) {
    console.log(`[Clone] Already exists: ${safeName}`);
    return destDir;
  }

  console.log(`[Clone] Cloning ${candidate.fullName} (★ ${candidate.stars}) -> ${safeName}...`);
  try {
    execSync(`git clone --depth 1 "${candidate.cloneUrl}" "${destDir}"`, {
      stdio: "pipe",
      timeout: 60000,
    });
    return destDir;
  } catch (err: any) {
    console.error(`[Clone Failed] ${candidate.fullName}:`, err.message || err);
    // Cleanup if partially created
    if (fs.existsSync(destDir)) {
      try {
        fs.rmSync(destDir, { recursive: true, force: true });
      } catch {}
    }
    return null;
  }
}

async function findPotentialHttpCallsInFile(filePath: string): Promise<number> {
  try {
    const code = await fs.promises.readFile(filePath, "utf-8");
    const expressHttpRegex = /\b(?:app|router|route)\.(?:get|post|put|delete|patch)\s*\(/gi;
    const matches = code.match(expressHttpRegex);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

async function benchmarkSingleRepo(repoPath: string, repoName: string): Promise<RepoBenchmarkResult> {
  const startedAt = Date.now();
  try {
    const scanResult = await scanProjectAst(repoPath, [expressParser, nestParser]);
    const duration = Date.now() - startedAt;

    const routes = scanResult.routes;
    const methods: Record<string, number> = {};
    let routesWithBody = 0;
    let routesWithQuery = 0;
    let routesWithParams = 0;
    let routesWithMiddlewares = 0;

    const routesByFile = new Map<string, DetectedRoute[]>();

    for (const r of routes) {
      const m = r.method.toUpperCase();
      methods[m] = (methods[m] || 0) + 1;
      if (r.inferredBodyFields && r.inferredBodyFields.length > 0) routesWithBody++;
      if (r.inferredQueryFields && r.inferredQueryFields.length > 0) routesWithQuery++;
      if (r.pathParams && r.pathParams.length > 0) routesWithParams++;
      if (r.middlewares && r.middlewares.length > 0) routesWithMiddlewares++;

      const list = routesByFile.get(r.file) || [];
      list.push(r);
      routesByFile.set(r.file, list);
    }

    // Identify missed files: files where regex saw potential routes, but expressParser detected 0
    const missedFiles: Array<{ file: string; estimatedRoutes: number }> = [];
    const files = await fs.promises.readdir(repoPath, { recursive: true }).catch(() => []);
    
    // Check files that had HTTP patterns
    for (const f of files) {
      if (typeof f !== "string") continue;
      if (!/\.(js|ts|mjs|cjs)$/.test(f)) continue;
      if (f.includes("node_modules") || f.includes(".git") || f.includes("dist") || f.includes("test")) continue;

      const fullPath = path.join(repoPath, f);
      const est = await findPotentialHttpCallsInFile(fullPath);
      if (est > 0) {
        const detectedInThisFile = routesByFile.get(fullPath)?.length || 0;
        if (detectedInThisFile === 0) {
          missedFiles.push({ file: f.replace(/\\/g, "/"), estimatedRoutes: est });
        }
      }
    }

    const potential = Math.max(scanResult.potentialRoutesCount, routes.length);
    const detectionRate = potential > 0 ? Math.min(100, Math.round((routes.length / potential) * 100)) : (routes.length > 0 ? 100 : 0);

    return {
      repoName,
      repoPath,
      filesIndexed: scanResult.logs.find((l) => l.includes("Indexed")) ? parseInt(scanResult.logs.find((l) => l.includes("Indexed"))!.match(/\d+/)![0]) : 0,
      potentialRoutes: potential,
      detectedRoutes: routes.length,
      detectionRate,
      scanDurationMs: duration,
      methods,
      routesWithBody,
      routesWithQuery,
      routesWithParams,
      routesWithMiddlewares,
      missedFiles,
      sampleRoutes: routes.slice(0, 5).map((r) => ({
        method: r.method,
        path: r.path,
        bodyFields: r.inferredBodyFields,
      })),
    };
  } catch (err: any) {
    return {
      repoName,
      repoPath,
      filesIndexed: 0,
      potentialRoutes: 0,
      detectedRoutes: 0,
      detectionRate: 0,
      scanDurationMs: Date.now() - startedAt,
      methods: {},
      routesWithBody: 0,
      routesWithQuery: 0,
      routesWithParams: 0,
      routesWithMiddlewares: 0,
      missedFiles: [],
      sampleRoutes: [],
      error: err?.message || String(err),
    };
  }
}

async function run() {
  console.log("===============================================================");
  console.log("   RouteLens Hardcore Scanner Benchmark Suite (Express 50)");
  console.log("===============================================================\n");

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  // 1. Check existing repos already inside TARGET_DIR
  const existingInTarget = fs.readdirSync(TARGET_DIR)
    .filter((name) => fs.statSync(path.join(TARGET_DIR, name)).isDirectory());

  console.log(`[Status] Repos currently in ${TARGET_DIR}: ${existingInTarget.length}`);

  // 2. If fewer than 50, fetch candidates and clone
  const targetCount = 50;
  if (existingInTarget.length < targetCount) {
    const needed = targetCount - existingInTarget.length;
    console.log(`[Clone Phase] Need ${needed} more repos to reach ${targetCount}...`);
    const candidates = await fetchGitHubCandidates(needed * 2);

    let clonedCount = 0;
    for (const cand of candidates) {
      if (existingInTarget.length + clonedCount >= targetCount) break;
      const res = cloneRepoShallow(cand, TARGET_DIR);
      if (res) clonedCount++;
    }
    console.log(`[Clone Phase] Successfully cloned ${clonedCount} new repos.\n`);
  }

  // 3. Re-read all repos in TARGET_DIR
  const allRepos = fs.readdirSync(TARGET_DIR)
    .filter((name) => fs.statSync(path.join(TARGET_DIR, name)).isDirectory())
    .slice(0, targetCount);

  console.log(`[Benchmark Phase] Running AST scanner benchmark against ${allRepos.length} repos...\n`);

  const results: RepoBenchmarkResult[] = [];
  let index = 1;

  for (const repoName of allRepos) {
    const repoPath = path.join(TARGET_DIR, repoName);
    process.stdout.write(`[${index}/${allRepos.length}] Scanning ${repoName}... `);
    const result = await benchmarkSingleRepo(repoPath, repoName);
    results.push(result);

    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else {
      console.log(`✓ ${result.detectedRoutes}/${result.potentialRoutes} routes (${result.detectionRate}%) in ${result.scanDurationMs}ms`);
    }
    index++;
  }

  // 4. Summarize and generate report
  let totalPotential = 0;
  let totalDetected = 0;
  let totalWithBody = 0;
  let totalWithQuery = 0;
  let totalWithParams = 0;
  let perfectRepos = 0;
  let zeroRouteRepos = 0;

  for (const r of results) {
    totalPotential += r.potentialRoutes;
    totalDetected += r.detectedRoutes;
    totalWithBody += r.routesWithBody;
    totalWithQuery += r.routesWithQuery;
    totalWithParams += r.routesWithParams;
    if (r.detectedRoutes > 0 && r.detectionRate >= 90) perfectRepos++;
    if (r.detectedRoutes === 0 && r.potentialRoutes > 0) zeroRouteRepos++;
  }

  const overallRate = totalPotential > 0 ? Math.round((totalDetected / totalPotential) * 100) : 0;

  console.log("\n===============================================================");
  console.log("                      BENCHMARK RESULTS");
  console.log("===============================================================");
  console.log(`Total Repositories Scanned: ${results.length}`);
  console.log(`Total Routes Discovered:    ${totalDetected}`);
  console.log(`Total Potential Routes:     ${totalPotential}`);
  console.log(`Overall Detection Rate:     ${overallRate}%`);
  console.log(`Routes with Inferred Body:  ${totalWithBody}`);
  console.log(`Routes with Query Params:   ${totalWithQuery}`);
  console.log(`Routes with Path Params:    ${totalWithParams}`);
  console.log(`Repos with >=90% Detection: ${perfectRepos}/${results.length}`);
  console.log(`Repos with 0 Routes Found:  ${zeroRouteRepos}/${results.length}`);
  console.log("===============================================================\n");

  // Write JSON artifact
  const jsonPath = path.join(process.cwd(), "benchmark-results-express50.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ summary: { totalRepos: results.length, totalDetected, totalPotential, overallRate, totalWithBody }, results }, null, 2));
  console.log(`[Artifact] Wrote detailed JSON results to: ${jsonPath}`);

  // Collect missed patterns for engine diagnosis
  const reposWithMisses = results.filter((r) => r.missedFiles.length > 0 || (r.potentialRoutes > r.detectedRoutes));
  console.log(`\n[Diagnosis] Found ${reposWithMisses.length} repositories with missed routes or unhandled files.`);

  // Write diagnosis log
  const diagPath = path.join(process.cwd(), "benchmark-diagnosis-express50.json");
  fs.writeFileSync(diagPath, JSON.stringify(reposWithMisses, null, 2));
  console.log(`[Artifact] Wrote diagnosis report to: ${diagPath}`);
}

run().catch((err) => {
  console.error("Fatal benchmark error:", err);
  process.exit(1);
});
