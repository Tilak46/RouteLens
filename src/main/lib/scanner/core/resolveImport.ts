import fs from "node:fs";
import path from "node:path";

interface TsConfigPaths {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

// In-memory cache for parsed tsconfig path mappings to keep it fast
const tsconfigCache = new Map<string, TsConfigPaths | null>();

function checkFileExtensions(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.js`,
    `${basePath}.tsx`,
    `${basePath}.jsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.jsx"),
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

function parseTsConfigRecursively(
  configPath: string,
  visited = new Set<string>(),
): TsConfigPaths {
  if (visited.has(configPath)) return {};
  visited.add(configPath);

  try {
    if (!fs.existsSync(configPath)) return {};
    const rawContent = fs.readFileSync(configPath, "utf-8");
    const cleaned = rawContent
      .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1")
      .replace(/,(\s*[\]}])/g, "$1");
    const parsed = JSON.parse(cleaned);

    let baseOptions: TsConfigPaths = {};
    if (parsed.extends && typeof parsed.extends === "string") {
      const extendedPath = path.resolve(path.dirname(configPath), parsed.extends);
      baseOptions = parseTsConfigRecursively(extendedPath, visited);
    }

    const compilerOptions = parsed?.compilerOptions || {};
    return {
      baseUrl: compilerOptions.baseUrl ?? baseOptions.baseUrl,
      paths: {
        ...(baseOptions.paths || {}),
        ...(compilerOptions.paths || {}),
      },
    };
  } catch {
    return {};
  }
}

function resolveTsconfigAlias(
  fromFile: string,
  importSource: string,
): string | null {
  const startDir = path.dirname(fromFile);
  let cur = startDir;
  
  let config: TsConfigPaths | null = null;
  let configDir = "";
  
  const maxDepth = 15;
  for (let i = 0; i < maxDepth; i++) {
    if (tsconfigCache.has(cur)) {
      config = tsconfigCache.get(cur)!;
      if (config) {
        configDir = cur;
      }
      break;
    }

    const tsconfigPath = path.join(cur, "tsconfig.json");
    const jsconfigPath = path.join(cur, "jsconfig.json");
    const pkgPath = path.join(cur, "package.json");

    let configPath: string | null = null;
    if (fs.existsSync(tsconfigPath)) configPath = tsconfigPath;
    else if (fs.existsSync(jsconfigPath)) configPath = jsconfigPath;

    if (configPath) {
      config = parseTsConfigRecursively(configPath);
      configDir = cur;
      tsconfigCache.set(cur, config);
      break;
    }

    if (fs.existsSync(pkgPath) || cur === path.dirname(cur)) {
      tsconfigCache.set(cur, null);
      break;
    }

    cur = path.dirname(cur);
  }

  if (!config) return null;

  const { baseUrl = ".", paths = {} } = config;
  const baseDir = path.resolve(configDir, baseUrl);

  for (const [pattern, replacements] of Object.entries(paths)) {
    if (!Array.isArray(replacements) || replacements.length === 0) continue;
    
    // Exact match: e.g. "auth" -> ["src/auth"]
    if (pattern === importSource) {
      for (const rep of replacements) {
        const resolved = path.resolve(baseDir, rep);
        const filePath = checkFileExtensions(resolved);
        if (filePath) return filePath;
      }
    }

    // Wildcard match: e.g. "@/*" -> ["src/*"]
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (importSource.startsWith(prefix)) {
        const matched = importSource.slice(prefix.length);
        for (const rep of replacements) {
          const repWithMatch = rep.replace(/\*/g, matched);
          const resolved = path.resolve(baseDir, repWithMatch);
          const filePath = checkFileExtensions(resolved);
          if (filePath) return filePath;
        }
      }
    }
  }

  // Also handle simple baseUrl resolution if baseUrl is set
  if (baseUrl) {
    const resolved = path.resolve(baseDir, importSource);
    const filePath = checkFileExtensions(resolved);
    if (filePath) return filePath;
  }

  return null;
}

export function resolveImportToFile(
  fromFile: string,
  importSource: string,
): string | null {
  const raw = String(importSource || "").trim();
  if (!raw) return null;

  const sources = [raw];
  const stripped = raw.replace(/\.(jsx?|tsx?)$/i, "");
  if (stripped !== raw) {
    sources.push(stripped);
  }

  for (const src of sources) {
    // 1. Try to resolve via tsconfig/jsconfig paths
    try {
      const tsconfigResolved = resolveTsconfigAlias(fromFile, src);
      if (tsconfigResolved) return tsconfigResolved;
    } catch {
      // ignore
    }

    // 2. Only handle relative/absolute filesystem imports.
    if (src.startsWith(".") || src.startsWith("/")) {
      const base = path.resolve(path.dirname(fromFile), src);
      const filePath = checkFileExtensions(base);
      if (filePath) return filePath;
    }
  }

  return null;
}

