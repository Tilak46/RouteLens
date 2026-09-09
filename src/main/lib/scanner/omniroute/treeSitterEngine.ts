import path from "node:path";
import fs from "node:fs";
import Parser from "web-tree-sitter";
import type { Method } from "../../../types";
import type { OmniRoute, OmniFramework, FileCandidate } from "./types";
import { joinUrl, SymbolicMountLinker } from "./mountLinker";

let isParserInitialized = false;
let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, Parser.Language>();

function getWasmDirectory(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), "node_modules", "tree-sitter-wasms", "out"),
    path.resolve(__dirname, "..", "..", "..", "..", "node_modules", "tree-sitter-wasms", "out"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.resolve(process.cwd(), "node_modules", "tree-sitter-wasms", "out");
}

async function ensureParserInit(): Promise<void> {
  if (isParserInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await Parser.init();
    isParserInitialized = true;
  })();

  return initPromise;
}

const WASM_FILE_MAP: Record<string, string> = {
  csharp: "tree-sitter-c_sharp.wasm",
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
  go: "tree-sitter-go.wasm",
  java: "tree-sitter-java.wasm",
  php: "tree-sitter-php.wasm",
  rust: "tree-sitter-rust.wasm",
  ruby: "tree-sitter-ruby.wasm",
};

export async function getLanguageParser(language: string): Promise<{ parser: Parser; language: Parser.Language } | null> {
  await ensureParserInit();

  const wasmFileName = WASM_FILE_MAP[language.toLowerCase()];
  if (!wasmFileName) return null;

  let lang = languageCache.get(language);
  if (!lang) {
    const wasmPath = path.join(getWasmDirectory(), wasmFileName);
    if (!fs.existsSync(wasmPath)) return null;

    try {
      lang = await Parser.Language.load(wasmPath);
      languageCache.set(language, lang);
    } catch (err) {
      console.error(`[TreeSitter] Failed to load WASM for ${language}:`, err);
      return null;
    }
  }

  const parser = new Parser();
  parser.setLanguage(lang);
  return { parser, language: lang };
}

function stableId(file: string, method: string, routePath: string): string {
  const raw = `${file}|${method}|${routePath}`;
  return `omni_ts_${Buffer.from(raw).toString("base64url")}`;
}

function walkTree(node: Parser.SyntaxNode, callback: (n: Parser.SyntaxNode) => void) {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) walkTree(child, callback);
  }
}

// -------------------------------------------------------------
// 1. C# (ASP.NET Core Controllers & Minimal APIs)
// -------------------------------------------------------------
export function extractCSharpRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];

  walkTree(tree.rootNode, (node) => {
    // A. Class-based Controllers
    if (node.type === "class_declaration") {
      let classRoutePrefix = "";

      // Find class attributes like [Route("api/auth")]
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i)!;
        if (c.type === "attribute_list") {
          const m = c.text.match(/\[Route\(\s*["']([^"']+)["']\s*\)\]/i);
          if (m) classRoutePrefix = m[1];
        }
      }

      // Find method declarations with [HttpGet], [HttpPost], etc.
      walkTree(node, (child) => {
        if (child.type === "method_declaration") {
          for (let j = 0; j < child.childCount; j++) {
            const attr = child.child(j)!;
            if (attr.type === "attribute_list") {
              const httpMatch = attr.text.match(/\[Http(Get|Post|Put|Delete|Patch|Options|Head)\s*(?:\(\s*["']([^"']*)["']\s*\))?\s*\]/i);
              if (httpMatch) {
                const method = httpMatch[1].toUpperCase() as Method;
                const subPath = httpMatch[2] || "";
                const fullPath = "/" + [classRoutePrefix, subPath]
                  .filter(Boolean)
                  .join("/")
                  .replace(/\/+/g, "/")
                  .replace(/^\//, "");

                routes.push({
                  id: stableId(filePath, method, fullPath),
                  framework: "aspnet",
                  method,
                  path: fullPath,
                  file: filePath,
                  confidence: "high",
                  source: "tree_sitter",
                });
              }
            }
          }
        }
      });
    }

    // B. Minimal APIs: app.MapGet("/path", ...), app.MapPost(...)
    if (node.type === "invocation_expression" || node.type === "call_expression") {
      const text = node.text;
      const minimalMatch = text.match(/\.Map(Get|Post|Put|Delete|Patch)\s*\(\s*["']([^"']+)["']/i);
      if (minimalMatch) {
        const method = minimalMatch[1].toUpperCase() as Method;
        let routePath = minimalMatch[2];
        if (!routePath.startsWith("/")) routePath = "/" + routePath;

        routes.push({
          id: stableId(filePath, method, routePath),
          framework: "aspnet",
          method,
          path: routePath,
          file: filePath,
          confidence: "high",
          source: "tree_sitter",
        });
      }
    }
  });

  return routes;
}

