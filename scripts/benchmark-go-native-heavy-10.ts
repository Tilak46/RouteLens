import fs from "node:fs";
import path from "node:path";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

interface TargetMeta {
  name: string;
  repo: string;
  category: "Old / Legacy" | "Modern / Massive";
  era: string;
  architecture: string;
  folder: string;
}

const TARGETS: TargetMeta[] = [
  // 5 Old / Legacy Backends (Go 1.0 - 1.15 era pre-1.22 architectures)
  {
    name: "Docker (Moby)",
    repo: "moby/moby",
    category: "Old / Legacy",
    era: "2013 (Classic Go 1.2+)",
    architecture: "router.New<Method>Route constructor pattern",
    folder: "moby",
  },
  {
    name: "Prometheus",
    repo: "prometheus/prometheus",
    category: "Old / Legacy",
    era: "2014 (Classic Go 1.3+)",
    architecture: "Custom core r.Get / r.Post / r.Options router",
    folder: "prometheus",
  },
  {
    name: "Etcd",
    repo: "etcd-io/etcd",
    category: "Old / Legacy",
    era: "2013 (Classic Go 1.1+)",
    architecture: "net/http ServeMux & cluster consensus HTTP",
    folder: "etcd",
  },
  {
    name: "Gogs",
    repo: "gogs/gogs",
    category: "Old / Legacy",
    era: "2014 (Classic Go 1.3+)",
    architecture: "Macaron / classic Go web handler subroutes",
    folder: "gogs",
  },
  {
    name: "Syncthing",
    repo: "syncthing/syncthing",
    category: "Old / Legacy",
    era: "2013-2014 (Classic Go 1.2+)",
    architecture: "httprouter.New() + net/http ServeMux",
    folder: "syncthing",
  },

  // 5 Modern / Massive Backends (massive route density & modern patterns)
  {
    name: "Mattermost",
    repo: "mattermost/mattermost-server",
    category: "Modern / Massive",
    era: "Modern Enterprise",
    architecture: "Multi-layered subrouter tree (Channels v4)",
    folder: "mattermost",
  },
  {
    name: "Portainer",
    repo: "portainer/portainer",
    category: "Modern / Massive",
    era: "Modern Cloud-Native",
    architecture: "Gorilla Mux multi-subrouter (33 submodules)",
    folder: "portainer",
  },
  {
    name: "Gitea",
    repo: "go-gitea/gitea",
    category: "Modern / Massive",
    era: "Modern Open-Source",
    architecture: "Chi / Macaron Combo method chaining",
    folder: "gitea",
  },
  {
    name: "MinIO",
    repo: "minio/minio",
    category: "Modern / Massive",
    era: "High Performance S3",
    architecture: "Gorilla Mux fluent method chaining & query subresources",
    folder: "minio",
  },
  {
    name: "PocketBase",
    repo: "pocketbase/pocketbase",
    category: "Modern / Massive",
    era: "Modern Single-File",
    architecture: "Echo v4 routing & realtime SSE endpoints",
    folder: "pocketbase",
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

async function runHeavyBenchmark() {
  const baseDir = path.resolve(".temp-benchmarks/go-native-eval-2");
  console.log("================================================================================");
  console.log("  RouteLens OmniRoute - 10 Heavy Real-World Go Production Benchmarks");
  console.log("  5 Old/Legacy Backends (2013-2014) + 5 Modern/Massive Backends (100-600+ Routes)");
  console.log("================================================================================\n");

  const results: Array<{
    meta: TargetMeta;
    goFiles: number;
    routes: number;
    durationMs: number;
    methodCounts: Record<string, number>;
    sample: string[];
  }> = [];

  for (const target of TARGETS) {
    const targetPath = path.join(baseDir, target.folder);
    if (!fs.existsSync(targetPath)) {
      console.warn(`[WARN] Missing repository directory: ${targetPath}`);
      continue;
    }

    const goFiles = countGoFiles(targetPath);
    process.stdout.write(`Scanning [${target.name}] (${target.category})... `);
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
      sample: res.routes.slice(0, 3).map((r) => `${r.method} ${r.path}`),
    });

    console.log(`${res.routes.length} routes found (${durationMs}ms) across ${goFiles} Go files.`);
  }

  // Save raw results to JSON
  fs.writeFileSync(
    "scripts/benchmark-go-heavy-10-results.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  console.log("\n================================================================================");
  console.log("                           BENCHMARK EXECUTION COMPLETE                         ");
  console.log("================================================================================\n");
}

runHeavyBenchmark();
