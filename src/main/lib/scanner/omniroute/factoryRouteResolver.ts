import path from "node:path";
import type Parser from "web-tree-sitter";
import type { Method } from "../../../types";
import type { OmniRoute, OmniFramework, FileCandidate } from "./types";
import { joinUrl } from "./mountLinker";
import { getLanguageParser } from "./treeSitterEngine";

export type FactoryPattern = "producer_return" | "consumer_receiver";

export interface RouterTemplate {
  id: string;
  name: string;
  filePath: string;
  framework: OmniFramework;
  pattern: FactoryPattern;
  receiverParamName?: string;
  relativeRoutes: Array<{
    method: Method;
    relativePath: string;
  }>;
}

export interface FactoryCallSite {
  factoryIdentifier: string;
  callFilePath: string;
  mountPrefix: string;
  framework: OmniFramework;
}

export interface IFactoryLanguageAdapter {
  discoverTemplates(tree: Parser.Tree, filePath: string, code: string): RouterTemplate[];
  discoverCallSites(tree: Parser.Tree, filePath: string, code: string): FactoryCallSite[];
}

function stableId(file: string, method: string, routePath: string): string {
  const raw = `${file}|${method}|${routePath}`;
  return `omni_factory_${Buffer.from(raw).toString("base64url")}`;
}

export function getCleanStringLiteral(node: Parser.SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  const t = node.text.trim();
  if (
    node.type === "string" ||
    node.type === "string_literal" ||
    node.type === "interpreted_string_literal" ||
    node.type === "raw_string_literal" ||
    node.type === "template_string"
  ) {
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'")) ||
      (t.startsWith("`") && t.endsWith("`"))
    ) {
      return t.slice(1, -1);
    }
    return t;
  }
  return null;
}

function walkTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => boolean | void): void {
  const stop = callback(node);
  if (stop === true) return;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) walkTree(child, callback);
  }
}

// ============================================================================
// 1. TypeScript & JavaScript Adapter (Express, Fastify, Hono)
// ============================================================================
export class TsJsFactoryAdapter implements IFactoryLanguageAdapter {
  private validMethods = new Set(["get", "post", "put", "delete", "patch", "options", "head"]);