// -------------------------------------------------------------
// 2. TypeScript & JavaScript (Express, NestJS, Fastify, Hono)
// -------------------------------------------------------------
function findChainedBasePath(node: Parser.SyntaxNode | null): { basePath: string; routerVar: string } | null {
  let curr: Parser.SyntaxNode | null = node;
  while (curr && curr.type === "call_expression") {
    const fn = curr.childForFieldName("function");
    if (fn && fn.type === "member_expression") {
      const prop = fn.childForFieldName("property");
      const obj = fn.childForFieldName("object");
      if (prop && prop.text === "route") {
        const args = curr.childForFieldName("arguments");
        if (args && args.childCount > 0) {
          for (let i = 0; i < args.childCount; i++) {
            const arg = args.child(i)!;
            if (arg.type === "string" || arg.type === "template_string") {
              return {
                basePath: arg.text.replace(/^['"`]|['"`]$/g, ""),
                routerVar: obj ? obj.text : "router",
              };
            }
          }
        }
      }
      curr = obj;
    } else {
      break;
    }
  }
  return null;
}

export function resolveNextJsRoutePath(filePath: string): { routePath: string; framework: "next-app" | "next-pages" } | null {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");

  // 1. App Router: app/**/route.(ts|js|tsx|jsx)
  const appIdx = parts.lastIndexOf("app");
  const fileName = parts[parts.length - 1];
  const isAppRoute = appIdx !== -1 && /^route\.(t|j)sx?$/i.test(fileName);

  if (isAppRoute) {
    const subParts = parts.slice(appIdx + 1, parts.length - 1);
    const segs = subParts
      .map((s) => {
        if (s.startsWith("(") && s.endsWith(")")) return null;
        if (s.startsWith("@")) return null;
        const mOpt = s.match(/^\[\[\.\.\.(.+)\]\]$/);
        if (mOpt) return `:${mOpt[1]}*`;
        const mCatch = s.match(/^\[\.\.\.(.+)\]$/);
        if (mCatch) return `:${mCatch[1]}*`;
        const mDyn = s.match(/^\[(.+)\]$/);
        if (mDyn) return `:${mDyn[1]}`;
        return s;
      })
      .filter(Boolean);

    let routePath = "/" + segs.join("/");
    routePath = routePath.replace(/\/+/g, "/");
    if (!routePath.startsWith("/")) routePath = "/" + routePath;
    return { routePath, framework: "next-app" };
  }

  // 2. Pages Router: pages/api/**.(ts|js|tsx|jsx)
  const pagesIdx = parts.lastIndexOf("pages");
  const apiIdx = parts.indexOf("api", pagesIdx);
  if (pagesIdx !== -1 && apiIdx !== -1) {
    const subParts = parts.slice(apiIdx);
    const last = subParts[subParts.length - 1].replace(/\.(t|j)sx?$/i, "");
    if (last === "index") {
      subParts.pop();
    } else {
      subParts[subParts.length - 1] = last;
    }

    const segs = subParts.map((s) => {
      const mCatch = s.match(/^\[\.\.\.(.+)\]$/);
      if (mCatch) return `:${mCatch[1]}*`;
      const mDyn = s.match(/^\[(.+)\]$/);
      if (mDyn) return `:${mDyn[1]}`;
      return s;
    });

    let routePath = "/" + segs.join("/");
    routePath = routePath.replace(/\/+/g, "/");
    return { routePath, framework: "next-pages" };
  }

  return null;
}

export function extractTsJsRoutes(
  tree: Parser.Tree,
  filePath: string,
  mountLinker?: SymbolicMountLinker,
): OmniRoute[] {
  const routes: OmniRoute[] = [];
  const validMethods = new Set(["get", "post", "put", "delete", "patch", "options", "head"]);

  // 0. Next.js File-System Routing (App Router & Pages Router)
  const nextRouteInfo = resolveNextJsRoutePath(filePath);
  if (nextRouteInfo) {
    const { routePath, framework } = nextRouteInfo;

    if (framework === "next-app") {
      const exportedMethods = new Set<Method>();
      walkTree(tree.rootNode, (node) => {
        if (node.type === "export_statement") {
          function checkExport(n: Parser.SyntaxNode) {
            if (n.type === "shorthand_property_identifier_pattern" || n.type === "identifier") {
              const upper = n.text.toUpperCase();
              if (["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"].includes(upper)) {
                exportedMethods.add(upper as Method);
              }
            }
            for (let i = 0; i < n.childCount; i++) {
              checkExport(n.child(i)!);
            }
          }
          for (let i = 0; i < node.childCount; i++) {
            checkExport(node.child(i)!);
          }
        }
      });

      for (const m of exportedMethods) {
        routes.push({
          id: stableId(filePath, m, routePath),
          framework: "next-app",
          method: m,
          path: routePath,
          file: filePath,
          confidence: "high",
          source: "tree_sitter",
        });
      }

      if (routes.length > 0) return routes;
    } else if (framework === "next-pages") {
      const pageMethods = new Set<Method>();
      walkTree(tree.rootNode, (node) => {
        const text = node.text;
        const m = text.match(/req\.method\s*===?\s*['"](GET|POST|PUT|DELETE|PATCH)['"]/i);
        if (m) pageMethods.add(m[1].toUpperCase() as Method);
      });

      const finalMethods = pageMethods.size > 0 ? Array.from(pageMethods) : (["ALL"] as Method[]);
      for (const m of finalMethods) {
        routes.push({
          id: stableId(filePath, m, routePath),
          framework: "next-pages",
          method: m,
          path: routePath,
          file: filePath,
          confidence: "high",
          source: "tree_sitter",
        });
      }

      if (routes.length > 0) return routes;
    }
  }

  walkTree(tree.rootNode, (node) => {
    // A. NestJS Decorator Pattern: @Controller() on class + @Get() on methods
    if (
      node.type === "class_declaration" ||
      (node.type === "export_statement" && node.text.includes("class "))
    ) {
      let classPrefix = "";
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i)!;
        if (c.type === "decorator") {
          const m = c.text.match(/@Controller\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/i);
          if (m) {
            classPrefix = m[1] || "";
          }
        }
      }

      walkTree(node, (child) => {
        if (child.type === "method_definition") {
          let prev = child.previousNamedSibling;
          while (prev && prev.type === "decorator") {
            const m = prev.text.match(/@(Get|Post|Put|Delete|Patch|Options|Head)\s*(?:\(\s*['"`]([^'"`]*)['"`]\s*\))?/i);
            if (m) {
              const method = m[1].toUpperCase() as Method;
              const subPath = m[2] || "";
              const fullPath = "/" + [classPrefix, subPath]
                .filter(Boolean)
                .join("/")
                .replace(/\/+/g, "/")
                .replace(/^\//, "");

              routes.push({
                id: stableId(filePath, method, fullPath),
                framework: "nest",
                method,
                path: fullPath,
                file: filePath,
                confidence: "high",
                source: "tree_sitter",
              });
            }
            prev = prev.previousNamedSibling;
          }
        }
      });
    }

    // B. Express / Fastify / Hono CallExpressions & Chained routes
    if (node.type === "call_expression") {
      const fnNode = node.childForFieldName("function");
      if (fnNode && fnNode.type === "member_expression") {
        const propNode = fnNode.childForFieldName("property");
        const objNode = fnNode.childForFieldName("object");

        if (propNode && objNode) {
          const propName = propNode.text.toLowerCase();

          if (validMethods.has(propName)) {
            const argsNode = node.childForFieldName("arguments");
            let foundDirectPath: string | null = null;

            if (argsNode && argsNode.childCount > 0) {
              for (let a = 0; a < argsNode.childCount; a++) {
                const arg = argsNode.child(a)!;
                if (arg.type === "string" || arg.type === "template_string") {
                  const rawPath = arg.text.replace(/^['"`]|['"`]$/g, "");
                  if (rawPath.startsWith("/")) {
                    foundDirectPath = rawPath;
                    break;
                  }
                }
              }
            }

            if (foundDirectPath) {
              // Direct call: router.get<T>('/path', handler)
              const method = propName.toUpperCase() as Method;
              const routerVar = objNode.text;

              const prefixes = mountLinker
                ? mountLinker.getPrefixesForRouter(filePath, routerVar)
                : new Set(["/"]);

              for (const pfx of prefixes) {
                const fullPath = joinUrl(pfx, foundDirectPath);
                routes.push({
                  id: stableId(filePath, method, fullPath),
                  framework: "express",
                  method,
                  path: fullPath,
                  file: filePath,
                  confidence: "high",
                  source: "tree_sitter",
                });
              }
            } else {
              // Check if part of a chained call: router.route('/path').get(handler)
              const chain = findChainedBasePath(objNode);
              if (chain) {
                const method = propName.toUpperCase() as Method;
                const prefixes = mountLinker
                  ? mountLinker.getPrefixesForRouter(filePath, chain.routerVar)
                  : new Set(["/"]);

                for (const pfx of prefixes) {
                  const fullPath = joinUrl(pfx, chain.basePath);
                  routes.push({
                    id: stableId(filePath, method, fullPath),
                    framework: "express",
                    method,
                    path: fullPath,
                    file: filePath,
                    confidence: "high",
                    source: "tree_sitter",
                  });
                }
              }
            }
          }
        }
      }
    }
  });

  return routes;
}

// -------------------------------------------------------------
// 3. Python (FastAPI, Flask)
// -------------------------------------------------------------
export function extractPythonRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];

  walkTree(tree.rootNode, (node) => {
    if (node.type === "decorated_definition") {
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i)!;
        if (c.type === "decorator") {
          const text = c.text;
          const m = text.match(/@(?:app|router|api)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i);
          if (m) {
            const method = m[1].toUpperCase() as Method;
            let routePath = m[2];
            if (!routePath.startsWith("/")) routePath = "/" + routePath;

            routes.push({
              id: stableId(filePath, method, routePath),
              framework: "fastapi",
              method,
              path: routePath,
              file: filePath,
              confidence: "high",
              source: "tree_sitter",
            });
          }
        }
      }
    }
  });

  return routes;
}

