import fs from "node:fs";
import { parse } from "@babel/parser";
import type { File } from "@babel/types";

type CacheEntry = {
  mtimeMs: number;
  size: number;
  ast: File | null;
};

const cache = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;
let errors = 0;

export function getAstCacheStats() {
  return { hits, misses, errors };
}

export async function parseFileAstCached(
  filePath: string,
  log?: (msg: string) => void,
): Promise<File | null> {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return null;
  }

  const existing = cache.get(filePath);
  if (
    existing &&
    existing.mtimeMs === stat.mtimeMs &&
    existing.size === stat.size
  ) {
    hits++;
    return existing.ast;
  }

  misses++;

  let code = "";
  try {
    code = await fs.promises.readFile(filePath, "utf-8");
  } catch {
    cache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, ast: null });
    return null;
  }

  try {
    const ast = parse(code, {
      sourceType: "unambiguous",
      sourceFilename: filePath,
      plugins: [
        "typescript",
        "jsx",
        "decorators-legacy",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        "dynamicImport",
        "topLevelAwait",
      ],
      errorRecovery: true,
      tokens: false,
    }) as unknown as File;

    cache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, ast });
    return ast;
  } catch (err) {
    errors++;
    log?.(`[AST] Failed to parse ${filePath}: ${String(err)}`);
    cache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, ast: null });
    return null;
  }
}
