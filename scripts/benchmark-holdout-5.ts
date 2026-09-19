import fs from "fs";
import path from "path";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

interface HoldoutTarget {
  name: string;
  repo: string;
  category: string;
  architecture: string;
  folder: string;
}

const TARGETS: HoldoutTarget[] = [
  {
    name: "Traefik",
    repo: "traefik/traefik",
    category: "Cloud-Native API Gateway",
    architecture: "Gorilla Mux subrouters & API middleware",
    folder: "traefik",
  },
  {
    name: "OAuth2-Proxy",
    repo: "oauth2-proxy/oauth2-proxy",
    category: "Enterprise Reverse Proxy",
    architecture: "net/http ServeMux & OAuth2 handler chains",
    folder: "oauth2-proxy",
  },
  {
    name: "InfluxDB",
    repo: "influxdata/influxdb",
    category: "Time-Series Database",
    architecture: "net/http ServeMux & Pat URL routing",
    folder: "influxdb",
  },
  {
    name: "Drone CI",
    repo: "harness/drone",
    category: "CI/CD Automation Server",
    architecture: "Chi router with nested sub-resource routing",
    folder: "drone",
  },
  {
    name: "IPFS (Kubo)",
    repo: "ipfs/kubo",
    category: "Decentralized P2P Gateway",
    architecture: "net/http ServeMux gateway & RPC endpoints",
    folder: "kubo",
  },
];

function countGoFiles(dir: string): number {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;
  function walk(curr: string) {
    const entries = fs.readdirSync(curr, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules" || e.name === "vendor") continue;
      const full = path.join(curr, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith(".go")) count++;
    }
  }
  walk(dir);
  return count;
}

async function runHoldoutBenchmark() {
  const baseDir = path.resolve(".temp-benchmarks/go-holdout");
  console.log("================================================================================");
  console.log("  RouteLens OmniRoute - STRICT ZERO-SHOT HOLDOUT BENCHMARK (5 UNTOUCHED REPOS)  ");
  console.log("  Engine Code: 100% UNMODIFIED. Testing Generalization Across Real-World Go     ");
  console.log("================================================================================\n");

  const results: any[] = [];

  for (const target of TARGETS) {
    const targetPath = path.join(baseDir, target.folder);
    if (!fs.existsSync(targetPath)) {
      console.warn(`[WARN] Missing directory: ${targetPath}`);
      continue;
    }

    const goFiles = countGoFiles(targetPath);
    process.stdout.write(`Scanning [${target.name}] (${target.repo})... `);
    const start = Date.now();
    const res = await scanOmniRoutes(targetPath, { mode: "ast" });
    const durationMs = Date.now() - start;

    const methodCounts: Record<string, number> = {};
    for (const r of res.routes) {
      methodCounts[r.method] = (methodCounts[r.method] || 0) + 1;
    }

    results.push({
      meta: target,
      goFiles,
      routes: res.routes.length,
      durationMs,
      methodCounts,
      routesList: res.routes.map((r) => ({
        method: r.method,
        path: r.path,
        file: path.basename(r.file),
      })),
      sample: res.routes.slice(0, 3).map((r) => `${r.method} ${r.path}`),
    });

    console.log(`${res.routes.length} routes found (${durationMs}ms) across ${goFiles} Go files.`);
  }

  fs.writeFileSync(
    "scripts/benchmark-holdout-5-results.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  console.log("\n================================================================================");
  console.log("                           HOLDOUT SCAN COMPLETE                                ");
  console.log("================================================================================\n");
}

runHoldoutBenchmark();