// -------------------------------------------------------------
// 4. Go (Gin, Chi, Fiber, Echo)
// -------------------------------------------------------------
export function extractGoRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];

  walkTree(tree.rootNode, (node) => {
    if (node.type === "call_expression") {
      const text = node.text;
      const m = text.match(/\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*["']([^"']+)["']/i);
      if (m) {
        const method = m[1].toUpperCase() as Method;
        let routePath = m[2];
        if (!routePath.startsWith("/")) routePath = "/" + routePath;

        routes.push({
          id: stableId(filePath, method, routePath),
          framework: "gin",
          method,
          path: routePath,
          file: filePath,
          confidence: "high",
          source: "tree_sitter",
        });
      }
    }
  });

  return routes;
}

// -------------------------------------------------------------
// 5. Java (Spring Boot)
// -------------------------------------------------------------
export function extractJavaRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];

  walkTree(tree.rootNode, (node) => {
    if (node.type === "class_declaration") {
      let classPrefix = "";
      const classText = node.text;
      const reqMapMatch = classText.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/i);
      if (reqMapMatch) classPrefix = reqMapMatch[1];

      walkTree(node, (child) => {
        if (child.type === "method_declaration") {
          const mText = child.text;
          const springMatch = mText.match(/@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(\s*(?:value\s*=\s*)?["']([^"']*)["']\s*\))?/i);
          if (springMatch) {
            const method = springMatch[1].toUpperCase() as Method;
            const subPath = springMatch[2] || "";
            const fullPath = "/" + [classPrefix, subPath].filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\//, "");

            routes.push({
              id: stableId(filePath, method, fullPath),
              framework: "spring",
              method,
              path: fullPath,
              file: filePath,
              confidence: "high",
              source: "tree_sitter",
            });
          }
        }
      });
    }
  });

  return routes;
}

