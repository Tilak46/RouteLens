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

function patchTreeSitterCtype(): void {
  try {
    const tsJsPath = require.resolve("web-tree-sitter/tree-sitter.js");
    if (fs.existsSync(tsJsPath)) {
      let code = fs.readFileSync(tsJsPath, "utf8");
      if (!code.includes("iswxdigit:")) {
        const target = "var asmLibraryArg={";
        const replacement = "var asmLibraryArg={iswspace:(c)=>((c===32||(c>=9&&c<=13)||c===0x85||c===0xa0||c===0x1680||(c>=0x2000&&c<=0x200a)||c===0x2028||c===0x2029||c===0x202f||c===0x205f||c===0x3000)?1:0),iswdigit:(c)=>((c>=48&&c<=57)?1:0),iswxdigit:(c)=>(((c>=48&&c<=57)||(c>=65&&c<=70)||(c>=97&&c<=102))?1:0),iswalpha:(c)=>(((c>=65&&c<=90)||(c>=97&&c<=122))?1:0),iswalnum:(c)=>(((c>=48&&c<=57)||(c>=65&&c<=90)||(c>=97&&c<=122))?1:0),iswupper:(c)=>((c>=65&&c<=90)?1:0),iswlower:(c)=>((c>=97&&c<=122)?1:0),";
        if (code.includes("iswspace:")) {
          code = code.replace("iswdigit:(c)=>((c>=48&&c<=57)?1:0),", "iswdigit:(c)=>((c>=48&&c<=57)?1:0),iswxdigit:(c)=>(((c>=48&&c<=57)||(c>=65&&c<=70)||(c>=97&&c<=102))?1:0),");
        } else {
          code = code.replace(target, replacement);
        }
        fs.writeFileSync(tsJsPath, code, "utf8");
      }
    }
  } catch {
    // Ignore if not writable
  }
}

