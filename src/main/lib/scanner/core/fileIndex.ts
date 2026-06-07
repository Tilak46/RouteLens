import fs from "node:fs";
import path from "node:path";

const DEFAULT_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "dist",
  "build",
  "out",
  "generated",
  "prisma",
  "release",
  "release-packager",
]);

const DEFAULT_EXTS = new Set([".js", ".ts", ".jsx", ".tsx"]);

export type FileIndexOptions = {
  skipDirs?: Set<string>;
  exts?: Set<string>;
  maxFiles?: number;
};

export async function indexProjectFiles(
  rootPath: string,
  opts: FileIndexOptions = {},
): Promise<string[]> {
  const skipDirs = opts.skipDirs ?? DEFAULT_SKIP_DIRS;
  const exts = opts.exts ?? DEFAULT_EXTS;
  const maxFiles = opts.maxFiles ?? 20_000;

  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (results.length >= maxFiles) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      if (results.length >= maxFiles) return;

      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name)) continue;
        await walk(full);
        continue;
      }

      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!exts.has(ext)) continue;

      results.push(full);
    }
  }

  await walk(rootPath);
  return results;
}