// -------------------------------------------------------------
// 6. PHP (Laravel / Symfony)
// -------------------------------------------------------------
export function extractPhpRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];

  walkTree(tree.rootNode, (node) => {
    if (node.type === "scoped_call_expression" || node.type === "function_call_expression") {
      const text = node.text;
      const m = text.match(/Route::(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i);
      if (m) {
        const method = m[1].toUpperCase() as Method;
        let routePath = m[2];
        if (!routePath.startsWith("/")) routePath = "/" + routePath;

        routes.push({
          id: stableId(filePath, method, routePath),
          framework: "laravel",
          method,
          path: routePath,
          file: filePath,
          confidence: "high",
          source: "tree_sitter",
        });
      }
    }
  });

  return routes;
}

// -------------------------------------------------------------
// Master Tree-sitter Extractor Dispatcher
// -------------------------------------------------------------
export async function extractRoutesWithTreeSitter(
  candidate: FileCandidate,
  mountLinker?: SymbolicMountLinker,
): Promise<OmniRoute[]> {
  const langKey = candidate.language === "csharp" ? "csharp" : candidate.language;
  const result = await getLanguageParser(langKey);
  if (!result) return [];

  const { parser } = result;
  let tree: Parser.Tree;
  try {
    tree = parser.parse(candidate.content);
  } catch (err) {
    console.error(`[TreeSitter] Failed to parse ${candidate.relativePath}:`, err);
    return [];
  }

  switch (candidate.language) {
    case "csharp":
      return extractCSharpRoutes(tree, candidate.filePath);
    case "typescript":
    case "javascript":
      return extractTsJsRoutes(tree, candidate.filePath, mountLinker);
    case "python":
      return extractPythonRoutes(tree, candidate.filePath);
    case "go":
      return extractGoRoutes(tree, candidate.filePath);
    case "java":
      return extractJavaRoutes(tree, candidate.filePath);
    case "php":
      return extractPhpRoutes(tree, candidate.filePath);
    default:
      return [];
  }
}
