import path from "node:path";
import fs from "node:fs";
import type Parser from "web-tree-sitter";
import { getLanguageParser } from "./treeSitterEngine";
export type MountInfo = {
  parentRouter: string;
  mountPath: string;
  childRouter: string;
  isFactory?: boolean;
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
  const strippedJs = importSrc.replace(/\.jsx?$/, "");
  const candidates = [
    path.resolve(dir, importSrc),
    path.resolve(dir, strippedJs + ".ts"),
    path.resolve(dir, strippedJs + ".tsx"),
    path.resolve(dir, strippedJs + ".js"),
    path.resolve(dir, strippedJs + ".jsx"),
    path.resolve(dir, importSrc + ".ts"),
    path.resolve(dir, importSrc + ".js"),
    path.resolve(dir, importSrc + ".tsx"),
    path.resolve(dir, importSrc + ".jsx"),
    path.resolve(dir, strippedJs, "index.ts"),
    path.resolve(dir, strippedJs, "index.tsx"),
    path.resolve(dir, strippedJs, "index.js"),
    path.resolve(dir, strippedJs, "index.jsx"),
    path.resolve(dir, importSrc, "index.ts"),
    path.resolve(dir, importSrc, "index.js"),
    path.resolve(dir, importSrc, "index.tsx"),
    path.resolve(dir, importSrc, "index.jsx"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

function getStringLiteralValue(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "string" || node.type === "string_fragment") {
    return node.text.replace(/^["'`]|["'`]$/g, "");
  }
  if (node.type === "template_string") {
    if (!node.children.some((c) => c.type === "template_substitution")) {
      return node.text.replace(/^`|`$/g, "");
    }
  }
  return null;
}

function extractChildTarget(
  argNode: Parser.SyntaxNode,
  knownImports?: Set<string>,
): { targetName: string; isFactory: boolean } | null {
  if (!argNode) return null;

  // 1. Bare identifier: app.use('/path', childRouter)
  if (argNode.type === "identifier") {
    return { targetName: argNode.text, isFactory: false };
  }

  // 2. Direct factory invocation: app.use('/path', createAuditRoutes(store))
  if (argNode.type === "call_expression") {
    const fn = argNode.child(0);
    if (fn) {
      if (fn.type === "identifier") {
        return { targetName: fn.text, isFactory: true };
      }
      if (fn.type === "member_expression") {
        const prop = fn.child(2);
        if (prop && prop.type === "property_identifier") {
          return { targetName: prop.text, isFactory: true };
        }
      }
    }
  }

  // 3. Arrow function / function expression callback:
  // (req, res, next) => createCrudRoutes(apiHandler)(req, res, next)
  // or (req, res, next) => { if (!isReady()) ...; createAuthRoutes(...)(req, res, next) }
  if (argNode.type === "arrow_function" || argNode.type === "function_expression" || argNode.type === "function") {
    const candidates: Array<{ name: string; score: number }> = [];

    function walkCallback(n: Parser.SyntaxNode) {
      if (!n) return;

      if (n.type === "call_expression") {
        let callee = n.child(0);
        let isCurried = false;

        while (callee && callee.type === "call_expression") {
          isCurried = true;
          const innerFn = callee.child(0);
          if (innerFn && innerFn.type === "identifier") {
            const name = innerFn.text;
            let score = 5;
            if (isCurried) score += 10;
            if (knownImports?.has(name)) score += 20;
            candidates.push({ name, score });
            return;
          }
          callee = innerFn;
        }

        if (callee && callee.type === "identifier") {
          const name = callee.text;
          if (name !== "next" && name !== "res" && name !== "req" && name !== "resolve" && name !== "json" && name !== "status") {
            let score = 1;
            if (knownImports?.has(name)) score += 20;
            candidates.push({ name, score });
          }
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        walkCallback(n.child(i)!);
      }
    }

    walkCallback(argNode);
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return { targetName: candidates[0].name, isFactory: true };
    }
  }

  return null;
}

export interface AstFileSymbols {
  imports: Map<string, TargetExport>;
  exports: Map<string, string>;
  starReExports: string[];
  namedReExports: Array<{ sourceFile: string; origName: string; exportName: string }>;
  mounts: MountInfo[];
  appRoots: Set<string>;
}

function normalizeFilePath(p: string): string {
  return path.normalize(p).toLowerCase();
}

export class SymbolicMountLinker {
  private routerPrefixes = new Map<string, Set<string>>(); // `${normalizedPath}:${varName}` -> Set<prefix>

  public async buildMountTable(fileCodeMap: Map<string, string>, rootPath: string): Promise<void> {
    const lp = await getLanguageParser("typescript");
    if (!lp) return;

    const fileSymbolsMap = new Map<string, AstFileSymbols>();

    for (const [filePath, code] of fileCodeMap.entries()) {
      const ext = path.extname(filePath).toLowerCase();
      if (![".ts", ".js", ".tsx", ".jsx", ".mjs", ".cjs"].includes(ext)) continue;

      let tree: Parser.Tree;
      try {
        tree = lp.parser.parse(code);
      } catch {
        continue;
      }

      const symbols = this.parseFileSymbols(tree, filePath);
      fileSymbolsMap.set(normalizeFilePath(filePath), symbols);
      try {
        tree.delete();
      } catch {}
    }

    const normRoot = normalizeFilePath(rootPath);

    // Step 2: Establish root prefixes ONLY for genuine application entrypoints
    for (const [normPath, syms] of fileSymbolsMap.entries()) {
      const rel = path.relative(normRoot, normPath).replace(/\\/g, "/").toLowerCase();
      const base = path.basename(normPath);

      // A file is an entrypoint if:
      // 1. It instantiates an application (appRoots has express, fastify, etc.)
      // 2. OR it is a top-level file (depth <= 1, not in routes/api/controllers) named index/app/server/main
      const isSubRouteFolder =
        rel.includes("/routes/") ||
        rel.includes("/api/") ||
        rel.includes("/controllers/") ||
        rel.includes("/endpoints/");

      const isTopLevelEntrypoint =
        !isSubRouteFolder &&
        (base.startsWith("index.") ||
          base.startsWith("app.") ||
          base.startsWith("server.") ||
          base.startsWith("main.") ||
          base.startsWith("express."));

      if (isTopLevelEntrypoint) {
        this.setPrefix(normPath, "app", "/");
        this.setPrefix(normPath, "server", "/");
        this.setPrefix(normPath, "router", "/");
      }

      for (const rootVar of syms.appRoots) {
        this.setPrefix(normPath, rootVar, "/");
        this.setPrefix(normPath, "router", "/");
      }
    }

    // Step 3: Fixed-point propagation
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 15) {
      changed = false;
      iterations++;

      for (const [normPath, syms] of fileSymbolsMap.entries()) {
        for (const mount of syms.mounts) {
          const parentKey = `${normPath}:${mount.parentRouter}`;
          const parentPrefixSet =
            this.routerPrefixes.get(parentKey) ||
            (mount.parentRouter === "app" || mount.parentRouter === "server"
              ? new Set(["/"])
              : new Set());

          if (parentPrefixSet.size === 0) continue;

          for (const parentPfx of parentPrefixSet) {
            const fullMount = joinUrl(parentPfx, mount.mountPath);

            // Case A: Local variable in current file
            const childLocalKey = `${normPath}:${mount.childRouter}`;
            const existingLocal = this.routerPrefixes.get(childLocalKey);
            if (!existingLocal || !existingLocal.has(fullMount)) {
              this.setPrefix(normPath, mount.childRouter, fullMount);
              changed = true;
            }

            // Case B: Symbol imported from another file
            const importedTarget = syms.imports.get(mount.childRouter);
            if (importedTarget) {
              const deepTarget =
                this.resolveExportTarget(
                  fileSymbolsMap,
                  importedTarget.filePath,
                  importedTarget.localName,
                ) || importedTarget;

              if (deepTarget) {
                const normTarget = normalizeFilePath(deepTarget.filePath);
                const targetKey = `${normTarget}:${deepTarget.localName}`;
                const existingTarget = this.routerPrefixes.get(targetKey);
                if (!existingTarget || !existingTarget.has(fullMount)) {
                  this.setPrefix(normTarget, deepTarget.localName, fullMount);
                  changed = true;
                }

                // Also attach wildcard prefix to target file
                const targetWildcard = `${normTarget}:*`;
                const existingWild = this.routerPrefixes.get(targetWildcard);
                if (!existingWild || !existingWild.has(fullMount)) {
                  this.setPrefix(normTarget, "*", fullMount);
                  changed = true;
                }
              }
            }
          }
        }
      }
    }
  }

  public getPrefixesForRouter(filePath: string, routerVar: string): Set<string> {
    const norm = normalizeFilePath(filePath);
    const key = `${norm}:${routerVar}`;
    const wildcardKey = `${norm}:*`;

    const wildSet = this.routerPrefixes.get(wildcardKey);
    const varSet = this.routerPrefixes.get(key);

    const nonRootVar = varSet ? Array.from(varSet).filter((p) => p !== "/") : [];
    if (nonRootVar.length > 0) {
      return new Set(nonRootVar);
    }

    const nonRootWild = wildSet ? Array.from(wildSet).filter((p) => p !== "/") : [];
    if (nonRootWild.length > 0) {
      return new Set(nonRootWild);
    }

    return varSet || wildSet || new Set(["/"]);
  }

  private setPrefix(filePath: string, varName: string, prefix: string): void {
    const norm = normalizeFilePath(filePath);
    const key = `${norm}:${varName}`;
    if (!this.routerPrefixes.has(key)) {
      this.routerPrefixes.set(key, new Set());
    }
    this.routerPrefixes.get(key)!.add(prefix);
  }

  private resolveExportTarget(
    symbolsMap: Map<string, AstFileSymbols>,
    filePath: string,
    exportName: string,
    visited = new Set<string>(),
  ): TargetExport | null {
    const normFile = normalizeFilePath(filePath);
    if (visited.has(normFile)) return null;
    visited.add(normFile);

    const syms = symbolsMap.get(normFile);
    if (!syms) return null;

    // 1. Check named re-exports: export { x as exportName } from './foo'
    for (const nr of syms.namedReExports) {
      if (nr.exportName === exportName) {
        return (
          this.resolveExportTarget(symbolsMap, nr.sourceFile, nr.origName, visited) || {
            filePath: normalizeFilePath(nr.sourceFile),
            localName: nr.origName,
          }
        );
      }
    }

    // 2. Check local exports: export const exportName = ... or export default ...
    if (syms.exports.has(exportName)) {
      const localId = syms.exports.get(exportName)!;
      return { filePath: normFile, localName: localId };
    }

    // 3. Check star re-exports: export * from './foo'
    for (const sr of syms.starReExports) {
      const found = this.resolveExportTarget(symbolsMap, sr, exportName, visited);
      if (found) return found;
    }

    return null;
  }

  private parseFileSymbols(tree: Parser.Tree, filePath: string): AstFileSymbols {
    const imports = new Map<string, TargetExport>();
    const exports = new Map<string, string>();
    const starReExports: string[] = [];
    const namedReExports: Array<{ sourceFile: string; origName: string; exportName: string }> = [];
    const mounts: MountInfo[] = [];
    const appRoots = new Set<string>();

    const knownImportNames = new Set<string>();

    function walk(node: Parser.SyntaxNode) {
      if (!node) return;

      // 1. ES Import
      if (node.type === "import_statement") {
        const srcNode = node.children.find((c) => c.type === "string");
        const srcVal = getStringLiteralValue(srcNode);
        if (srcVal) {
          const resolved = resolveLocalImport(filePath, srcVal);
          if (resolved) {
            const clause = node.children.find((c) => c.type === "import_clause");
            if (clause) {
              for (let i = 0; i < clause.childCount; i++) {
                const ch = clause.child(i)!;
                if (ch.type === "identifier") {
                  imports.set(ch.text, { filePath: resolved, localName: "default" });
                  knownImportNames.add(ch.text);
                } else if (ch.type === "named_imports") {
                  for (let j = 0; j < ch.childCount; j++) {
                    const spec = ch.child(j)!;
                    if (spec.type === "import_specifier") {
                      const nameNode = spec.child(0);
                      const aliasNode = spec.children.find((c, idx) => idx > 0 && c.type === "identifier");
                      const orig = nameNode ? nameNode.text : "";
                      const local = aliasNode ? aliasNode.text : orig;
                      if (local) {
                        imports.set(local, { filePath: resolved, localName: orig });
                        knownImportNames.add(local);
                      }
                    }
                  }
                } else if (ch.type === "namespace_import") {
                  const id = ch.children.find((c) => c.type === "identifier");
                  if (id) {
                    imports.set(id.text, { filePath: resolved, localName: "*" });
                    knownImportNames.add(id.text);
                  }
                }
              }
            }
          }
        }
      }

      // 2. CommonJS require
      if (node.type === "variable_declarator") {
        const init = node.child(2);
        if (init && init.type === "call_expression") {
          const fn = init.child(0);
          if (fn && fn.type === "identifier" && fn.text === "require") {
            const args = init.children.find((c) => c.type === "arguments");
            const firstArg = args?.children.find((c) => c.type === "string");
            const srcVal = getStringLiteralValue(firstArg);
            if (srcVal) {
              const resolved = resolveLocalImport(filePath, srcVal);
              if (resolved) {
                const idNode = node.child(0);
                if (idNode) {
                  if (idNode.type === "identifier") {
                    imports.set(idNode.text, { filePath: resolved, localName: "default" });
                    knownImportNames.add(idNode.text);
                  } else if (idNode.type === "object_pattern") {
                    for (let i = 0; i < idNode.childCount; i++) {
                      const prop = idNode.child(i)!;
                      if (prop.type === "shorthand_property_identifier_pattern" || prop.type === "identifier") {
                        imports.set(prop.text, { filePath: resolved, localName: prop.text });
                        knownImportNames.add(prop.text);
                      } else if (prop.type === "pair_pattern") {
                        const k = prop.child(0)?.text;
                        const v = prop.child(2)?.text;
                        if (k && v) {
                          imports.set(v, { filePath: resolved, localName: k });
                          knownImportNames.add(v);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 3. Export statements
      if (node.type === "export_statement") {
        const srcNode = node.children.find((c) => c.type === "string");
        const srcVal = getStringLiteralValue(srcNode);

        if (srcVal) {
          const resolved = resolveLocalImport(filePath, srcVal);
          if (resolved) {
            if (node.children.some((c) => c.type === "*")) {
              starReExports.push(resolved);
            }
            const clause = node.children.find((c) => c.type === "export_clause");
            if (clause) {
              for (let i = 0; i < clause.childCount; i++) {
                const spec = clause.child(i)!;
                if (spec.type === "export_specifier") {
                  const n1 = spec.child(0)?.text || "";
                  const n2 = spec.children.find((c, idx) => idx > 0 && c.type === "identifier")?.text;
                  const orig = n1;
                  const exportedAs = n2 || orig;
                  namedReExports.push({ sourceFile: resolved, origName: orig, exportName: exportedAs });
                }
              }
            }
          }
        } else {
          // Default export
          if (node.children.some((c) => c.text === "default")) {
            const dec = node.children.find((c) => c.type !== "export" && c.type !== "default" && c.text !== ";");
            if (dec) {
              if (dec.type === "identifier") {
                exports.set("default", dec.text);
              } else if (dec.type === "function_declaration" || dec.type === "function") {
                const fnId = dec.children.find((c) => c.type === "identifier");
                exports.set("default", fnId ? fnId.text : "default");
              } else {
                exports.set("default", "default");
              }
            }
          }

          // Function declaration
          const fnDec = node.children.find((c) => c.type === "function_declaration");
          if (fnDec) {
            const fnId = fnDec.children.find((c) => c.type === "identifier");
            if (fnId) {
              exports.set(fnId.text, fnId.text);
            }
          }

          // Variable declarations
          const varDec = node.children.find((c) => c.type === "lexical_declaration" || c.type === "variable_declaration");
          if (varDec) {
            for (let i = 0; i < varDec.childCount; i++) {
              const decl = varDec.child(i)!;
              if (decl.type === "variable_declarator") {
                const id = decl.child(0)?.text;
                if (id) {
                  exports.set(id, id);
                }
              }
            }
          }

          // Named export clause: export { a, b as c }
          const clause = node.children.find((c) => c.type === "export_clause");
          if (clause) {
            for (let i = 0; i < clause.childCount; i++) {
              const spec = clause.child(i)!;
              if (spec.type === "export_specifier") {
                const n1 = spec.child(0)?.text || "";
                const n2 = spec.children.find((c, idx) => idx > 0 && c.type === "identifier")?.text;
                const orig = n1;
                const exportedAs = n2 || orig;
                exports.set(exportedAs, orig);
              }
            }
          }
        }
      }

      // CommonJS module.exports = ... and exports.foo = ...
      if (node.type === "assignment_expression") {
        const left = node.child(0);
        const right = node.child(2);
        if (left && right) {
          if (left.text === "module.exports") {
            if (right.type === "identifier") {
              exports.set("default", right.text);
            } else {
              exports.set("default", "default");
            }
          } else if (left.type === "member_expression") {
            const obj = left.child(0)?.text;
            const prop = left.child(2)?.text;
            if ((obj === "exports" || obj === "module.exports") && prop) {
              exports.set(prop, right.type === "identifier" ? right.text : prop);
            }
          }
        }
      }

      // 4. Invariant App Creation: const app = express(); const router = Router();
      if (node.type === "variable_declarator") {
        const idNode = node.child(0);
        const init = node.child(2);
        if (idNode && init) {
          const idName = idNode.text;
          if (init.type === "call_expression") {
            const fn = init.child(0)?.text;
            if (fn === "express" || fn === "fastify" || fn === "express.default") {
              appRoots.add(idName);
            }
          } else if (init.type === "new_expression") {
            const constr = init.child(1)?.text;
            if (constr === "Hono" || constr === "Koa") {
              appRoots.add(idName);
            }
          }
        }
      }

      // 5. Mounts: parent.use(...), parent.route(...), parent.register(...)
      if (node.type === "call_expression") {
        const fn = node.child(0);
        if (fn && fn.type === "member_expression") {
          const parentObj = fn.child(0)?.text;
          const method = fn.child(2)?.text;

          if (parentObj && (method === "use" || method === "route" || method === "register")) {
            const argsNode = node.children.find((c) => c.type === "arguments");
            if (argsNode) {
              const rawArgs: Parser.SyntaxNode[] = [];
              for (let i = 0; i < argsNode.childCount; i++) {
                const arg = argsNode.child(i)!;
                if (arg.type !== "(" && arg.type !== ")" && arg.type !== ",") {
                  rawArgs.push(arg);
                }
              }

              if (rawArgs.length > 0) {
                if (method === "register") {
                  const childArg = rawArgs[0];
                  const childTarget = extractChildTarget(childArg, knownImportNames);
                  let mountPath = "/";
                  if (rawArgs.length > 1) {
                    const optArg = rawArgs[1];
                    if (optArg.type === "object") {
                      for (let k = 0; k < optArg.childCount; k++) {
                        const prop = optArg.child(k)!;
                        if (prop.type === "pair") {
                          const key = prop.child(0)?.text;
                          if (key === "prefix") {
                            const val = getStringLiteralValue(prop.child(2));
                            if (val) mountPath = cleanPath(val);
                          }
                        }
                      }
                    }
                  }
                  if (childTarget) {
                    mounts.push({
                      parentRouter: parentObj,
                      mountPath,
                      childRouter: childTarget.targetName,
                      isFactory: childTarget.isFactory,
                    });
                  }
                } else {
                  let mountPath = "/";
                  let argStartIndex = 0;

                  const firstVal = getStringLiteralValue(rawArgs[0]);
                  if (firstVal !== null) {
                    mountPath = cleanPath(firstVal);
                    argStartIndex = 1;
                  }

                  for (let a = rawArgs.length - 1; a >= argStartIndex; a--) {
                    const target = extractChildTarget(rawArgs[a], knownImportNames);
                    if (target) {
                      mounts.push({
                        parentRouter: parentObj,
                        mountPath,
                        childRouter: target.targetName,
                        isFactory: target.isFactory,
                      });
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        walk(node.child(i)!);
      }
    }

    walk(tree.rootNode);

    return {
      imports,
      exports,
      starReExports,
      namedReExports,
      mounts,
      appRoots,
    };
  }
}
