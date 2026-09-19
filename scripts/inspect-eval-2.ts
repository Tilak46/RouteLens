import fs from "node:fs";
import path from "node:path";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

async function inspectGroup2() {
  const base = path.resolve(".temp-benchmarks/go-native-eval-2");
  if (!fs.existsSync(base)) {
    console.error("Directory not found:", base);
    return;
  }
  const entries = fs.readdirSync(base);
  for (const entry of entries) {
    const fullPath = path.join(base, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;
    const start = Date.now();
    try {
      const res = await scanOmniRoutes(fullPath, { mode: "ast" });
      const duration = Date.now() - start;
      console.log(`[${entry}] -> ${res.routes.length} routes found (${duration}ms)`);
      if (res.routes.length > 0) {
        console.log(`  Sample: ${res.routes.slice(0, 3).map((r: any) => `${r.method} ${r.path}`).join(", ")}`);
      }
    } catch (e: any) {
      console.error(`[${entry}] ERROR: ${e.message}`);
    }
  }
}

inspectGroup2();
