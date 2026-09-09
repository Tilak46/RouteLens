import path from "node:path";
import { scanOmniRoutes } from "../src/main/lib/scanner/omniroute";

async function main() {
  const testRepos = [
    "c:\\Office-Work\\Testing\\easy\\node-express-postgresql-sequelize",
    "c:\\Office-Work\\Testing\\easy\\api-design-node-v3",
  ];

  console.log("================================================================================");
  console.log("  Testing OmniRoute Master Engine (Production Code)");
  console.log("================================================================================\n");

  for (const repo of testRepos) {
    console.log(`\nScanning repository: ${path.basename(repo)}`);
    const result = await scanOmniRoutes(repo, { enableAi: true, maxAiRescues: 3 });

    console.log(`✓ Files scanned: ${result.totalFilesScanned}`);
    console.log(`✓ Route candidates identified: ${result.candidateFilesCount}`);
    console.log(`✓ Routes found: ${result.routes.length} (${result.fastMatchedRoutesCount} fast, ${result.aiRescuedRoutesCount} AI rescued)`);
    console.log(`✓ Duration: ${result.durationMs}ms`);

    for (const r of result.routes.slice(0, 10)) {
      console.log(`   • ${r.method.padEnd(6)} ${r.path.padEnd(28)} [${r.source}]`);
    }
  }
}

main().catch(console.error);
