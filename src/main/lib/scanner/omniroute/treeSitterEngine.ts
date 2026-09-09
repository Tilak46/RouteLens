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
          const m = text.match(/@(?:app|router|api)\.(get|post|put|delete|patch)\s*\(\s*(?:['"]([^'"]*)['"])?/i);
          if (m) {
            const method = m[1].toUpperCase() as Method;
            let routePath = m[2] || "/";
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
// 4. Go (Gin, Chi, Fiber, Echo) - Universal Invariant CST Visitor
// -------------------------------------------------------------
function getGoLiteralString(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "interpreted_string_literal" || node.type === "raw_string_literal") {
    const raw = node.text;
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
    if (raw.startsWith('`') && raw.endsWith('`')) return raw.slice(1, -1);
    return raw;
  }
  return null;
}

const GO_HTTP_METHODS = new Set([
  "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS",
  "Get", "Post", "Put", "Delete", "Patch", "Head", "Options",
]);

const GO_NON_ROUTER_RECEIVERS = new Set([
  "header", "headers", "query", "url", "cookie", "cookies", "param", "params",
  "cache", "redis", "db", "memcache", "ret", "mock", "ctx", "context", "req", "res",
]);

export function extractGoRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];
  const routerPrefixes = new Map<string, string>();
  routerPrefixes.set("r", "/");
  routerPrefixes.set("router", "/");
  routerPrefixes.set("e", "/");
  routerPrefixes.set("app", "/");
  routerPrefixes.set("engine", "/");
  routerPrefixes.set("server", "/");
  routerPrefixes.set("api", "/");

  function getReceiverPrefix(receiverText: string): string {
    const clean = receiverText.trim();
    if (routerPrefixes.has(clean)) return routerPrefixes.get(clean)!;
    return "/";
  }

  function walk(node: Parser.SyntaxNode) {
    if (!node) return;

    // 1. Lexical Scope Tracking: Group assignments
    // Example: v1 := r.Group("/api/v1") or accounts := v1.Group("/accounts")
    if (node.type === "short_var_declaration" || node.type === "assignment_statement") {
      const left = node.childForFieldName("left") || node.children.find((c) => c.type === "expression_list");
      const right = node.childForFieldName("right") || node.children.filter((c) => c.type === "expression_list")[1];

      if (left && right) {
        const callExp = right.type === "call_expression" ? right : right.children.find((c) => c.type === "call_expression");
        if (callExp) {
          const fn = callExp.childForFieldName("function");
          if (fn && fn.type === "selector_expression") {
            const operand = fn.childForFieldName("operand");
            const field = fn.childForFieldName("field");
            if (field && (field.text === "Group" || field.text === "Party")) {
              const args = callExp.childForFieldName("arguments");
              if (args && args.namedChildren.length > 0) {
                const prefixVal = getGoLiteralString(args.namedChildren[0]);
                if (prefixVal !== null) {
                  const parentPrefix = operand ? getReceiverPrefix(operand.text) : "/";
                  const newPrefix = joinUrl(parentPrefix, prefixVal);
                  const varName = left.text.trim();
                  routerPrefixes.set(varName, newPrefix);
                }
              }
            }
          }
        }
      }
    }

    // 2. Chi sub-routers: r.Route("/articles", func(r chi.Router) { ... })
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      if (fn && fn.type === "selector_expression") {
        const operand = fn.childForFieldName("operand");
        const field = fn.childForFieldName("field");

        if (field && (field.text === "Route" || field.text === "Mount")) {
          const args = node.childForFieldName("arguments");
          if (args && args.namedChildren.length >= 2) {
            const pathArg = getGoLiteralString(args.namedChildren[0]);
            const secondArg = args.namedChildren[1];

            if (pathArg !== null) {
              const parentPrefix = operand ? getReceiverPrefix(operand.text) : "/";
              const routePrefix = joinUrl(parentPrefix, pathArg);

              // If second argument is a callback: func(r chi.Router) { ... }
              if (secondArg && secondArg.type === "func_literal") {
                const params = secondArg.childForFieldName("parameters");
                let scopedVar = "r";
                if (params && params.namedChildren.length > 0) {
                  const firstParam = params.namedChildren[0];
                  const paramId = firstParam.childForFieldName("name") || firstParam.children.find((c) => c.type === "identifier");
                  if (paramId) scopedVar = paramId.text.trim();
                }

                const prevPrefix = routerPrefixes.get(scopedVar);
                routerPrefixes.set(scopedVar, routePrefix);

                // Traverse the closure body
                const body = secondArg.childForFieldName("body");
                if (body) {
                  for (let i = 0; i < body.childCount; i++) {
                    walk(body.child(i)!);
                  }
                }

                if (prevPrefix !== undefined) {
                  routerPrefixes.set(scopedVar, prevPrefix);
                } else {
                  routerPrefixes.delete(scopedVar);
                }
                return;
              }
            }
          }
        }

        // 3. HTTP Route Registration: r.GET("/path", handler...)
        if (field && GO_HTTP_METHODS.has(field.text)) {
          const method = field.text.toUpperCase() as Method;
          const operandText = operand ? operand.text.trim().toLowerCase() : "";

          // Universal invariant: Filter out non-router receivers (Headers, Query, Cache, Context)
          let isBlockedReceiver = false;
          for (const blocked of GO_NON_ROUTER_RECEIVERS) {
            if (
              operandText === blocked ||
              operandText.endsWith("." + blocked) ||
              operandText.endsWith("()." + blocked)
            ) {
              isBlockedReceiver = true;
              break;
            }
          }

          if (!isBlockedReceiver) {
            const args = node.childForFieldName("arguments");
            if (args) {
              const namedArgs = args.namedChildren;
              // Universal invariant: Route registrations MUST have at least 2 arguments: (path, handler)
              if (namedArgs.length >= 2) {
                const pathVal = getGoLiteralString(namedArgs[0]);
                // Universal invariant: First argument MUST be an interpreted or raw string literal
                if (pathVal !== null) {
                  const parentPrefix = operand ? getReceiverPrefix(operand.text) : "/";
                  let fullPath = joinUrl(parentPrefix, pathVal);
                  if (!fullPath.startsWith("/")) fullPath = "/" + fullPath;

                  routes.push({
                    id: stableId(filePath, method, fullPath),
                    framework: "gin",
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

    // Recurse children
    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i)!);
    }
  }

  walk(tree.rootNode);
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
      const reqMapMatch = classText.match(/@RequestMapping\s*\(\s*(?:(?:value|path)\s*=\s*)?["']([^"']+)["']/i);
      if (reqMapMatch) classPrefix = reqMapMatch[1];

      walkTree(node, (child) => {
        if (child.type === "method_declaration") {
          const mText = child.text;
          const springMatch = mText.match(/@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(\s*(?:(?:value|path)\s*=\s*)?["']([^"']*)["']\s*\))?/i);
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
  const isApiRoute = filePath.replace(/\\/g, "/").toLowerCase().includes("routes/api.php");

  walkTree(tree.rootNode, (node) => {
    if (node.type.includes("call_expression")) {
      const text = node.text;
      const m = text.match(/Route::(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i);
      if (m) {
        const method = m[1].toUpperCase() as Method;
        let routePath = m[2];
        if (!routePath.startsWith("/")) routePath = "/" + routePath;
        if (isApiRoute && !routePath.startsWith("/api")) {
          routePath = "/api" + routePath;
        }

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
