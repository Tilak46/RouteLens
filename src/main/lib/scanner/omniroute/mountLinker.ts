import path from "node:path";
import fs from "node:fs";

export type MountInfo = {
  parentRouter: string;
  mountPath: string;
  childRouter: string;
};

export type TargetExport = {
  filePath: string;
  localName: string;
};

export function cleanPath(p: string): string {
  let cleaned = p.trim().replace(/^["'`]|["'`]$/g, "");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return cleaned.replace(/\/+/g, "/");
}

export function joinUrl(base: string, sub: string): string {
  if (!base || base === "/") return cleanPath(sub);
  if (!sub || sub === "/") return cleanPath(base);
  return cleanPath(base + "/" + sub);
}

export function resolveLocalImport(fromFile: string, importSrc: string): string | null {
  if (!importSrc.startsWith(".")) return null;
  const dir = path.dirname(fromFile);
  const candidates = [
    path.resolve(dir, importSrc),
    path.resolve(dir, importSrc + ".ts"),
    path.resolve(dir, importSrc + ".js"),
    path.resolve(dir, importSrc + ".tsx"),
    path.resolve(dir, importSrc + ".jsx"),
    path.resolve(dir, importSrc, "index.ts"),
    path.resolve(dir, importSrc, "index.js"),
    path.resolve(dir, importSrc, "index.tsx"),
    path.resolve(dir, importSrc, "index.jsx"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      // Ignore filesystem permission errors
    }
  }
  return null;
}

export function resolveExportedTarget(
  fileCodeMap: Map<string, string>,
  filePath: string,
  exportName: string,
  visited = new Set<string>(),
): TargetExport | null {
  if (visited.has(filePath)) return null;
  visited.add(filePath);
  const code = fileCodeMap.get(filePath);
  if (!code) return null;

  // Case 1: export default X or module.exports = X
  if (exportName === "default") {
    const defMatch = /export\s+default\s+([a-zA-Z0-9_$]+)/.exec(code);
    if (defMatch) return { filePath, localName: defMatch[1] };
    const cjsMatch = /module\.exports\s*=\s*(?:fp\s*\(\s*)?([a-zA-Z0-9_$]+)/.exec(code);
    if (cjsMatch) return { filePath, localName: cjsMatch[1] };
  } else {
    // Case 1b: module.exports.foo = foo or exports.foo = foo
    const namedCjs = new RegExp(`(?:module\\.)?exports\\.${exportName}\\s*=\\s*([a-zA-Z0-9_$]+)`).exec(code);
    if (namedCjs) return { filePath, localName: namedCjs[1] };

    // export { default as adminRouter } from './admin.routes';
    const reExportRegex = /export\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = reExportRegex.exec(code)) !== null) {
      const parts = rMatch[1].split(",");
      for (const p of parts) {
        const [orig, alias] = p.trim().split(/\s+as\s+/);
        const name = (alias || orig).trim();
        if (name === exportName) {
          const nextTarget = resolveLocalImport(filePath, rMatch[2]);
          if (nextTarget) {
            return resolveExportedTarget(fileCodeMap, nextTarget, orig.trim(), visited);
          }
        }
      }
    }
  }

  // Case 2: export * from './foo'
  const starExportRegex = /export\s*\*\s*from\s*['"]([^'"]+)['"]/g;
  let sMatch: RegExpExecArray | null;
  while ((sMatch = starExportRegex.exec(code)) !== null) {
    const subTarget = resolveLocalImport(filePath, sMatch[1]);
    if (subTarget) {
      const res = resolveExportedTarget(fileCodeMap, subTarget, exportName, visited);
      if (res) return res;
    }
  }

  // Check if exportName is actually defined or exported in this file
  const isDefinedHere = new RegExp(
    `(?:export\\s+(?:const|let|var|function|class)\\s+${exportName}\\b|export\\s+default\\s+${exportName}\\b|export\\s*\\{[^}]*\\b${exportName}\\b|(?:const|let|var)\\s+${exportName}\\s*=|function\\s+${exportName}\\b|export\\s+default\\b|module\\.exports\\b)`,
    "i",
  ).test(code);

  if (isDefinedHere) {
    return { filePath, localName: exportName };
  }

  return null;
}

export class SymbolicMountLinker {
  private routerPrefixes = new Map<string, Set<string>>(); // `${filePath}:${varName}` -> Set<prefix>

  public buildMountTable(fileCodeMap: Map<string, string>, rootPath: string): void {
    const importMap = new Map<string, Map<string, TargetExport>>();
    const fileMounts = new Map<string, MountInfo[]>();

    const mountRegex = /(?:^|[^a-zA-Z0-9_.])([a-zA-Z0-9_$]+)\.(?:use|route)\s*\(\s*(?:(['"`])(\/[^'"`]*)\2\s*,\s*)?([a-zA-Z0-9_$]+)\s*\)/g;
    const fastifyRegisterRegex = /([a-zA-Z0-9_$]+)\.register\s*\(\s*([a-zA-Z0-9_$]+)(?:\s*,\s*\{[^}]*prefix:\s*['"`]([^'"`]+)['"`])?/g;
    const esImportRegex = /import\s+(?:\{([^}]+)\}|([a-zA-Z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/g;
    const cjsRequireRegex = /(?:const|let|var)\s+(?:\{([^}]+)\}|([a-zA-Z0-9_$]+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    for (const [filePath, code] of fileCodeMap.entries()) {
      const localImports = new Map<string, TargetExport>();
      let imp: RegExpExecArray | null;
      while ((imp = esImportRegex.exec(code)) !== null) {
        const named = imp[1];
        const def = imp[2];
        const src = imp[3];
        const resolved = resolveLocalImport(filePath, src);
        if (resolved) {
          if (def) {
            const deep = resolveExportedTarget(fileCodeMap, resolved, "default");
            localImports.set(def, deep || { filePath: resolved, localName: "default" });
          }
          if (named) {
            for (const part of named.split(",")) {
              const [orig, alias] = part.trim().split(/\s+as\s+/);
              const deep = resolveExportedTarget(fileCodeMap, resolved, orig.trim());
              localImports.set(alias || orig.trim(), deep || { filePath: resolved, localName: orig.trim() });
            }
          }
        }
      }

      let reqM: RegExpExecArray | null;
      while ((reqM = cjsRequireRegex.exec(code)) !== null) {
        const named = reqM[1];
        const def = reqM[2];
        const src = reqM[3];
        const resolved = resolveLocalImport(filePath, src);
        if (resolved) {
          if (def) {
            const deep = resolveExportedTarget(fileCodeMap, resolved, "default");
            localImports.set(def, deep || { filePath: resolved, localName: "default" });
          }
          if (named) {
            for (const part of named.split(",")) {
              const [orig, alias] = part.trim().split(/\s*:\s*/);
              const deep = resolveExportedTarget(fileCodeMap, resolved, orig.trim());
              localImports.set(alias || orig.trim(), deep || { filePath: resolved, localName: orig.trim() });
            }
          }
        }
      }
      importMap.set(filePath, localImports);

      const mounts: MountInfo[] = [];
      let mnt: RegExpExecArray | null;
      while ((mnt = mountRegex.exec(code)) !== null) {
        const parentRouter = mnt[1];
        const mountPath = mnt[3] || "/";
        const childRouter = mnt[4];
        mounts.push({ parentRouter, mountPath, childRouter });
      }

      let regM: RegExpExecArray | null;
      while ((regM = fastifyRegisterRegex.exec(code)) !== null) {
        const parentRouter = regM[1];
        const childRouter = regM[2];
        const mountPath = regM[3] || "/";
        mounts.push({ parentRouter, mountPath, childRouter });
      }

      fileMounts.set(filePath, mounts);
    }

    // Identify entrypoint (index.ts, app.ts, server.js, main.go, express.js, etc.)
    for (const [filePath, code] of fileCodeMap.entries()) {
      const base = path.basename(filePath).toLowerCase();
      if (
        base.startsWith("index.") ||
        base.startsWith("app.") ||
        base.startsWith("server.") ||
        base.startsWith("main.") ||
        base.startsWith("express.")
      ) {
        this.setPrefix(filePath, "app", "/");
        this.setPrefix(filePath, "server", "/");
      }

      // Invariant: any file creating an app has a root router
      const rootMatch = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:express|fastify)\s*\(|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*new\s+Hono\s*\(/i.exec(code);
      if (rootMatch) {
        const rVar = rootMatch[1] || rootMatch[2];
        if (rVar) {
          this.setPrefix(filePath, rVar, "/");
        }
      }
    }

    // Fixed-point iteration to propagate mount prefixes
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 12) {
      changed = false;
      iterations++;

      for (const [filePath, mounts] of fileMounts.entries()) {
        const imports = importMap.get(filePath) || new Map();

        for (const { parentRouter, mountPath, childRouter } of mounts) {
          const parentKey = `${filePath}:${parentRouter}`;
          const parentPrefixSet =
            this.routerPrefixes.get(parentKey) ||
            (parentRouter === "app" ? new Set(["/"]) : new Set());

          if (parentPrefixSet.size === 0) continue;

          for (const parentPfx of parentPrefixSet) {
            const fullMount = joinUrl(parentPfx, mountPath);

            // Case A: childRouter is local in this file
            const childLocalKey = `${filePath}:${childRouter}`;
            const existingLocal = this.routerPrefixes.get(childLocalKey);
            if (!existingLocal || !existingLocal.has(fullMount)) {
              this.setPrefix(filePath, childRouter, fullMount);
              changed = true;
            }

            // Case B: childRouter was imported from another file
            const targetInfo = imports.get(childRouter);
            if (targetInfo) {
              const targetFile = targetInfo.filePath;
              const targetLocal = targetInfo.localName;

              if (targetLocal && targetLocal !== "default") {
                const targetKey = `${targetFile}:${targetLocal}`;
                const existingTarget = this.routerPrefixes.get(targetKey);
                if (!existingTarget || !existingTarget.has(fullMount)) {
                  this.setPrefix(targetFile, targetLocal, fullMount);
                  changed = true;
                }
              }

              // Check default export / module.exports
              const targetCode = fileCodeMap.get(targetFile) || "";
              const defMatch = /(?:export\s+default|module\.exports\s*=)\s*(?:fp\s*\(\s*)?([a-zA-Z0-9_$]+)/.exec(targetCode);
              if (defMatch) {
                const exportedVar = defMatch[1];
                const targetKey = `${targetFile}:${exportedVar}`;
                const existingTarget = this.routerPrefixes.get(targetKey);
                if (!existingTarget || !existingTarget.has(fullMount)) {
                  this.setPrefix(targetFile, exportedVar, fullMount);
                  changed = true;
                }
              }

              // Also prefix all exported routers in targetFile
              const targetKeyWildcard = `${targetFile}:*`;
              const existingWild = this.routerPrefixes.get(targetKeyWildcard);
              if (!existingWild || !existingWild.has(fullMount)) {
                this.setPrefix(targetFile, "*", fullMount);
                changed = true;
              }
            }
          }
        }
      }
    }
  }

  public getPrefixesForRouter(filePath: string, routerVar: string): Set<string> {
    const key = `${filePath}:${routerVar}`;
    const wildcardKey = `${filePath}:*`;
    return (
      this.routerPrefixes.get(key) ||
      this.routerPrefixes.get(wildcardKey) ||
      new Set(["/"])
    );
  }

  private setPrefix(filePath: string, varName: string, prefix: string): void {
    const key = `${filePath}:${varName}`;
    if (!this.routerPrefixes.has(key)) {
      this.routerPrefixes.set(key, new Set());
    }
    this.routerPrefixes.get(key)!.add(prefix);
  }
}