  discoverTemplates(tree: Parser.Tree, filePath: string, code: string): RouterTemplate[] {
    const templates: RouterTemplate[] = [];

    walkTree(tree.rootNode, (node) => {
      let fnName: string | null = null;
      let fnBody: Parser.SyntaxNode | null = null;
      let paramsNode: Parser.SyntaxNode | null = null;

      // 1. function declaration: function createCrudRouter(...) { ... }
      if (node.type === "function_declaration") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) fnName = nameNode.text;
        fnBody = node.childForFieldName("body");
        paramsNode = node.childForFieldName("parameters");
      }
      // 2. variable declaration: const createCrudRouter = (...) => { ... }
      else if (node.type === "variable_declarator") {
        const nameNode = node.childForFieldName("name");
        const valNode = node.childForFieldName("value");
        if (
          nameNode &&
          valNode &&
          (valNode.type === "arrow_function" || valNode.type === "function_expression")
        ) {
          fnName = nameNode.text;
          fnBody = valNode.childForFieldName("body");
          paramsNode = valNode.childForFieldName("parameters");
        }
      }

      if (!fnName || !fnBody) return;

      // Framework detection
      let framework: OmniFramework = "express";
      if (code.includes("hono") || code.includes("Hono")) framework = "hono";
      else if (code.includes("fastify") || code.includes("fastify-plugin")) framework = "fastify";

      // Pattern A: Producer (Creates and returns router)
      let returnedRouterVar: string | null = null;

      // Find router instantiation inside function: const router = Router() or new Hono()
      walkTree(fnBody, (child) => {
        if (child.type === "variable_declarator") {
          const varName = child.childForFieldName("name")?.text;
          const varVal = child.childForFieldName("value");
          if (varName && varVal) {
            const valText = varVal.text;
            if (
              valText.includes("Router(") ||
              valText.includes("express.Router(") ||
              valText.includes("new Hono(") ||
              valText.includes("new Router(")
            ) {
              // Verify return statement returns this variable
              walkTree(fnBody!, (retChild) => {
                if (retChild.type === "return_statement") {
                  for (let c = 0; c < retChild.childCount; c++) {
                    const retArg = retChild.child(c);
                    if (retArg && retArg.type === "identifier" && retArg.text === varName) {
                      returnedRouterVar = varName;
                    }
                  }
                }
              });
            }
          }
        }
      });

      if (returnedRouterVar) {
        const relativeRoutes: Array<{ method: Method; relativePath: string }> = [];

        walkTree(fnBody, (callChild) => {
          if (callChild.type === "call_expression") {
            const fnNode = callChild.childForFieldName("function");
            if (fnNode && fnNode.type === "member_expression") {
              const obj = fnNode.childForFieldName("object")?.text;
              const prop = fnNode.childForFieldName("property")?.text.toLowerCase();

              if (obj === returnedRouterVar && prop && this.validMethods.has(prop)) {
                const args = callChild.childForFieldName("arguments");
                if (args && args.namedChildCount >= 1) {
                  const pathStr = getCleanStringLiteral(args.namedChild(0));
                  if (pathStr && pathStr.startsWith("/")) {
                    relativeRoutes.push({
                      method: prop.toUpperCase() as Method,
                      relativePath: pathStr,
                    });
                  }
                }
              }
            }
          }
        });

        if (relativeRoutes.length > 0) {
          templates.push({
            id: `${filePath}#${fnName}`,
            name: fnName,
            filePath,
            framework,
            pattern: "producer_return",
            relativeRoutes,
          });
          return;
        }
      }

      // Pattern B: Consumer / Receiver (Fastify plugin style: function myPlugin(fastify, opts, done))
      if (paramsNode && paramsNode.namedChildCount >= 1) {
        const p0 = paramsNode.namedChild(0)?.text;
        if (p0 && (p0.includes("fastify") || p0.includes("instance") || p0.includes("server") || p0 === "app")) {
          const relativeRoutes: Array<{ method: Method; relativePath: string }> = [];

          walkTree(fnBody, (callChild) => {
            if (callChild.type === "call_expression") {
              const fnNode = callChild.childForFieldName("function");
              if (fnNode && fnNode.type === "member_expression") {
                const obj = fnNode.childForFieldName("object")?.text;
                const prop = fnNode.childForFieldName("property")?.text.toLowerCase();

                if (obj === p0 && prop && this.validMethods.has(prop)) {
                  const args = callChild.childForFieldName("arguments");
                  if (args && args.namedChildCount >= 1) {
                    const pathStr = getCleanStringLiteral(args.namedChild(0));
                    if (pathStr && pathStr.startsWith("/")) {
                      relativeRoutes.push({
                        method: prop.toUpperCase() as Method,
                        relativePath: pathStr,
                      });
                    }
                  }
                }
              }
            }
          });

          if (relativeRoutes.length > 0) {
            templates.push({
              id: `${filePath}#${fnName}`,
              name: fnName,
              filePath,
              framework: "fastify",
              pattern: "consumer_receiver",
              receiverParamName: p0,
              relativeRoutes,
            });
          }
        }
      }
    });

    return templates;
  }

  discoverCallSites(tree: Parser.Tree, filePath: string, code: string): FactoryCallSite[] {
    const callSites: FactoryCallSite[] = [];

    walkTree(tree.rootNode, (node) => {
      if (node.type === "call_expression") {
        const fn = node.childForFieldName("function");
        if (fn && fn.type === "member_expression") {
          const prop = fn.childForFieldName("property")?.text.toLowerCase();
          const args = node.childForFieldName("arguments");

          // 1. Direct mount: app.use('/prefix', makeRouter(...)) or app.route('/prefix', makeHono(...))
          if ((prop === "use" || prop === "route") && args && args.namedChildCount >= 2) {
            const pArg = args.namedChild(0);
            const targetArg = args.namedChild(1);
            const prefixVal = getCleanStringLiteral(pArg);

            if (prefixVal && prefixVal.startsWith("/") && targetArg) {
              // Direct factory call invocation: app.use('/users', makeCrudRouter())
              if (targetArg.type === "call_expression") {
                const callee = targetArg.childForFieldName("function") || targetArg.child(0);
                if (callee && callee.type === "identifier") {
                  callSites.push({
                    factoryIdentifier: callee.text,
                    callFilePath: filePath,
                    mountPrefix: prefixVal,
                    framework: prop === "route" ? "hono" : "express",
                  });
                }
              }
            }
          }

          // 2. Fastify register: fastify.register(myPlugin, { prefix: '/prefix' })
          if (prop === "register" && args && args.namedChildCount >= 1) {
            const pluginArg = args.namedChild(0);
            let pluginIdentifier: string | null = null;

            if (pluginArg?.type === "identifier") {
              pluginIdentifier = pluginArg.text;
            } else if (pluginArg?.type === "call_expression") {
              const callee = pluginArg.childForFieldName("function") || pluginArg.child(0);
              if (callee?.type === "identifier") pluginIdentifier = callee.text;
            }

            // Find prefix in options argument: { prefix: '/users' }
            let foundPrefix: string | null = null;
            for (let i = 1; i < args.namedChildCount; i++) {
              const opt = args.namedChild(i)!;
              if (opt.type === "object") {
                for (let p = 0; p < opt.childCount; p++) {
                  const pair = opt.child(p)!;
                  if (pair.type === "pair") {
                    const k = pair.childForFieldName("key")?.text.replace(/['"`]/g, "");
                    const v = getCleanStringLiteral(pair.childForFieldName("value"));
                    if (k === "prefix" && v && v.startsWith("/")) {
                      foundPrefix = v;
                      break;
                    }
                  }
                }
              }
            }

            if (pluginIdentifier && foundPrefix) {
              callSites.push({
                factoryIdentifier: pluginIdentifier,
                callFilePath: filePath,
                mountPrefix: foundPrefix,
                framework: "fastify",
              });
            }
          }
        }
      }
    });

    return callSites;
  }
}

// ============================================================================
// 2. Python Adapter (FastAPI APIRouter, Flask Blueprint)
// ============================================================================
export class PythonFactoryAdapter implements IFactoryLanguageAdapter {
  private validMethods = new Set(["get", "post", "put", "delete", "patch", "options", "head"]);

  discoverTemplates(tree: Parser.Tree, filePath: string, code: string): RouterTemplate[] {
    const templates: RouterTemplate[] = [];

    walkTree(tree.rootNode, (node) => {
      if (node.type === "function_definition") {
        const nameNode = node.childForFieldName("name");
        const bodyNode = node.childForFieldName("body");
        if (!nameNode || !bodyNode) return;
        const fnName = nameNode.text;

        let returnedRouterVar: string | null = null;
        let framework: OmniFramework = "fastapi";
        if (code.includes("Blueprint") || code.includes("flask")) framework = "flask";

        // Find router instantiation: router = APIRouter() or bp = Blueprint(...)
        walkTree(bodyNode, (child) => {
          if (child.type === "assignment") {
            const left = child.childForFieldName("left")?.text;
            const right = child.childForFieldName("right");
            if (left && right && right.type === "call") {
              const callFn = right.childForFieldName("function")?.text;
              if (callFn && (callFn.includes("APIRouter") || callFn.includes("Blueprint"))) {
                // Verify returned
                walkTree(bodyNode, (retChild) => {
                  if (retChild.type === "return_statement") {
                    for (let c = 0; c < retChild.childCount; c++) {
                      const retArg = retChild.child(c);
                      if (retArg && retArg.text === left) {
                        returnedRouterVar = left;
                      }
                    }
                  }
                });
              }
            }
          }
        });

        if (returnedRouterVar) {
          const relativeRoutes: Array<{ method: Method; relativePath: string }> = [];

          walkTree(bodyNode, (child) => {
            if (child.type === "decorated_definition") {
              for (let i = 0; i < child.childCount; i++) {
                const dec = child.child(i)!;
                if (dec.type === "decorator") {
                  const call = dec.child(1);
                  if (call && call.type === "call") {
                    const fn = call.childForFieldName("function");
                    if (fn && fn.type === "attribute") {
                      const obj = fn.childForFieldName("object")?.text;
                      const attr = fn.childForFieldName("attribute")?.text.toLowerCase();

                      if (obj === returnedRouterVar && attr && this.validMethods.has(attr)) {
                        const args = call.childForFieldName("arguments");
                        if (args && args.namedChildCount >= 1) {
                          const pStr = getCleanStringLiteral(args.namedChild(0));
                          if (pStr && pStr.startsWith("/")) {
                            relativeRoutes.push({
                              method: attr.toUpperCase() as Method,
                              relativePath: pStr,
                            });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          });

          if (relativeRoutes.length > 0) {
            templates.push({
              id: `${filePath}#${fnName}`,
              name: fnName,
              filePath,
              framework,
              pattern: "producer_return",
              relativeRoutes,
            });
          }
        }
      }
    });

    return templates;
  }

  discoverCallSites(tree: Parser.Tree, filePath: string, code: string): FactoryCallSite[] {
    const callSites: FactoryCallSite[] = [];

    walkTree(tree.rootNode, (node) => {
      if (node.type === "call") {
        const fn = node.childForFieldName("function");
        if (fn && fn.type === "attribute") {
          const attr = fn.childForFieldName("attribute")?.text;
          const args = node.childForFieldName("arguments");

          // app.include_router(make_router(), prefix="/users") or app.register_blueprint(make_bp(), url_prefix="/users")
          if ((attr === "include_router" || attr === "register_blueprint") && args && args.namedChildCount >= 1) {
            const firstArg = args.namedChild(0)!;
            let factoryIdentifier: string | null = null;

            if (firstArg.type === "call") {
              const innerFn = firstArg.childForFieldName("function") || firstArg.child(0);
              if (innerFn && innerFn.type === "identifier") {
                factoryIdentifier = innerFn.text;
              }
            }

            let foundPrefix: string | null = null;
            for (let i = 0; i < args.namedChildCount; i++) {
              const arg = args.namedChild(i)!;
              if (arg.type === "keyword_argument") {
                const k = arg.childForFieldName("name")?.text;
                const v = getCleanStringLiteral(arg.childForFieldName("value"));
                if ((k === "prefix" || k === "url_prefix") && v && v.startsWith("/")) {
                  foundPrefix = v;
                  break;
                }
              }
            }

            if (factoryIdentifier && foundPrefix) {
              callSites.push({
                factoryIdentifier,
                callFilePath: filePath,
                mountPrefix: foundPrefix,
                framework: attr === "include_router" ? "fastapi" : "flask",
              });
            }
          }
        }
      }
    });

    return callSites;
  }
}

// ============================================================================
// 3. Go Adapter (Chi, Gin, Fiber, net/http)
// ============================================================================
export class GoFactoryAdapter implements IFactoryLanguageAdapter {
  private validMethods = new Set(["get", "post", "put", "delete", "patch", "options", "head"]);

  discoverTemplates(tree: Parser.Tree, filePath: string, code: string): RouterTemplate[] {
    const templates: RouterTemplate[] = [];

    walkTree(tree.rootNode, (node) => {
      if (node.type === "function_declaration") {
        const nameNode = node.childForFieldName("name");
        const bodyNode = node.childForFieldName("body");
        const resultNode = node.childForFieldName("result");
        const paramsNode = node.childForFieldName("parameters");
        if (!nameNode || !bodyNode) return;
        const fnName = nameNode.text;

        // Pattern A: Producer (returns http.Handler, *chi.Mux)
        const resultText = resultNode?.text || "";
        if (resultText.includes("http.Handler") || resultText.includes("chi.Router") || resultText.includes("Mux")) {
          const relativeRoutes: Array<{ method: Method; relativePath: string }> = [];

          walkTree(bodyNode, (call) => {
            if (call.type === "call_expression") {
              const fn = call.childForFieldName("function");
              if (fn && fn.type === "selector_expression") {
                const field = fn.childForFieldName("field")?.text.toLowerCase();
                if (field && this.validMethods.has(field)) {
                  const args = call.childForFieldName("arguments");
                  if (args && args.namedChildCount >= 1) {
                    const pStr = getCleanStringLiteral(args.namedChild(0));
                    if (pStr && pStr.startsWith("/")) {
                      relativeRoutes.push({
                        method: field.toUpperCase() as Method,
                        relativePath: pStr,
                      });
                    }
                  }
                }
              }
            }
          });

          if (relativeRoutes.length > 0) {
            templates.push({
              id: `${filePath}#${fnName}`,
              name: fnName,
              filePath,
              framework: "chi",
              pattern: "producer_return",
              relativeRoutes,
            });
            return;
          }
        }

        // Pattern B: Receiver / Configurator (func RegisterRoutes(rg *gin.RouterGroup))
        if (paramsNode && paramsNode.childCount > 0) {
          let receiverVar: string | null = null;
          let framework: OmniFramework = "gin";

          walkTree(paramsNode, (param) => {
            if (param.type === "parameter_declaration") {
              const typeNode = param.childForFieldName("type")?.text || "";
              const pName = param.childForFieldName("name")?.text;
              if (typeNode.includes("RouterGroup")) {
                receiverVar = pName || "rg";
                framework = "gin";
              } else if (typeNode.includes("fiber.Router")) {
                receiverVar = pName || "router";
                framework = "fiber";
              }
            }
          });

          if (receiverVar) {
            const relativeRoutes: Array<{ method: Method; relativePath: string }> = [];

            walkTree(bodyNode, (call) => {
              if (call.type === "call_expression") {
                const fn = call.childForFieldName("function");
                if (fn && fn.type === "selector_expression") {
                  const operand = fn.childForFieldName("operand")?.text;
                  const field = fn.childForFieldName("field")?.text.toLowerCase();

                  if (operand === receiverVar && field && this.validMethods.has(field)) {
                    const args = call.childForFieldName("arguments");
                    if (args && args.namedChildCount >= 1) {
                      const pStr = getCleanStringLiteral(args.namedChild(0));
                      if (pStr && pStr.startsWith("/")) {
                        relativeRoutes.push({
                          method: field.toUpperCase() as Method,
                          relativePath: pStr,
                        });
                      }
                    }
                  }
                }
              }
            });

            if (relativeRoutes.length > 0) {
              templates.push({
                id: `${filePath}#${fnName}`,
                name: fnName,
                filePath,
                framework,
                pattern: "consumer_receiver",
                receiverParamName: receiverVar,
                relativeRoutes,
              });
            }
          }
        }
      }
    });

    return templates;
  }

  discoverCallSites(tree: Parser.Tree, filePath: string, code: string): FactoryCallSite[] {
    const callSites: FactoryCallSite[] = [];

    walkTree(tree.rootNode, (node) => {
      // 1. r.Mount("/prefix", NewHandler(...))
      if (node.type === "call_expression") {
        const fn = node.childForFieldName("function");
        if (fn && fn.type === "selector_expression") {
          const field = fn.childForFieldName("field")?.text;
          const args = node.childForFieldName("arguments");

          if (field === "Mount" && args && args.namedChildCount >= 2) {
            const pArg = getCleanStringLiteral(args.namedChild(0));
            const hArg = args.namedChild(1)!;

            if (pArg && pArg.startsWith("/")) {
              let factoryIdentifier: string | null = null;
              if (hArg.type === "call_expression") {
                const innerFn = hArg.childForFieldName("function") || hArg.child(0);
                if (innerFn) factoryIdentifier = innerFn.text;
              }
              if (factoryIdentifier) {
                callSites.push({
                  factoryIdentifier,
                  callFilePath: filePath,
                  mountPrefix: pArg,
                  framework: "chi",
                });
              }
            }
          }
        }
      }
    });

    return callSites;
  }
}

// ============================================================================
// 4. C# Adapter (.NET Minimal APIs)
// ============================================================================
export class CSharpFactoryAdapter implements IFactoryLanguageAdapter {
  private validMethods = new Set(["mapget", "mappost", "mapput", "mapdelete", "mappatch"]);

  discoverTemplates(tree: Parser.Tree, filePath: string, code: string): RouterTemplate[] {
    const templates: RouterTemplate[] = [];

    walkTree(tree.rootNode, (node) => {
      if (node.type === "method_declaration") {
        let methodName: string | null = null;
        let paramList: Parser.SyntaxNode | null = null;
        let blockNode: Parser.SyntaxNode | null = null;

        for (let i = 0; i < node.childCount; i++) {
          const c = node.child(i)!;
          if (c.type === "identifier") methodName = c.text;
          if (c.type === "parameter_list") paramList = c;
          if (c.type === "block") blockNode = c;
        }

        if (methodName && paramList && blockNode) {
          let isExtension = false;
          let paramName = "group";
          for (let i = 0; i < paramList.childCount; i++) {
            const p = paramList.child(i)!;
            if (p.type === "parameter" && p.text.includes("this") && p.text.includes("RouteGroupBuilder")) {
              isExtension = true;
              for (let j = 0; j < p.childCount; j++) {
                const childJ = p.child(j)!;
                if (childJ.type === "identifier") paramName = childJ.text;
              }
            }
          }

          if (isExtension) {
            const relativeRoutes: Array<{ method: Method; relativePath: string }> = [];

            walkTree(blockNode, (call) => {
              if (call.type === "invocation_expression") {
                const expr = call.child(0);
                if (expr && expr.type === "member_access_expression") {
                  const name = expr.childForFieldName("name")?.text?.toLowerCase();
                  if (name && this.validMethods.has(name)) {
                    for (let a = 0; a < call.childCount; a++) {
                      const argsList = call.child(a)!;
                      if (argsList.type === "argument_list") {
                        for (let k = 0; k < argsList.childCount; k++) {
                          const arg = argsList.child(k)!;
                          if (arg.type === "argument") {
                            const pStr = getCleanStringLiteral(arg.child(0));
                            if (pStr && pStr.startsWith("/")) {
                              const verb = name.replace("map", "").toUpperCase() as Method;
                              relativeRoutes.push({
                                method: verb,
                                relativePath: pStr,
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            });

            if (relativeRoutes.length > 0) {
              templates.push({
                id: `${filePath}#${methodName}`,
                name: methodName,
                filePath,
                framework: "aspnet",
                pattern: "consumer_receiver",
                receiverParamName: paramName,
                relativeRoutes,
              });
            }
          }
        }
      }
    });

    return templates;
  }

  discoverCallSites(tree: Parser.Tree, filePath: string, code: string): FactoryCallSite[] {
    const callSites: FactoryCallSite[] = [];

    walkTree(tree.rootNode, (node) => {
      // app.MapGroup("/users").MapUserEndpoints()
      if (node.type === "invocation_expression") {
        const expr = node.child(0);
        if (expr && expr.type === "member_access_expression") {
          const factoryMethod = expr.childForFieldName("name")?.text;
          const receiver = expr.childForFieldName("expression");

          if (factoryMethod && receiver && receiver.type === "invocation_expression") {
            const innerExpr = receiver.child(0);
            if (innerExpr && innerExpr.type === "member_access_expression") {
              const innerMethod = innerExpr.childForFieldName("name")?.text;
              if (innerMethod === "MapGroup") {
                for (let a = 0; a < receiver.childCount; a++) {
                  const groupArgs = receiver.child(a)!;
                  if (groupArgs.type === "argument_list") {
                    for (let k = 0; k < groupArgs.childCount; k++) {
                      const arg = groupArgs.child(k)!;
                      if (arg.type === "argument") {
                        const prefix = getCleanStringLiteral(arg.child(0));
                        if (prefix && prefix.startsWith("/")) {
                          callSites.push({
                            factoryIdentifier: factoryMethod,
                            callFilePath: filePath,
                            mountPrefix: prefix,
                            framework: "aspnet",
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
    });

    return callSites;
  }
}

// ============================================================================
// 5. Rust Adapter (Axum Router::new, Actix-web configure)
// ============================================================================
export class RustFactoryAdapter implements IFactoryLanguageAdapter {
  discoverTemplates(tree: Parser.Tree, filePath: string, code: string): RouterTemplate[] {
    const templates: RouterTemplate[] = [];

    walkTree(tree.rootNode, (node) => {
      if (node.type === "function_item") {
        const nameNode = node.childForFieldName("name");
        const bodyNode = node.childForFieldName("body");
        const retType = node.childForFieldName("return_type")?.text || "";
        if (!nameNode || !bodyNode) return;
        const fnName = nameNode.text;

        // Axum Pattern A: fn user_routes() -> Router
        if (retType.includes("Router")) {
          const relativeRoutes: Array<{ method: Method; relativePath: string }> = [];

          walkTree(bodyNode, (call) => {
            if (call.type === "call_expression") {
              const fn = call.childForFieldName("function");
              if (fn && fn.type === "field_expression") {
                const field = fn.childForFieldName("field")?.text;
                if (field === "route") {
                  const args = call.childForFieldName("arguments");
                  if (args && args.namedChildCount >= 2) {
                    const pStr = getCleanStringLiteral(args.namedChild(0));
                    const methodArg = args.namedChild(1)?.text || "";
                    let mStr: Method = "GET";
                    if (methodArg.includes("post(")) mStr = "POST";
                    else if (methodArg.includes("put(")) mStr = "PUT";
                    else if (methodArg.includes("delete(")) mStr = "DELETE";
                    else if (methodArg.includes("patch(")) mStr = "PATCH";

                    if (pStr && pStr.startsWith("/")) {
                      relativeRoutes.push({
                        method: mStr,
                        relativePath: pStr,
                      });
                    }
                  }
                }
              }
            }
          });

          if (relativeRoutes.length > 0) {
            templates.push({
              id: `${filePath}#${fnName}`,
              name: fnName,
              filePath,
              framework: "axum",
              pattern: "producer_return",
              relativeRoutes,
            });
          }
        }
      }
    });

    return templates;
  }

  discoverCallSites(tree: Parser.Tree, filePath: string, code: string): FactoryCallSite[] {
    const callSites: FactoryCallSite[] = [];

    walkTree(tree.rootNode, (node) => {
      // app.nest("/users", user_routes())
      if (node.type === "call_expression") {
        const fn = node.childForFieldName("function");
        if (fn && fn.type === "field_expression") {
          const field = fn.childForFieldName("field")?.text;
          const args = node.childForFieldName("arguments");

          if (field === "nest" && args && args.namedChildCount >= 2) {
            const pStr = getCleanStringLiteral(args.namedChild(0));
            const routeArg = args.namedChild(1)!;

            if (pStr && pStr.startsWith("/")) {
              let factoryIdentifier: string | null = null;
              if (routeArg.type === "call_expression") {
                const innerFn = routeArg.childForFieldName("function") || routeArg.child(0);
                if (innerFn) factoryIdentifier = innerFn.text;
              }
              if (factoryIdentifier) {
                callSites.push({
                  factoryIdentifier,
                  callFilePath: filePath,
                  mountPrefix: pStr,
                  framework: "axum",
                });
              }
            }
          }
        }
      }
    });

    return callSites;
  }
}

// ============================================================================
// 6. Polyglot Factory Route Resolver Engine (Layer 2)
// ============================================================================
export class PolyglotFactoryRouteResolver {
  private tsJsAdapter = new TsJsFactoryAdapter();
  private pythonAdapter = new PythonFactoryAdapter();
  private goAdapter = new GoFactoryAdapter();
  private csharpAdapter = new CSharpFactoryAdapter();
  private rustAdapter = new RustFactoryAdapter();

  private getAdapterForLanguage(lang: string): IFactoryLanguageAdapter | null {
    switch (lang.toLowerCase()) {
      case "typescript":
      case "javascript":
      case "tsx":
      case "jsx":
        return this.tsJsAdapter;
      case "python":
        return this.pythonAdapter;
      case "go":
        return this.goAdapter;
      case "csharp":
      case "c_sharp":
      case "cs":
        return this.csharpAdapter;
      case "rust":
      case "rs":
        return this.rustAdapter;
      default:
        return null;
    }
  }

  async resolveAll(
    candidates: FileCandidate[],
    fileCodeMap: Map<string, string>,
    projectPath: string,
  ): Promise<OmniRoute[]> {
    const templatesByName = new Map<string, RouterTemplate[]>();
    const allCallSites: FactoryCallSite[] = [];

    // Stage 1: Collect templates across candidate files with factory definition signals
    let candidateIndex = 0;
    for (const candidate of candidates) {
      candidateIndex++;
      if (candidateIndex % 10 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      const code = fileCodeMap.get(candidate.filePath) || candidate.content;

      // Fast invariant signal check: Skip re-parsing if file has zero factory indicators
      const hasFactoryDefSignal =
        code.includes("return") &&
        (code.includes("Router") || code.includes("router") || code.includes("Hono") || code.includes("route"));

      if (!hasFactoryDefSignal) continue;

      const adapter = this.getAdapterForLanguage(candidate.language);
      if (!adapter) continue;

      const parserObj = await getLanguageParser(candidate.language);
      if (!parserObj) continue;

      let tree: Parser.Tree;
      try {
        tree = parserObj.parser.parse(code);
      } catch {
        continue;
      }

      try {
        const templates = adapter.discoverTemplates(tree, candidate.filePath, code);
        for (const t of templates) {
          const existing = templatesByName.get(t.name) || [];
          existing.push(t);
          templatesByName.set(t.name, existing);
        }
      } finally {
        try {
          tree.delete();
        } catch {}
      }
    }

    // Zero-Template Fast Path: If zero factory templates exist in the entire project,
    // no factory routes can be instantiated. Return immediately without parsing call sites.
    if (templatesByName.size === 0) {
      return [];
    }

    // Stage 2: Discover call sites only when factory templates exist
    for (const candidate of candidates) {
      const code = fileCodeMap.get(candidate.filePath) || candidate.content;
      const hasCallSiteSignal =
        code.includes(".use(") ||
        code.includes(".register(") ||
        code.includes(".mount(") ||
        code.includes(".route(");

      if (!hasCallSiteSignal) continue;

      const adapter = this.getAdapterForLanguage(candidate.language);
      if (!adapter) continue;

      const parserObj = await getLanguageParser(candidate.language);
      if (!parserObj) continue;

      let tree: Parser.Tree;
      try {
        tree = parserObj.parser.parse(code);
      } catch {
        continue;
      }

      try {
        const callSites = adapter.discoverCallSites(tree, candidate.filePath, code);
        allCallSites.push(...callSites);
      } finally {
        try {
          tree.delete();
        } catch {}
      }
    }

    // Stage 2: Match call sites to templates & synthesize concrete routes
    const synthesizedRoutes: OmniRoute[] = [];

    for (const callSite of allCallSites) {
      const matchingTemplates = templatesByName.get(callSite.factoryIdentifier);
      if (!matchingTemplates || matchingTemplates.length === 0) continue;

      // Select matching template (prefer same directory or matching export)
      let matchedTemplate = matchingTemplates[0];
      if (matchingTemplates.length > 1) {
        const callDir = path.dirname(callSite.callFilePath);
        const sameDir = matchingTemplates.find((t) => path.dirname(t.filePath) === callDir);
        if (sameDir) matchedTemplate = sameDir;
      }

      // Expand relative routes with mount prefix
      for (const rel of matchedTemplate.relativeRoutes) {
        const fullPath = joinUrl(callSite.mountPrefix, rel.relativePath);
        synthesizedRoutes.push({
          id: stableId(matchedTemplate.filePath, rel.method, fullPath),
          framework: callSite.framework || matchedTemplate.framework,
          method: rel.method,
          path: fullPath,
          file: matchedTemplate.filePath,
          confidence: "high",
          source: "tree_sitter",
        });
      }
    }

    return synthesizedRoutes;
  }
}