async function ensureParserInit(): Promise<void> {
  if (isParserInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    patchTreeSitterCtype();
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
function getCSharpStringLiteral(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "string_literal" || node.type === "raw_string_literal") {
    const raw = node.text;
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
    if (raw.startsWith('@"') && raw.endsWith('"')) return raw.slice(2, -1);
    if (raw.startsWith('$@"') && raw.endsWith('"')) return raw.slice(3, -1);
    if (raw.startsWith('$"') && raw.endsWith('"')) return raw.slice(2, -1);
    return raw;
  }
  return null;
}

function getCSharpAttrString(attrNode: Parser.SyntaxNode): string | null {
  const args = attrNode.children.find((c) => c.type === "attribute_argument_list");
  if (!args) return null;
  for (let i = 0; i < args.childCount; i++) {
    const c = args.child(i)!;
    if (c.type === "attribute_argument") {
      const sNode = c.children.find((x) => x.type === "string_literal" || x.type === "raw_string_literal");
      if (sNode) return getCSharpStringLiteral(sNode);
    }
  }
  return null;
}

const CSHARP_HTTP_METHODS: Record<string, Method> = {
  HttpGet: "GET",
  HttpPost: "POST",
  HttpPut: "PUT",
  HttpDelete: "DELETE",
  HttpPatch: "PATCH",
  HttpHead: "HEAD",
  HttpOptions: "OPTIONS",
};

export function extractCSharpRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];

  const groupPrefixMap = new Map<string, string>();

  function walk(node: Parser.SyntaxNode) {
    // 0. Track MapGroup variables: var group = routes.MapGroup("/todos");
    if (node.type === "variable_declarator") {
      const varName = node.child(0)?.text;
      const init = node.children.find((c) => c.type === "equals_value_clause");
      if (varName && init) {
        const expr = init.child(1);
        if (expr && expr.type === "invocation_expression") {
          const mAccess = expr.child(0);
          if (mAccess && mAccess.type === "member_access_expression" && mAccess.child(2)?.text === "MapGroup") {
            const args = expr.children.find((c) => c.type === "argument_list");
            if (args && args.childCount > 1) {
              const arg = args.child(1);
              const str = getCSharpStringLiteral(arg?.child(0));
              if (str !== null) {
                groupPrefixMap.set(varName, str);
              }
            }
          }
        }
      }
    }

    // A. Class-based Controllers
    if (node.type === "class_declaration") {
      let classPrefix = "";
      let className = "";

      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i)!;
        if (c.type === "identifier") className = c.text;
        if (c.type === "attribute_list") {
          for (let j = 0; j < c.childCount; j++) {
            const attr = c.child(j)!;
            if (attr.type === "attribute" && attr.child(0)?.text === "Route") {
              const s = getCSharpAttrString(attr);
              if (s !== null) classPrefix = s;
            }
          }
        }
      }

      if (classPrefix.includes("[controller]")) {
        const ctrlName = className.replace(/Controller$/, "");
        classPrefix = classPrefix.replace(/\[controller\]/gi, ctrlName.toLowerCase());
      }

      function findMethods(n: Parser.SyntaxNode) {
        if (n.type === "method_declaration") {
          let methodName = "";
          for (let i = 0; i < n.childCount; i++) {
            const c = n.child(i)!;
            if (c.type === "identifier") {
              methodName = c.text;
              break;
            }
          }

          let verb: Method | null = null;
          let methodSubPath = "";

          for (let i = 0; i < n.childCount; i++) {
            const c = n.child(i)!;
            if (c.type === "attribute_list") {
              for (let j = 0; j < c.childCount; j++) {
                const attr = c.child(j)!;
                if (attr.type === "attribute") {
                  const name = attr.child(0)?.text;
                  if (name && CSHARP_HTTP_METHODS[name]) {
                    verb = CSHARP_HTTP_METHODS[name];
                    const sub = getCSharpAttrString(attr);
                    if (sub) methodSubPath = sub;
                  } else if (name === "Route") {
                    const sub = getCSharpAttrString(attr);
                    if (sub) methodSubPath = sub;
                  }
                }
              }
            }
          }

          if (verb) {
            let combined = [classPrefix, methodSubPath].filter(Boolean).join("/");
            if (!combined.startsWith("/")) combined = "/" + combined;
            if (combined.includes("[action]")) {
              combined = combined.replace(/\[action\]/gi, methodName.toLowerCase());
            }
            let full = combined.replace(/\/+/g, "/");
            if (full.length > 1 && full.endsWith("/")) full = full.slice(0, -1);

            routes.push({
              id: stableId(filePath, verb, full),
              framework: "aspnet",
              method: verb,
              path: full,
              file: filePath,
              confidence: "high",
              source: "tree_sitter",
            });
          }
        }
        for (let i = 0; i < n.childCount; i++) {
          findMethods(n.child(i)!);
        }
      }

      // Also check if class defines Map(RouteGroupBuilder ...) or AddRoutes(...)
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i)!;
        if (c.type === "declaration_list") {
          for (let j = 0; j < c.childCount; j++) {
            const m = c.child(j)!;
            if (m.type === "method_declaration") {
              const mName = m.children.find((x) => x.type === "identifier")?.text;
              if (mName === "Map" || mName === "AddRoutes") {
                const params = m.children.find((x) => x.type === "parameter_list");
                if (params) {
                  for (let k = 0; k < params.childCount; k++) {
                    const p = params.child(k)!;
                    if (p.type === "parameter") {
                      const idents = p.children.filter((x) => x.type === "identifier");
                      const pName = idents.length > 0 ? idents[idents.length - 1].text : null;
                      if (pName) {
                        groupPrefixMap.set(pName, classPrefix || `/api/${className}`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      findMethods(node);
    }

    // B. Minimal APIs: app.MapGet("/path", ...), app.MapPost(...), group.MapGet(...)
    if (node.type === "invocation_expression") {
      const expr = node.child(0);
      if (expr && expr.type === "member_access_expression") {
        const receiver = expr.child(0)?.text;
        const prop = expr.child(2);
        if (prop && prop.text.startsWith("Map")) {
          const verb = prop.text === "Map" ? "GET" : prop.text.slice(3).toUpperCase();
          if (["GET", "POST", "PUT", "DELETE", "PATCH"].includes(verb)) {
            const args = node.children.find((c) => c.type === "argument_list");
            let str: string | null = null;
            if (args) {
              for (let i = 0; i < args.childCount; i++) {
                const arg = args.child(i)!;
                if (arg.type === "argument") {
                  const s = getCSharpStringLiteral(arg.child(0));
                  if (s !== null) {
                    str = s;
                    break;
                  }
                }
              }
            }

            const hasGroup = receiver && groupPrefixMap.has(receiver);
            if (str !== null || hasGroup) {
              const prefix = (receiver && groupPrefixMap.get(receiver)) || "";
              let combined = [prefix, str || ""].filter(Boolean).join("/");
              if (!combined.startsWith("/")) combined = "/" + combined;
              let full = combined.replace(/\/+/g, "/");
              if (full.length > 1 && full.endsWith("/")) full = full.slice(0, -1);
              routes.push({
                id: stableId(filePath, verb as Method, full),
                framework: "aspnet",
                method: verb as Method,
                path: full,
                file: filePath,
                confidence: "high",
                source: "tree_sitter",
              });
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
// 3. Python (FastAPI, Flask, Starlette, Django) - Universal Invariant CST Visitor
// -------------------------------------------------------------
function getPythonStringLiteral(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "string") {
    const raw = node.text;
    const unPrefixed = raw.replace(/^[rRfFuUbB]+/, "");
    if (unPrefixed.startsWith('"""') && unPrefixed.endsWith('"""')) return unPrefixed.slice(3, -3);
    if (unPrefixed.startsWith("'''") && unPrefixed.endsWith("'''")) return unPrefixed.slice(3, -3);
    if (unPrefixed.startsWith('"') && unPrefixed.endsWith('"')) return unPrefixed.slice(1, -1);
    if (unPrefixed.startsWith("'") && unPrefixed.endsWith("'")) return unPrefixed.slice(1, -1);
    return unPrefixed;
  }
  return null;
}

const PYTHON_METHODS = new Set(["get", "post", "put", "delete", "patch", "options", "head"]);

export function extractPythonRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];
  const routerPrefixes = new Map<string, string>();
  routerPrefixes.set("app", "/");
  routerPrefixes.set("router", "/");
  routerPrefixes.set("api", "/");
  routerPrefixes.set("bp", "/");

  function walk(node: Parser.SyntaxNode) {
    if (!node) return;

    // 1. Prefix tracking: router = APIRouter(prefix="/users") or bp = Blueprint("auth", __name__, url_prefix="/auth")
    if (node.type === "assignment") {
      const left = node.child(0);
      const right = node.child(2);
      if (left && left.type === "identifier" && right && right.type === "call") {
        const fn = right.child(0);
        const fnName = fn?.text;
        if (fnName === "APIRouter" || fnName === "Blueprint") {
          const args = right.children.find((c) => c.type === "argument_list");
          if (args) {
            for (let i = 0; i < args.childCount; i++) {
              const arg = args.child(i)!;
              if (arg.type === "keyword_argument") {
                const kName = arg.child(0)?.text;
                if (kName === "prefix" || kName === "url_prefix") {
                  const valNode = arg.child(2);
                  const strVal = getPythonStringLiteral(valNode);
                  if (strVal !== null) {
                    routerPrefixes.set(left.text.trim(), strVal);
                  }
                }
              }
            }
          }
        }
      }
    }

    // 2. Decorators: @app.get(...), @bp.route(...), @router.api_route(...)
    if (node.type === "decorated_definition") {
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i)!;
        if (c.type === "decorator") {
          const callNode = c.children.find((child) => child.type === "call");
          if (callNode) {
            const fnNode = callNode.child(0);
            if (fnNode && fnNode.type === "attribute") {
              const operand = fnNode.child(0);
              const field = fnNode.child(2);
              if (operand && field) {
                const receiver = operand.text.trim();
                const action = field.text.trim().toLowerCase();

                let methods: Method[] = [];
                let isRouteDecorator = false;
                let framework: OmniFramework = "fastapi";

                if (PYTHON_METHODS.has(action)) {
                  methods = [action.toUpperCase() as Method];
                  isRouteDecorator = true;
                  if (receiver === "bp" || receiver.endsWith("_bp")) {
                    framework = "flask";
                  }
                } else if (action === "route" || action === "api_route") {
                  isRouteDecorator = true;
                  framework = action === "api_route" ? "fastapi" : "flask";

                  // Look for methods=[...] in arguments
                  const args = callNode.children.find((child) => child.type === "argument_list");
                  let foundMethods = false;
                  if (args) {
                    for (let j = 0; j < args.childCount; j++) {
                      const arg = args.child(j)!;
                      if (arg.type === "keyword_argument" && arg.child(0)?.text === "methods") {
                        const valNode = arg.child(2);
                        if (valNode && (valNode.type === "list" || valNode.type === "tuple")) {
                          for (let k = 0; k < valNode.childCount; k++) {
                            const mStr = getPythonStringLiteral(valNode.child(k)!);
                            if (mStr) {
                              methods.push(mStr.toUpperCase() as Method);
                              foundMethods = true;
                            }
                          }
                        }
                      }
                    }
                  }
                  if (!foundMethods) {
                    methods = ["GET"];
                  }
                }

                if (isRouteDecorator) {
                  const args = callNode.children.find((child) => child.type === "argument_list");
                  let pathVal: string | null = null;
                  if (args) {
                    for (let j = 0; j < args.childCount; j++) {
                      const arg = args.child(j)!;
                      if (arg.type === "string") {
                        pathVal = getPythonStringLiteral(arg);
                        break;
                      } else if (arg.type === "keyword_argument") {
                        const kName = arg.child(0)?.text;
                        if (kName === "path" || kName === "rule") {
                          pathVal = getPythonStringLiteral(arg.child(2));
                          break;
                        }
                      }
                    }
                  }

                  if (pathVal !== null) {
                    const prefix = routerPrefixes.get(receiver) || "/";
                    let fullPath = joinUrl(prefix, pathVal);
                    if (!fullPath.startsWith("/")) fullPath = "/" + fullPath;

                    for (const m of methods) {
                      routes.push({
                        id: stableId(filePath, m, fullPath),
                        framework,
                        method: m,
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
      }
    }

    // 3. Route Tables: Starlette Route(...) & Django path(...)
    if (node.type === "call") {
      const fn = node.child(0);
      const fnName = fn?.text;
      if (fnName === "Route") {
        const args = node.children.find((c) => c.type === "argument_list");
        if (args) {
          let pathVal: string | null = null;
          let methods: Method[] = [];
          for (let j = 0; j < args.childCount; j++) {
            const arg = args.child(j)!;
            if (arg.type === "string" && pathVal === null) {
              pathVal = getPythonStringLiteral(arg);
            } else if (arg.type === "keyword_argument" && arg.child(0)?.text === "methods") {
              const valNode = arg.child(2);
              if (valNode && (valNode.type === "list" || valNode.type === "tuple")) {
                for (let k = 0; k < valNode.childCount; k++) {
                  const mStr = getPythonStringLiteral(valNode.child(k)!);
                  if (mStr) methods.push(mStr.toUpperCase() as Method);
                }
              }
            }
          }
          if (pathVal !== null) {
            if (methods.length === 0) methods = ["GET"];
            for (const m of methods) {
              const fullPath = pathVal.startsWith("/") ? pathVal : "/" + pathVal;
              routes.push({
                id: stableId(filePath, m, fullPath),
                framework: "starlette",
                method: m,
                path: fullPath,
                file: filePath,
                confidence: "high",
                source: "tree_sitter",
              });
            }
          }
        }
      } else if (fnName === "path" || fnName === "re_path" || fnName === "url") {
        const args = node.children.find((c) => c.type === "argument_list");
        if (args && args.namedChildren.length >= 2) {
          const secondArg = args.namedChildren[1];
          // Skip include(...) router mount delegations
          if (!secondArg.text.includes("include(")) {
            const firstArg = args.namedChildren[0];
            const rawVal = getPythonStringLiteral(firstArg);
            if (rawVal !== null) {
              // Clean regex patterns in Django url(r'^...')
              let clean = rawVal.replace(/^\^/, "").replace(/\/?\$$/, "").replace(/\?$/, "");
              // Convert (?P<name>...) to {name}
              clean = clean.replace(/\(\?P<([a-zA-Z0-9_]+)>[^)]*\)/g, "{$1}");
              if (!clean.startsWith("/")) clean = "/" + clean;
              routes.push({
                id: stableId(filePath, "GET", clean),
                framework: "django",
                method: "GET",
                path: clean,
                file: filePath,
                confidence: "high",
                source: "tree_sitter",
              });
            }
          }
        }
      }

      // 4. Django REST Framework router.register(r'articles', ArticleViewSet)
      const fnNode = node.child(0);
      if (fnNode && fnNode.type === "attribute") {
        const field = fnNode.child(2);
        if (field && field.text === "register") {
          const args = node.children.find((c) => c.type === "argument_list");
          if (args && args.namedChildren.length >= 2) {
            const firstArg = args.namedChildren[0];
            const prefixStr = getPythonStringLiteral(firstArg);
            if (prefixStr !== null) {
              const cleanPrefix = "/" + prefixStr.replace(/^\/+|\/+$/g, "");
              const viewSetMethods: Array<{ method: Method; sub: string }> = [
                { method: "GET", sub: "" },
                { method: "POST", sub: "" },
                { method: "GET", sub: "/{id}" },
                { method: "PUT", sub: "/{id}" },
                { method: "DELETE", sub: "/{id}" },
              ];
              for (const vm of viewSetMethods) {
                const fullP = cleanPrefix + vm.sub;
                routes.push({
                  id: stableId(filePath, vm.method, fullP),
                  framework: "django",
                  method: vm.method,
                  path: fullP,
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

    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i)!);
    }
  }

  walk(tree.rootNode);
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
function getJavaStringLiteral(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "string_literal") {
    const text = node.text;
    if (text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
  }
  return null;
}

function extractJavaPathsFromNode(valNode: Parser.SyntaxNode): string[] {
  const paths: string[] = [];
  if (valNode.type === "string_literal") {
    const s = getJavaStringLiteral(valNode);
    if (s !== null) paths.push(s);
  } else if (valNode.type === "element_value_array_initializer") {
    for (let i = 0; i < valNode.childCount; i++) {
      const c = valNode.child(i)!;
      if (c.type === "string_literal") {
        const s = getJavaStringLiteral(c);
        if (s !== null) paths.push(s);
      }
    }
  }
  return paths;
}

function extractJavaAnnotationData(annoNode: Parser.SyntaxNode): {
  name: string;
  paths: string[];
  methods: Method[];
} {
  let name = "";
  for (let i = 0; i < annoNode.childCount; i++) {
    const c = annoNode.child(i)!;
    if (c.type === "identifier" || c.type === "scoped_identifier") {
      name = c.text;
      break;
    }
  }

  const paths: string[] = [];
  const methods: Method[] = [];

  const argList = annoNode.children.find((c) => c.type === "annotation_argument_list");
  if (argList) {
    for (let i = 0; i < argList.childCount; i++) {
      const child = argList.child(i)!;
      if (child.type === "string_literal") {
        const p = getJavaStringLiteral(child);
        if (p !== null) paths.push(p);
      } else if (child.type === "element_value_array_initializer") {
        paths.push(...extractJavaPathsFromNode(child));
      } else if (child.type === "element_value_pair") {
        const keyNode = child.child(0);
        const valNode = child.child(2);
        if (keyNode && valNode) {
          const key = keyNode.text;
          if (key === "value" || key === "path") {
            paths.push(...extractJavaPathsFromNode(valNode));
          } else if (key === "method") {
            const mText = valNode.text;
            const matches = mText.match(/(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)/gi);
            if (matches) {
              for (const m of matches) {
                methods.push(m.toUpperCase() as Method);
              }
            }
          }
        }
      }
    }
  }

  return { name, paths, methods };
}

export function extractJavaRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];

  function walk(node: Parser.SyntaxNode) {
    if (node.type === "class_declaration") {
      let classPrefixes: string[] = [""];
      let framework: OmniFramework = "spring";

      const modifiers = node.children.find((c) => c.type === "modifiers");
      if (modifiers) {
        for (let i = 0; i < modifiers.childCount; i++) {
          const m = modifiers.child(i)!;
          if (m.type === "annotation" || m.type === "marker_annotation") {
            const anno = extractJavaAnnotationData(m);
            if (anno.name === "RequestMapping" || anno.name === "Path") {
              if (anno.paths.length > 0) {
                classPrefixes = anno.paths;
              }
            }
          }
        }
      }

      const body = node.children.find((c) => c.type === "class_body");
      if (body) {
        for (let i = 0; i < body.childCount; i++) {
          const member = body.child(i)!;
          if (member.type === "method_declaration") {
            const mModifiers = member.children.find((c) => c.type === "modifiers");
            if (!mModifiers) continue;

            const springMappingMap: Record<string, Method> = {
              GetMapping: "GET",
              PostMapping: "POST",
              PutMapping: "PUT",
              DeleteMapping: "DELETE",
              PatchMapping: "PATCH",
            };

            const jaxRsMethods = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

            let detectedMethods: Method[] = [];
            let methodSubPaths: string[] = [];
            let isRouteMethod = false;

            for (let j = 0; j < mModifiers.childCount; j++) {
              const annoNode = mModifiers.child(j)!;
              if (annoNode.type !== "annotation" && annoNode.type !== "marker_annotation") continue;

              const anno = extractJavaAnnotationData(annoNode);

              if (springMappingMap[anno.name]) {
                isRouteMethod = true;
                detectedMethods.push(springMappingMap[anno.name]);
                if (anno.paths.length > 0) {
                  methodSubPaths.push(...anno.paths);
                }
              } else if (anno.name === "RequestMapping") {
                isRouteMethod = true;
                const mList = anno.methods.length > 0 ? anno.methods : (["GET"] as Method[]);
                detectedMethods.push(...mList);
                if (anno.paths.length > 0) {
                  methodSubPaths.push(...anno.paths);
                }
              } else if (jaxRsMethods.has(anno.name.toUpperCase())) {
                isRouteMethod = true;
                detectedMethods.push(anno.name.toUpperCase() as Method);
              } else if (anno.name === "Path") {
                if (anno.paths.length > 0) {
                  methodSubPaths.push(...anno.paths);
                }
              }
            }

            if (isRouteMethod && detectedMethods.length > 0) {
              const finalSubPaths = methodSubPaths.length > 0 ? methodSubPaths : [""];
              for (const m of detectedMethods) {
                for (const cp of classPrefixes) {
                  for (const sp of finalSubPaths) {
                    let full = "/" + [cp, sp].filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\//, "");
                    if (!full.startsWith("/")) full = "/" + full;

                    routes.push({
                      id: stableId(filePath, m, full),
                      framework,
                      method: m,
                      path: full,
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
    }

    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i)!);
    }
  }

  walk(tree.rootNode);
  return routes;
}

// -------------------------------------------------------------
// 6. PHP (Laravel / Symfony)
// -------------------------------------------------------------
function getPhpStringLiteral(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "string" || node.type === "encapsed_string") {
    const content = node.children.find((c) => c.type === "string_content");
    if (content) return content.text;
    const raw = node.text;
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
      return raw.slice(1, -1);
    }
    return raw;
  }
  return null;
}

const LARAVEL_HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "options", "head"]);

function parseSymfonyRouteAttr(attrNode: Parser.SyntaxNode): { path: string; methods: Method[] } | null {
  const nameNode = attrNode.child(0);
  if (!nameNode || nameNode.text !== "Route") return null;

  const argsNode = attrNode.children.find((c) => c.type === "arguments");
  if (!argsNode) return null;

  const args = argsNode.children.filter((c) => c.type === "argument");
  if (args.length === 0) return null;

  const firstArgVal = args[0].child(0);
  const pathVal = getPhpStringLiteral(firstArgVal);
  if (pathVal === null) return null;

  let methods: Method[] = ["GET"];
  const methodArg = args.find((a) => a.text.startsWith("methods:"));
  if (methodArg) {
    const matches = methodArg.text.match(/(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)/gi);
    if (matches) methods = matches.map((m) => m.toUpperCase() as Method);
  }

  return { path: pathVal, methods };
}

export function extractPhpRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];
  const isApiRoute = filePath.replace(/\\/g, "/").toLowerCase().includes("routes/api.php");

  function walk(node: Parser.SyntaxNode) {
    // 1. Scoped calls: Route::get(...) or $router->get(...)
    if (node.type === "scoped_call_expression" || node.type === "member_call_expression") {
      let fnName: string | null = null;
      let argsNode: Parser.SyntaxNode | null = null;
      let isRouteCaller = false;

      if (node.type === "scoped_call_expression") {
        const scopeNode = node.child(0);
        const nameNode = node.child(2);
        argsNode = node.children.find((c) => c.type === "arguments") || null;
        if (scopeNode && scopeNode.text === "Route" && nameNode) {
          isRouteCaller = true;
          fnName = nameNode.text.toLowerCase();
        }
      } else if (node.type === "member_call_expression") {
        const obj = node.child(0);
        const nameNode = node.child(2);
        argsNode = node.children.find((c) => c.type === "arguments") || null;
        if (obj && (obj.text.includes("Route") || obj.text === "$router") && nameNode) {
          isRouteCaller = true;
          fnName = nameNode.text.toLowerCase();
        }
      }

      if (isRouteCaller && fnName && argsNode) {
        const args = argsNode.children.filter((c) => c.type === "argument");
        if (args.length >= 1) {
          const firstArg = args[0].child(0);
          const pathVal = getPhpStringLiteral(firstArg);

          if (LARAVEL_HTTP_METHODS.has(fnName) && pathVal !== null) {
            let fullPath = pathVal.startsWith("/") ? pathVal : "/" + pathVal;
            if (isApiRoute && !fullPath.startsWith("/api")) {
              fullPath = "/api" + fullPath;
            }
            routes.push({
              id: stableId(filePath, fnName.toUpperCase(), fullPath),
              framework: "laravel",
              method: fnName.toUpperCase() as Method,
              path: fullPath,
              file: filePath,
              confidence: "high",
              source: "tree_sitter",
            });
          } else if ((fnName === "apiresource" || fnName === "resource") && pathVal !== null) {
            let base = pathVal.startsWith("/") ? pathVal : "/" + pathVal;
            if (isApiRoute && !base.startsWith("/api")) base = "/api" + base;
            const resMethods: Array<{ method: Method; sub: string }> = [
              { method: "GET", sub: "" },
              { method: "POST", sub: "" },
              { method: "GET", sub: "/{id}" },
              { method: "PUT", sub: "/{id}" },
              { method: "DELETE", sub: "/{id}" },
            ];
            for (const rm of resMethods) {
              const fullP = base + rm.sub;
              routes.push({
                id: stableId(filePath, rm.method, fullP),
                framework: "laravel",
                method: rm.method,
                path: fullP,
                file: filePath,
                confidence: "high",
                source: "tree_sitter",
              });
            }
          } else if (fnName === "any" && pathVal !== null) {
            let fullPath = pathVal.startsWith("/") ? pathVal : "/" + pathVal;
            if (isApiRoute && !fullPath.startsWith("/api")) fullPath = "/api" + fullPath;
            for (const m of ["GET", "POST", "PUT", "DELETE"] as Method[]) {
              routes.push({
                id: stableId(filePath, m, fullPath),
                framework: "laravel",
                method: m,
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

    // 2. Symfony / PHP 8+ Attributes: #[Route('/path', methods: ['GET'])]
    if (node.type === "class_declaration") {
      let classPrefix = "";
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i)!;
        if (c.type === "attribute_list") {
          for (let j = 0; j < c.childCount; j++) {
            const grp = c.child(j)!;
            if (grp.type === "attribute_group") {
              for (let k = 0; k < grp.childCount; k++) {
                const attr = grp.child(k)!;
                if (attr.type === "attribute") {
                  const parsed = parseSymfonyRouteAttr(attr);
                  if (parsed) classPrefix = parsed.path;
                }
              }
            }
          }
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const member = node.child(i)!;
        if (member.type === "declaration_list") {
          for (let j = 0; j < member.childCount; j++) {
            const mDecl = member.child(j)!;
            if (mDecl.type === "method_declaration") {
              for (let k = 0; k < mDecl.childCount; k++) {
                const mChild = mDecl.child(k)!;
                if (mChild.type === "attribute_list") {
                  for (let l = 0; l < mChild.childCount; l++) {
                    const grp = mChild.child(l)!;
                    if (grp.type === "attribute_group") {
                      for (let m = 0; m < grp.childCount; m++) {
                        const attr = grp.child(m)!;
                        if (attr.type === "attribute") {
                          const parsed = parseSymfonyRouteAttr(attr);
                          if (parsed) {
                            let full = "/" + [classPrefix, parsed.path].filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\//, "");
                            if (!full.startsWith("/")) full = "/" + full;
                            for (const meth of parsed.methods) {
                              routes.push({
                                id: stableId(filePath, meth, full),
                                framework: "symfony",
                                method: meth,
                                path: full,
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
  return routes;
}

// -------------------------------------------------------------
// 7. Rust (Axum, Actix-web, Rocket)
// -------------------------------------------------------------
function getRustStringLiteral(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "string_literal" || node.type === "raw_string_literal") {
    const raw = node.text;
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
    if (raw.startsWith('r#"') && raw.endsWith('"#')) return raw.slice(3, -2);
    return raw;
  }
  return null;
}

const RUST_HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

function getScopeCall(node: Parser.SyntaxNode): { node: Parser.SyntaxNode; prefix: string } | null {
  if (node.type === "call_expression") {
    const fnNode = node.child(0);
    if (fnNode && (fnNode.text === "web::scope" || fnNode.text === "scope" || fnNode.text === "web::resource" || fnNode.text === "resource")) {
      const args = node.children.find((c) => c.type === "arguments");
      const strNode = args?.children.find((c) => c.type === "string_literal" || c.type === "raw_string_literal");
      if (strNode) {
        const s = getRustStringLiteral(strNode);
        if (s !== null) return { node, prefix: s };
      }
    }
    if (fnNode && fnNode.type === "field_expression") {
      const field = fnNode.child(2);
      if (field && (field.text === "nest" || field.text === "scope" || field.text === "resource")) {
        const args = node.children.find((c) => c.type === "arguments");
        const strNode = args?.children.find((c) => c.type === "string_literal" || c.type === "raw_string_literal");
        if (strNode) {
          const s = getRustStringLiteral(strNode);
          if (s !== null) return { node, prefix: s };
        }
      }
    }
  }
  return null;
}

function getEnclosingRustScopes(node: Parser.SyntaxNode): string[] {
  const seenNodes = new Set<number>();
  const scopes: string[] = [];

  // 1. Walk receiver call chain of node itself, starting from immediate receiver
  let rec: Parser.SyntaxNode | null = null;
  const fn0 = node.child(0);
  if (fn0 && fn0.type === "field_expression") {
    rec = fn0.child(0);
  }

  while (rec && rec.type === "call_expression") {
    const sc = getScopeCall(rec);
    if (sc && !seenNodes.has(sc.node.id)) {
      seenNodes.add(sc.node.id);
      scopes.unshift(sc.prefix);
    }
    const fn = rec.child(0);
    if (fn && fn.type === "field_expression") {
      rec = fn.child(0);
    } else {
      break;
    }
  }

  // 2. Walk enclosing parent call expressions (e.g. .service(scope(...)), .nest(...))
  let curr: Parser.SyntaxNode | null = node.parent;
  while (curr) {
    if (curr.type === "call_expression") {
      const fn = curr.child(0);
      if (fn && fn.type === "field_expression") {
        const field = fn.child(2);
        if (field && (field.text === "service" || field.text === "nest")) {
          let receiver = fn.child(0);
          while (receiver && receiver.type === "call_expression") {
            const sc = getScopeCall(receiver);
            if (sc !== null) {
              if (!seenNodes.has(sc.node.id)) {
                seenNodes.add(sc.node.id);
                scopes.unshift(sc.prefix);
              }
              break;
            }
            const recFn = receiver.child(0);
            if (recFn && recFn.type === "field_expression") {
              receiver = recFn.child(0);
            } else {
              break;
            }
          }
        }
      }
    }
    curr = curr.parent;
  }
  return scopes;
}

function extractRustRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  const routes: OmniRoute[] = [];

  function walk(node: Parser.SyntaxNode) {
    // 1. Actix / Rocket attributes: #[get("/path")], #[actix_web::get("/path")]
    if (node.type === "attribute_item") {
      const attr = node.children.find((c) => c.type === "attribute");
      if (attr) {
        const idNode = attr.child(0);
        const name = idNode ? idNode.text.split("::").pop()?.toLowerCase() : null;
        if (name && RUST_HTTP_METHODS.has(name)) {
          const verb = name.toUpperCase() as Method;
          function findString(n: Parser.SyntaxNode): string | null {
            if (n.type === "string_literal" || n.type === "raw_string_literal") {
              return getRustStringLiteral(n);
            }
            for (let i = 0; i < n.childCount; i++) {
              const res = findString(n.child(i)!);
              if (res) return res;
            }
            return null;
          }
          const p = findString(attr);
          if (p !== null) {
            let fullP = p.startsWith("/") ? p : "/" + p;
            if (fullP.length > 1 && fullP.endsWith("/")) fullP = fullP.slice(0, -1);
            routes.push({
              id: stableId(filePath, verb, fullP),
              framework: "actix",
              method: verb,
              path: fullP,
              file: filePath,
              confidence: "high",
              source: "tree_sitter",
            });
          }
        }
      }
    }

    // 2. Axum & Actix calls
    if (node.type === "call_expression") {
      const fnNode = node.child(0);

      // Case: .route("/path", ...) or .route("", ...) or .route(get(...)) inside resource/scope
      if (fnNode && fnNode.type === "field_expression") {
        const field = fnNode.child(2);
        if (field && field.text === "route") {
          const args = node.children.find((c) => c.type === "arguments");
          const pathNode = args?.children.find((c) => c.type === "string_literal" || c.type === "raw_string_literal");
          const scopes = getEnclosingRustScopes(node);
          const pStr = pathNode ? getRustStringLiteral(pathNode) : "";
          if (pStr !== null && (pStr !== "" || scopes.length > 0)) {
            let fullP = "/" + [...scopes, pStr].filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\//, "");
            if (!fullP.startsWith("/")) fullP = "/" + fullP;
            if (fullP.length > 1 && fullP.endsWith("/")) fullP = fullP.slice(0, -1);

            const methods: Method[] = [];
            function findVerbs(n: Parser.SyntaxNode) {
              if ((n.type === "identifier" || n.type === "field_identifier") && RUST_HTTP_METHODS.has(n.text.toLowerCase())) {
                methods.push(n.text.toUpperCase() as Method);
              }
              for (let i = 0; i < n.childCount; i++) {
                findVerbs(n.child(i)!);
              }
            }
            if (args) {
              for (let i = 0; i < args.childCount; i++) {
                const a = args.child(i)!;
                if (a !== pathNode && a.type !== "(" && a.type !== ")" && a.type !== ",") {
                  findVerbs(a);
                }
              }
            }
            const verbs = methods.length > 0 ? Array.from(new Set(methods)) : ["GET" as Method];
            for (const v of verbs) {
              routes.push({
                id: stableId(filePath, v, fullP),
                framework: scopes.some((s) => s.includes("api") || s.includes("v")) ? "actix" : "axum",
                method: v,
                path: fullP,
                file: filePath,
                confidence: "high",
                source: "tree_sitter",
              });
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
  return routes;
}

// -------------------------------------------------------------
// 8. Ruby (Ruby on Rails, Sinatra, Grape)
// -------------------------------------------------------------
function getRubyStringOrSymbol(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "simple_symbol") {
    return node.text.startsWith(":") ? node.text.slice(1) : node.text;
  }
  if (node.type === "string") {
    const raw = node.text;
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }
    return raw;
  }
  if (node.type === "string_content") return node.text;
  for (let i = 0; i < node.childCount; i++) {
    const res = getRubyStringOrSymbol(node.child(i)!);
    if (res) return res;
  }
  return null;
}

const RUBY_HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

function extractRubyActionsFromNode(node: Parser.SyntaxNode): Set<string> {
  const actions = new Set<string>();
  const matches = node.text.match(/[a-zA-Z_]+/g);
  if (matches) {
    for (const m of matches) {
      if (m !== "i" && m !== "w" && m !== "only" && m !== "except") {
        actions.add(m);
      }
    }
  }
  return actions;
}

function isRubyRouteFile(tree: Parser.Tree, filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  if (norm.endsWith("routes.rb") || norm.includes("/routes/") || norm.includes("/config/routes")) {
    return true;
  }
  let isRoute = false;
  function check(n: Parser.SyntaxNode) {
    if (isRoute) return;
    if (n.type === "class") {
      const superclass = n.children.find((c) => c.type === "superclass");
      if (superclass && (superclass.text.includes("Sinatra") || superclass.text.includes("Grape"))) {
        isRoute = true;
        return;
      }
    }
    if (n.type === "call" || n.type === "command_call") {
      if (n.text.includes("routes.draw")) {
        isRoute = true;
        return;
      }
    }
    if ((n.type === "call" || n.type === "command") && n.child(0)?.text === "require") {
      if (n.text.includes("sinatra")) {
        isRoute = true;
        return;
      }
    }
    for (let i = 0; i < n.childCount; i++) {
      check(n.child(i)!);
    }
  }
  check(tree.rootNode);
  return isRoute;
}

function extractRubyRoutes(tree: Parser.Tree, filePath: string): OmniRoute[] {
  if (!isRubyRouteFile(tree, filePath)) return [];

  const routes: OmniRoute[] = [];

  interface Context {
    prefix: string;
    parentResource?: {
      name: string;
      param: string;
    };
  }

  function cleanRubyPath(prefix: string, p: string): string {
    let combined = "/" + [prefix, p].filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\//, "");
    if (!combined.startsWith("/")) combined = "/" + combined;
    if (combined.length > 1 && combined.endsWith("/")) combined = combined.slice(0, -1);
    return combined;
  }

  function parseBlock(blockNode: Parser.SyntaxNode, ctx: Context) {
    for (let i = 0; i < blockNode.childCount; i++) {
      walkNode(blockNode.child(i)!, ctx);
    }
  }

  function walkNode(node: Parser.SyntaxNode, ctx: Context) {
    if (node.type === "call" || node.type === "command" || node.type === "command_call") {
      let methodName = "";
      let argsNode: Parser.SyntaxNode | undefined;

      if (node.child(1)?.text === "." && node.child(2)) {
        methodName = node.child(2)!.text;
        argsNode = node.children.find((c) => c.type === "argument_list");
      } else {
        methodName = node.child(0)?.text || "";
        argsNode = node.children.find((c) => c.type === "argument_list");
      }

      const blockNode = node.children.find((c) => c.type === "do_block" || c.type === "block");

      // A: scope / namespace
      if (methodName === "scope" || methodName === "namespace") {
        let seg = "";
        if (argsNode && argsNode.childCount > 0) {
          const firstArg = argsNode.children.find((c) => c.type === "simple_symbol" || c.type === "string");
          if (firstArg) {
            seg = getRubyStringOrSymbol(firstArg) || "";
          }
        }
        const newPrefix = cleanRubyPath(ctx.prefix, seg);
        if (blockNode) {
          parseBlock(blockNode, { ...ctx, prefix: newPrefix });
        }
        return;
      }

      // B: resources (plural)
      if (methodName === "resources") {
        let resName = "";
        let param = ":id";
        let onlyActions: Set<string> | null = null;
        let exceptActions: Set<string> | null = null;
        let pathOverride: string | null = null;

        if (argsNode) {
          const firstArg = argsNode.children.find((c) => c.type === "simple_symbol" || c.type === "string");
          if (firstArg) {
            resName = getRubyStringOrSymbol(firstArg) || "";
          }

          for (let i = 0; i < argsNode.childCount; i++) {
            const child = argsNode.child(i)!;
            if (child.type === "pair") {
              const k = child.child(0)?.text.replace(/:$/, "");
              const val = child.child(child.childCount - 1);
              if (k === "param" && val) {
                const s = getRubyStringOrSymbol(val);
                if (s) param = s.startsWith(":") ? s : ":" + s;
              } else if (k === "path" && val) {
                const s = getRubyStringOrSymbol(val);
                if (s) pathOverride = s;
              } else if (k === "only" && val) {
                onlyActions = extractRubyActionsFromNode(val);
              } else if (k === "except" && val) {
                exceptActions = extractRubyActionsFromNode(val);
              }
            }
          }
        }

        if (pathOverride) resName = pathOverride;

        if (resName) {
          let basePath = "";
          if (ctx.parentResource) {
            basePath = cleanRubyPath(ctx.prefix, `${ctx.parentResource.name}/${ctx.parentResource.param}/${resName}`);
          } else {
            basePath = cleanRubyPath(ctx.prefix, resName);
          }

          const defaultActions: { act: string; method: Method; getP: (base: string, p: string) => string }[] = [
            { act: "index", method: "GET", getP: (b) => b },
            { act: "create", method: "POST", getP: (b) => b },
            { act: "show", method: "GET", getP: (b, p) => cleanRubyPath(b, p) },
            { act: "update", method: "PUT", getP: (b, p) => cleanRubyPath(b, p) },
            { act: "destroy", method: "DELETE", getP: (b, p) => cleanRubyPath(b, p) },
          ];

          for (const item of defaultActions) {
            if (onlyActions && !onlyActions.has(item.act)) continue;
            if (exceptActions && exceptActions.has(item.act)) continue;

            const rPath = item.getP(basePath, param);
            routes.push({
              id: stableId(filePath, item.method, rPath),
              framework: "rails",
              method: item.method,
              path: rPath,
              file: filePath,
              confidence: "high",
              source: "tree_sitter",
            });
          }

          if (blockNode) {
            parseBlock(blockNode, {
              prefix: ctx.prefix,
              parentResource: { name: resName, param },
            });
          }
        }
        return;
      }

      // C: resource (singular)
      if (methodName === "resource") {
        let resName = "";
        let onlyActions: Set<string> | null = null;
        let exceptActions: Set<string> | null = null;
        let pathOverride: string | null = null;

        if (argsNode) {
          const firstArg = argsNode.children.find((c) => c.type === "simple_symbol" || c.type === "string");
          if (firstArg) {
            resName = getRubyStringOrSymbol(firstArg) || "";
          }

          for (let i = 0; i < argsNode.childCount; i++) {
            const child = argsNode.child(i)!;
            if (child.type === "pair") {
              const k = child.child(0)?.text.replace(/:$/, "");
              const val = child.child(child.childCount - 1);
              if (k === "path" && val) {
                const s = getRubyStringOrSymbol(val);
                if (s) pathOverride = s;
              } else if (k === "only" && val) {
                onlyActions = extractRubyActionsFromNode(val);
              } else if (k === "except" && val) {
                exceptActions = extractRubyActionsFromNode(val);
              }
            }
          }
        }

        if (pathOverride) resName = pathOverride;

        if (resName) {
          let basePath = "";
          if (ctx.parentResource) {
            basePath = cleanRubyPath(ctx.prefix, `${ctx.parentResource.name}/${ctx.parentResource.param}/${resName}`);
          } else {
            basePath = cleanRubyPath(ctx.prefix, resName);
          }

          const defaultSingular: { act: string; method: Method }[] = [
            { act: "show", method: "GET" },
            { act: "create", method: "POST" },
            { act: "update", method: "PUT" },
            { act: "destroy", method: "DELETE" },
          ];

          for (const item of defaultSingular) {
            if (onlyActions && !onlyActions.has(item.act)) continue;
            if (exceptActions && exceptActions.has(item.act)) continue;

            routes.push({
              id: stableId(filePath, item.method, basePath),
              framework: "rails",
              method: item.method,
              path: basePath,
              file: filePath,
              confidence: "high",
              source: "tree_sitter",
            });
          }

          if (blockNode) {
            parseBlock(blockNode, {
              prefix: basePath,
            });
          }
        }
        return;
      }

      // D: devise_for :users
      if (methodName === "devise_for") {
        let resName = "users";
        let signInName = "login";
        if (argsNode) {
          const firstArg = argsNode.children.find((c) => c.type === "simple_symbol" || c.type === "string");
          if (firstArg) {
            const s = getRubyStringOrSymbol(firstArg);
            if (s) resName = s;
          }
          for (let i = 0; i < argsNode.childCount; i++) {
            const child = argsNode.child(i)!;
            if (child.type === "pair" && child.child(0)?.text.includes("path_names")) {
              const hashNode = child.child(child.childCount - 1);
              if (hashNode) {
                for (let j = 0; j < hashNode.childCount; j++) {
                  const hChild = hashNode.child(j)!;
                  if (hChild.type === "pair" && hChild.child(0)?.text.includes("sign_in")) {
                    const mapped = getRubyStringOrSymbol(hChild.child(hChild.childCount - 1));
                    if (mapped) signInName = mapped;
                  }
                }
              }
            }
          }
        }
        const userBase = cleanRubyPath(ctx.prefix, resName);
        const loginPath = cleanRubyPath(userBase, signInName);
        routes.push({
          id: stableId(filePath, "POST", loginPath),
          framework: "rails",
          method: "POST",
          path: loginPath,
          file: filePath,
          confidence: "high",
          source: "tree_sitter",
        });
        routes.push({
          id: stableId(filePath, "POST", userBase),
          framework: "rails",
          method: "POST",
          path: userBase,
          file: filePath,
          confidence: "high",
          source: "tree_sitter",
        });
        return;
      }

      // E: Direct HTTP methods: get, post, put, delete, patch, match
      if (methodName && (RUBY_HTTP_METHODS.has(methodName.toLowerCase()) || methodName === "match")) {
        // Discard method calls on arbitrary objects (e.g. hash.delete, headers.delete, client.post, str.match)
        if (node.child(1)?.text === ".") {
          const rec = node.child(0)?.text;
          if (rec !== "routes" && rec !== "api" && rec !== "self") {
            return;
          }
        }
        let p = "";
        let onType: string | null = null;
        let matchMethods: Method[] = [];

        if (argsNode) {
          const firstArg = argsNode.children.find(
            (c) => c.type === "simple_symbol" || c.type === "string" || c.type === "pair"
          );
          if (firstArg) {
            if (!ctx.parentResource && firstArg.type === "simple_symbol") {
              return;
            }
            if (firstArg.type === "pair") {
              p = getRubyStringOrSymbol(firstArg.child(0)) || "";
            } else {
              p = getRubyStringOrSymbol(firstArg) || "";
            }
          }

          for (let i = 0; i < argsNode.childCount; i++) {
            const child = argsNode.child(i)!;
            if (child.type === "pair") {
              const k = child.child(0)?.text.replace(/:$/, "");
              const val = child.child(child.childCount - 1);
              if (k === "on" && val) {
                const s = getRubyStringOrSymbol(val);
                if (s) onType = s;
              } else if (k === "via" && val) {
                const acts = extractRubyActionsFromNode(val);
                for (const a of acts) matchMethods.push(a.toUpperCase() as Method);
              }
            }
          }
        }

        let fullPath = "";
        if (ctx.parentResource) {
          if (onType === "collection") {
            fullPath = cleanRubyPath(ctx.prefix, `${ctx.parentResource.name}/${p}`);
          } else {
            fullPath = cleanRubyPath(ctx.prefix, `${ctx.parentResource.name}/${ctx.parentResource.param}/${p}`);
          }
        } else {
          fullPath = cleanRubyPath(ctx.prefix, p);
        }

        const verbs: Method[] = methodName === "match"
          ? (matchMethods.length > 0 ? matchMethods : ["GET"])
          : [methodName.toUpperCase() as Method];

        for (const v of verbs) {
          routes.push({
            id: stableId(filePath, v, fullPath),
            framework: "rails",
            method: v,
            path: fullPath,
            file: filePath,
            confidence: "high",
            source: "tree_sitter",
          });
        }
        return;
      }

      // F: root
      if (methodName === "root") {
        const rootPath = cleanRubyPath(ctx.prefix, "/");
        routes.push({
          id: stableId(filePath, "GET", rootPath),
          framework: "rails",
          method: "GET",
          path: rootPath,
          file: filePath,
          confidence: "high",
          source: "tree_sitter",
        });
        return;
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      walkNode(node.child(i)!, ctx);
    }
  }

  walkNode(tree.rootNode, { prefix: "" });
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
    case "rust":
      return extractRustRoutes(tree, candidate.filePath);
    case "ruby":
      return extractRubyRoutes(tree, candidate.filePath);
    default:
      return [];
  }
}
