import dotenv from "dotenv";
import { resolve } from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

// 1. Load .env
const envPath = resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const ghToken = process.env.GH_TOKEN;
if (!ghToken) {
  console.error("❌ Error: GH_TOKEN not found in .env or environment!");
  console.error("Please add GH_TOKEN=ghp_... to your .env file to publish releases.");
  process.exit(1);
}

// Ensure GH_TOKEN is in environment for electron-builder
process.env.GH_TOKEN = ghToken;
process.env.GITHUB_TOKEN = ghToken;

// 2. Read package.json
const pkgPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
console.log(`\n🚀 RouteLens Release Publisher`);
console.log(`📦 Current version: v${pkg.version}`);
console.log(`🎯 Target repository: Tilak46/routelens-releases\n`);

// Handle optional version bump argument: patch | minor | major | explicit version
const arg = process.argv[2];
if (arg) {
  if (arg === "patch" || arg === "minor" || arg === "major") {
    console.log(`⬆️ Bumping ${arg} version...`);
    execSync(`npm version ${arg} --no-git-tag-version`, { stdio: "inherit" });
  } else if (/^\d+\.\d+\.\d+/.test(arg)) {
    console.log(`⬆️ Setting version to ${arg}...`);
    execSync(`npm version ${arg} --no-git-tag-version`, { stdio: "inherit" });
  }
}

// Re-read updated package.json
const updatedPkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
console.log(`✨ Building and publishing RouteLens v${updatedPkg.version}...`);

try {
  console.log(`\n🔨 Step 1: Bundling with electron-vite...`);
  execSync("npm run build", { stdio: "inherit", env: process.env });

  console.log(`\n📦 Step 2: Packaging Windows installer & publishing to GitHub Releases...`);
  execSync("npx electron-builder --win --x64 --publish always", {
    stdio: "inherit",
    env: process.env,
  });

  console.log(`\n🐧 Step 3: Packaging Linux AppImage & publishing to GitHub Releases via WSL...`);
  execSync(
    `wsl bash -c "cd /mnt/c/building-future/devdash && GH_TOKEN=${ghToken} GITHUB_TOKEN=${ghToken} npx electron-builder --linux AppImage --publish always"`,
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  console.log(`\n🎉 SUCCESS! RouteLens v${updatedPkg.version} (Windows + Linux) has been published to GitHub!`);
  console.log(`🔗 Releases URL: https://github.com/Tilak46/routelens-releases/releases\n`);
} catch (error: any) {
  console.error(`\n❌ Release failed:`, error?.message || error);
  process.exit(1);
}
