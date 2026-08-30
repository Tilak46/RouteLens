import traverse from "@babel/traverse";
import { joinPaths, normalizePath } from "../core/pathUtils";
import {
  exprToString,
  isHttpMethodName,
  literalString,
  methodToUpper,
} from "../core/astUtils";
import type {
  DetectedRoute,
  FrameworkParser,
  ScannerContext,
} from "../core/types";
import type { Method } from "../../../../types";

type EntityId = string;

type FileInfo = {
  filePath: string;
  appVars: Set<string>;
  routerVars: Set<string>;
  importToFile: Map<string, string>; // local identifier -> resolved file
  exportedRouterEntities: EntityId[];
  reExports: Map<string, { filePath: string; localName: string }>; // exportedName -> { filePath, localName }
  wildcardReExports: string[]; // filePaths of other files
  routes: Array<{
    owner: EntityId;
    method: Method;
    path: string;
    handler?: string;
    handlerNode?: any;
    routeDescription?: string;
    middlewares: string[];
    middlewareNodes?: any[];
  }>;
  mounts: Array<{
    from: EntityId;
    mountPath: string; // '/api'
    to:
      | { kind: "local"; varName: string }
      | { kind: "import"; filePath: string; exportName: string }
      | { kind: "require"; filePath: string; exportName?: string };
  }>;
};

function extractJSDocDescription(node: any): string | undefined {
  if (!node || !Array.isArray(node.leadingComments)) return undefined;
  const lines = node.leadingComments
    .filter((c: any) => c.type === "CommentBlock")
    .map((c: any) => {
      return c.value
        .split("\n")
        .map((line: string) => {
          return line.replace(/^\s*\*\s?/, "").trim();
        })
        .filter((line: string) => line && !line.startsWith("@"))
        .join("\n");
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join("\n\n") : undefined;
}

function extractFieldsFromObjectPattern(pattern: any, resultSet: Set<string>) {
  if (!pattern || !Array.isArray(pattern.properties)) return;
  for (const prop of pattern.properties) {
    if (prop.type === "ObjectProperty") {
      if (prop.key.type === "Identifier") {
        resultSet.add(prop.key.name);
      } else if (prop.key.type === "StringLiteral") {
        resultSet.add(prop.key.value);
      }
      if (prop.value && prop.value.type === "ObjectPattern") {
        extractFieldsFromObjectPattern(prop.value, resultSet);
      }
    }
  }
}

async function analyzeFunctionNode(
  funcNode: any,
  currentFilePath: string,
  ctx: ScannerContext,
): Promise<{
  description: string;
  inferredBodyFields: Set<string>;
  inferredQueryFields: Set<string>;
  pathParams: Set<string>;
}> {
  const result = {
    description: extractJSDocDescription(funcNode) || "",
    inferredBodyFields: new Set<string>(),
    inferredQueryFields: new Set<string>(),
    pathParams: new Set<string>(),
  };

  if (!funcNode || !Array.isArray(funcNode.params) || funcNode.params.length === 0) {
    return result;
  }

  const reqParam = unwrapTSExpression(funcNode.params[0]);
  let bodyVarName: string | null = null;
  let queryVarName: string | null = null;
  let paramsVarName: string | null = null;
  let reqVarName: string | null = null;

  if (reqParam.type === "Identifier") {
    reqVarName = reqParam.name;
  } else if (reqParam.type === "ObjectPattern") {
    for (const prop of reqParam.properties) {
      if (prop.type !== "ObjectProperty") continue;
      if (prop.key.type !== "Identifier") continue;
      const keyName = prop.key.name;
      const val = unwrapTSExpression(prop.value);

      if (keyName === "body") {
        if (val.type === "Identifier") {
          bodyVarName = val.name;
        } else if (val.type === "ObjectPattern") {
          extractFieldsFromObjectPattern(val, result.inferredBodyFields);
        }
      } else if (keyName === "query") {
        if (val.type === "Identifier") {
          queryVarName = val.name;
        } else if (val.type === "ObjectPattern") {
          extractFieldsFromObjectPattern(val, result.inferredQueryFields);
        }
      } else if (keyName === "params") {
        if (val.type === "Identifier") {
          paramsVarName = val.name;
        } else if (val.type === "ObjectPattern") {
          extractFieldsFromObjectPattern(val, result.pathParams);
        }
      }
    }
  }

  const candidateBodySchemas = new Set<any>();
  const candidateQuerySchemas = new Set<any>();
  const candidateParamSchemas = new Set<any>();

  if (funcNode.body) {
    traverse(
      { type: "File", program: { type: "Program", body: [funcNode] } } as any,
      {
        FunctionDeclaration(p) {
          if (p.node !== funcNode) p.skip();
        },
        ArrowFunctionExpression(p) {
          if (p.node !== funcNode) p.skip();
        },
        FunctionExpression(p) {
          if (p.node !== funcNode) p.skip();
        },
        ClassMethod(p) {
          if (p.node !== funcNode) p.skip();
        },
        ObjectMethod(p) {
          if (p.node !== funcNode) p.skip();
        },

        "MemberExpression|OptionalMemberExpression"(p: any) {
          const obj = unwrapTSExpression(p.node.object);
          const prop = p.node.property;
          if (p.node.computed) return;
          if (prop.type !== "Identifier") return;

          if (reqVarName && obj.type === "MemberExpression" && !obj.computed) {
            const baseObj = unwrapTSExpression(obj.object);
            const subProp = obj.property;
            if (
              baseObj.type === "Identifier" &&
              baseObj.name === reqVarName &&
              subProp.type === "Identifier"
            ) {
              const area = subProp.name;
              if (area === "body") result.inferredBodyFields.add(prop.name);
              else if (area === "query") result.inferredQueryFields.add(prop.name);
              else if (area === "params") result.pathParams.add(prop.name);
              return;
            }
          }

          if (obj.type === "Identifier") {
            if (bodyVarName && obj.name === bodyVarName) {
              result.inferredBodyFields.add(prop.name);
            } else if (queryVarName && obj.name === queryVarName) {
              result.inferredQueryFields.add(prop.name);
            } else if (paramsVarName && obj.name === paramsVarName) {
              result.pathParams.add(prop.name);
            }
          }
        },

        VariableDeclarator(p) {
          const init = unwrapTSExpression(p.node.init);
          const id = p.node.id;
          if (!init) return;

          // Track variable aliases (Layer 2)
          if (id.type === "Identifier") {
            const unwrappedInit = unwrapTSExpression(init);
            let isBodyAlias = false;
            let isQueryAlias = false;
            let isParamsAlias = false;

            if (
              (unwrappedInit.type === "MemberExpression" || unwrappedInit.type === "OptionalMemberExpression") &&
              !unwrappedInit.computed &&
              unwrappedInit.object.type === "Identifier" &&
              unwrappedInit.object.name === reqVarName &&
              unwrappedInit.property.type === "Identifier"
            ) {
              const area = unwrappedInit.property.name;
              if (area === "body") isBodyAlias = true;
              else if (area === "query") isQueryAlias = true;
              else if (area === "params") isParamsAlias = true;
            } else if (
              unwrappedInit.type === "CallExpression" &&
              unwrappedInit.arguments.length > 0
            ) {
              // Avoid treating validation wrapper methods as direct body aliases
              let isWrapper = false;
              const callee = unwrapTSExpression(unwrappedInit.callee);
              if (callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") {
                const prop = callee.property;
                if (prop.type === "Identifier" && (prop.name === "safeParse" || prop.name === "validate")) {
                  isWrapper = true;
                }
              }

              if (!isWrapper) {
                const arg = unwrapTSExpression(unwrappedInit.arguments[0]);
                if (
                  (arg.type === "MemberExpression" || arg.type === "OptionalMemberExpression") &&
                  !arg.computed &&
                  arg.object.type === "Identifier" &&
                  arg.object.name === reqVarName &&
                  arg.property.type === "Identifier"
                ) {
                  const area = arg.property.name;
                  if (area === "body") isBodyAlias = true;
                  else if (area === "query") isQueryAlias = true;
                  else if (area === "params") isParamsAlias = true;
                } else if (arg.type === "Identifier") {
                  if (bodyVarName && arg.name === bodyVarName) isBodyAlias = true;
                  else if (queryVarName && arg.name === queryVarName) isQueryAlias = true;
                  else if (paramsVarName && arg.name === paramsVarName) isParamsAlias = true;
                }
              }
            }

            if (isBodyAlias) bodyVarName = id.name;
            else if (isQueryAlias) queryVarName = id.name;
            else if (isParamsAlias) paramsVarName = id.name;
            return;
          }

          if (id.type !== "ObjectPattern") return;

          let targetArea: "body" | "query" | "params" | "req" | null = null;

          if (init.type === "Identifier") {
            if (bodyVarName && init.name === bodyVarName) targetArea = "body";
            else if (queryVarName && init.name === queryVarName) targetArea = "query";
            else if (paramsVarName && init.name === paramsVarName) targetArea = "params";
            else if (reqVarName && init.name === reqVarName) targetArea = "req";
          } else if ((init.type === "MemberExpression" || init.type === "OptionalMemberExpression") && !init.computed) {
            const obj = unwrapTSExpression(init.object);
            const prop = init.property;
            if (
              reqVarName &&
              obj.type === "Identifier" &&
              obj.name === reqVarName &&
              prop.type === "Identifier"
            ) {
              const name = prop.name;
              if (name === "body") targetArea = "body";
              else if (name === "query") targetArea = "query";
              else if (name === "params") targetArea = "params";
            }
          }

          if (!targetArea) return;

          if (targetArea === "body") {
            extractFieldsFromObjectPattern(id, result.inferredBodyFields);
          } else if (targetArea === "query") {
            extractFieldsFromObjectPattern(id, result.inferredQueryFields);
          } else if (targetArea === "params") {
            extractFieldsFromObjectPattern(id, result.pathParams);
          } else if (targetArea === "req") {
            for (const prop of id.properties) {
              if (prop.type !== "ObjectProperty") continue;
              if (prop.key.type !== "Identifier") continue;
              const keyName = prop.key.name;
              const val = unwrapTSExpression(prop.value);
              if (keyName === "body" && val.type === "ObjectPattern") {
                extractFieldsFromObjectPattern(val, result.inferredBodyFields);
              } else if (keyName === "query" && val.type === "ObjectPattern") {
                extractFieldsFromObjectPattern(val, result.inferredQueryFields);
              } else if (keyName === "params" && val.type === "ObjectPattern") {
                extractFieldsFromObjectPattern(val, result.pathParams);
              } else if (keyName === "body" && val.type === "Identifier") {
                bodyVarName = val.name;
              } else if (keyName === "query" && val.type === "Identifier") {
                queryVarName = val.name;
              } else if (keyName === "params" && val.type === "Identifier") {
                paramsVarName = val.name;
              }
            }
          }
        },

        CallExpression(p) {
          const args = p.node.arguments;
          if (args.length === 0) return;

          const firstArg = unwrapTSExpression(args[0]);
          let isBody = false;
          let isQuery = false;
          let isParams = false;

          if (
            (firstArg.type === "MemberExpression" || firstArg.type === "OptionalMemberExpression") &&
            !firstArg.computed &&
            firstArg.object.type === "Identifier" &&
            firstArg.object.name === reqVarName &&
            firstArg.property.type === "Identifier"
          ) {
            const area = firstArg.property.name;
            if (area === "body") isBody = true;
            else if (area === "query") isQuery = true;
            else if (area === "params") isParams = true;
          } else if (firstArg.type === "Identifier") {
            if (bodyVarName && firstArg.name === bodyVarName) isBody = true;
            else if (queryVarName && firstArg.name === queryVarName) isQuery = true;
            else if (paramsVarName && firstArg.name === paramsVarName) isParams = true;
          }

          if (!isBody && !isQuery && !isParams) return;

          const callee = unwrapTSExpression(p.node.callee);
          if (
            (callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") &&
            !callee.computed &&
            callee.property.type === "Identifier"
          ) {
            const baseObj = unwrapTSExpression(callee.object);
            if (isBody) candidateBodySchemas.add(baseObj);
            else if (isQuery) candidateQuerySchemas.add(baseObj);
            else if (isParams) candidateParamSchemas.add(baseObj);
          }
        },
      },
    );
  }

  for (const schemaNode of candidateBodySchemas) {
    const keys = await extractSchemaKeys(schemaNode, currentFilePath, ctx);
    for (const k of keys) result.inferredBodyFields.add(k);
  }
  for (const schemaNode of candidateQuerySchemas) {
    const keys = await extractSchemaKeys(schemaNode, currentFilePath, ctx);
    for (const k of keys) result.inferredQueryFields.add(k);
  }
  for (const schemaNode of candidateParamSchemas) {
    const keys = await extractSchemaKeys(schemaNode, currentFilePath, ctx);
    for (const k of keys) result.pathParams.add(k);
  }

  return result;
}

function findFunctionInFile(ast: any, functionName: string): any {
  let foundNode: any = null;

  traverse(ast, {
    FunctionDeclaration(p) {
      if (p.node.id && p.node.id.name === functionName) {
        foundNode = p.node;
        p.stop();
      }
    },
    VariableDeclarator(p) {
      if (p.node.id.type === "Identifier" && p.node.id.name === functionName) {
        const init = p.node.init;
        if (init) {
          foundNode = init;
          const parent = p.parentPath?.node;
          if (parent && parent.leadingComments && !init.leadingComments) {
            init.leadingComments = parent.leadingComments;
          }
          p.stop();
        }
      }
    },
    AssignmentExpression(p) {
      const left = p.node.left;
      const right = p.node.right;
      if (
        left.type === "MemberExpression" &&
        !left.computed &&
        left.object.type === "Identifier" &&
        left.object.name === "exports" &&
        left.property.type === "Identifier" &&
        left.property.name === functionName
      ) {
        foundNode = right;
        const parent = p.parentPath?.node;
        if (parent && parent.leadingComments && !right.leadingComments) {
          right.leadingComments = parent.leadingComments;
        }
        p.stop();
      }
    },
    ClassMethod(p) {
      if (p.node.key.type === "Identifier" && p.node.key.name === functionName) {
        foundNode = p.node;
        p.stop();
      }
    },
    ObjectMethod(p) {
      if (p.node.key.type === "Identifier" && p.node.key.name === functionName) {
        foundNode = p.node;
        p.stop();
      }
    },
    ObjectProperty(p) {
      if (p.node.key.type === "Identifier" && p.node.key.name === functionName) {
        foundNode = p.node.value;
        p.stop();
      }
    },
    ExportNamedDeclaration(p) {
      const decl = p.node.declaration;
      if (decl && decl.type === "VariableDeclaration") {
        for (const d of decl.declarations) {
          if (d.id.type === "Identifier" && d.id.name === functionName) {
            foundNode = d.init;
            const parent = p.node;
            if (parent && parent.leadingComments && d.init && !d.init.leadingComments) {
              d.init.leadingComments = parent.leadingComments;
            }
            p.stop();
          }
        }
      }
    },
    ExportDefaultDeclaration(p) {
      const decl = p.node.declaration;
      if (decl.type === "ObjectExpression") {
        for (const prop of decl.properties) {
          if (
            prop.type === "ObjectMethod" &&
            prop.key.type === "Identifier" &&
            prop.key.name === functionName
          ) {
            foundNode = prop;
            p.stop();
          } else if (
            prop.type === "ObjectProperty" &&
            prop.key.type === "Identifier" &&
            prop.key.name === functionName
          ) {
            const val = prop.value;
            foundNode = val;
            p.stop();
          }
        }
      }
    }
  });

  return foundNode;
}

function unwrapFunctionNode(node: any): any {
  if (!node) return null;
  if (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  ) {
    return node;
  }
  if (node.type === "CallExpression" && Array.isArray(node.arguments)) {
    for (const arg of node.arguments) {
      const unwrapped = unwrapFunctionNode(arg);
      if (unwrapped) {
        if (node.leadingComments && !unwrapped.leadingComments) {
          unwrapped.leadingComments = node.leadingComments;
        }
        return unwrapped;
      }
    }
  }
  return null;
}

async function resolveImportedIdentifier(
  identifierName: string,
  filePath: string,
  ctx: ScannerContext,
  visited = new Set<string>()
): Promise<{ filePath: string; localName: string } | null> {
  const k = `${filePath}|${identifierName}`;
  if (visited.has(k)) return null;
  visited.add(k);

  const ast = await ctx.getAst(filePath);
  if (!ast) return null;

  let importSource: string | null = null;
  let localName = identifierName;

  traverse(ast, {
    ImportDeclaration(p) {
      for (const spec of p.node.specifiers) {
        if (spec.local.name === identifierName) {
          importSource = p.node.source.value;
          if (spec.type === "ImportSpecifier" && spec.imported.type === "Identifier") {
            localName = spec.imported.name;
          } else if (spec.type === "ImportNamespaceSpecifier") {
            localName = "*";
          }
          p.stop();
        }
      }
    },
    VariableDeclarator(p) {
      const init = p.node.init;
      if (!init) return;

      if (p.node.id.type === "Identifier" && p.node.id.name === identifierName) {
        if (isRequireCall(init)) {
          const src = literalString(init.arguments[0] as any);
          if (src) importSource = src;
        }
      } else if (p.node.id.type === "ObjectPattern" && isRequireCall(init)) {
        for (const prop of p.node.id.properties) {
          if (
            prop.type === "ObjectProperty" &&
            prop.value.type === "Identifier" &&
            prop.value.name === identifierName
          ) {
            const src = literalString(init.arguments[0] as any);
            if (src) {
              importSource = src;
              localName = prop.key.type === "Identifier" ? prop.key.name : identifierName;
            }
          }
        }
      }
    }
  });

  if (importSource) {
    const resolved = ctx.resolveImport(filePath, importSource);
    if (!resolved) return null;
    return (
      (await resolveImportedIdentifier(localName, resolved, ctx, visited)) || {
        filePath: resolved,
        localName,
      }
    );
  }

  for (const stmt of ast.program.body) {
    if (stmt.type === "ExportNamedDeclaration" && stmt.source) {
      const src = stmt.source.value;
      const resolved = ctx.resolveImport(filePath, src);
      if (!resolved) continue;

      for (const spec of stmt.specifiers) {
        if (
          (spec.type === "ExportSpecifier" || spec.type === "ExportNamespaceSpecifier") &&
          spec.exported.type === "Identifier" &&
          spec.exported.name === identifierName
        ) {
          const innerLocal =
            spec.type === "ExportSpecifier" && spec.local.type === "Identifier"
              ? spec.local.name
              : "*";
          return (
            (await resolveImportedIdentifier(innerLocal, resolved, ctx, visited)) || {
              filePath: resolved,
              localName: innerLocal,
            }
          );
        }
      }
    }

    if (stmt.type === "ExportAllDeclaration" && stmt.source) {
      const src = stmt.source.value;
      const resolved = ctx.resolveImport(filePath, src);
      if (resolved) {
        const found = await resolveImportedIdentifier(identifierName, resolved, ctx, visited);
        if (found) return found;
      }
    }
  }

  return { filePath, localName };
}

function unwrapTSExpression(node: any): any {
  if (!node) return null;
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression"
  ) {
    return unwrapTSExpression(node.expression);
  }
  return node;
}

function extractKeysFromObjectExpression(node: any): string[] {
  const keys: string[] = [];
  if (!node || node.type !== "ObjectExpression" || !Array.isArray(node.properties)) {
    return keys;
  }
  for (const prop of node.properties) {
    if (prop.type === "ObjectProperty") {
      const unwrappedKey = unwrapTSExpression(prop.key);
      if (unwrappedKey.type === "Identifier") {
        keys.push(unwrappedKey.name);
      } else if (unwrappedKey.type === "StringLiteral") {
        keys.push(unwrappedKey.value);
      }
    }
  }
  return keys;
}

async function resolveIdentifierDefinition(
  identifierName: string,
  filePath: string,
  ctx: ScannerContext,
  visited = new Set<string>()
): Promise<{ node: any; filePath: string } | null> {
  const resolved = await resolveImportedIdentifier(identifierName, filePath, ctx);
  if (!resolved) return null;

  const targetAst = await ctx.getAst(resolved.filePath);
  if (!targetAst) return null;

  let foundNode: any = null;
  traverse(targetAst, {
    VariableDeclarator(p) {
      const id = unwrapTSExpression(p.node.id);
      if (id && id.type === "Identifier" && id.name === resolved.localName) {
        foundNode = p.node.init;
        p.stop();
      }
    },
    FunctionDeclaration(p) {
      if (p.node.id && p.node.id.name === resolved.localName) {
        foundNode = p.node;
        p.stop();
      }
    },
    ClassDeclaration(p) {
      if (p.node.id && p.node.id.name === resolved.localName) {
        foundNode = p.node;
        p.stop();
      }
    },
    ExportNamedDeclaration(p) {
      const decl = p.node.declaration;
      if (decl && decl.type === "VariableDeclaration") {
        for (const d of decl.declarations) {
          const id = unwrapTSExpression(d.id);
          if (id && id.type === "Identifier" && id.name === resolved.localName) {
            foundNode = d.init;
            p.stop();
          }
        }
      }
    }
  });

  if (foundNode) {
    return { node: foundNode, filePath: resolved.filePath };
  }
  return null;
}

async function extractSchemaKeys(
  node: any,
  filePath: string,
  ctx: ScannerContext,
  visited = new Set<string>()
): Promise<string[]> {
  if (!node) return [];
  node = unwrapTSExpression(node);

  const nodeKey = `${filePath}|${node.start}|${node.end}`;
  if (visited.has(nodeKey)) return [];
  visited.add(nodeKey);

  if (node.type === "Identifier") {
    const resolved = await resolveIdentifierDefinition(node.name, filePath, ctx);
    if (resolved) {
      return extractSchemaKeys(resolved.node, resolved.filePath, ctx, visited);
    }
    return [];
  }

  if (node.type === "CallExpression") {
    const callee = unwrapTSExpression(node.callee);

    if ((callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") && !callee.computed && callee.property.type === "Identifier") {
      const methodName = callee.property.name;
      const baseObject = unwrapTSExpression(callee.object);

      const schemaChainMethods = [
        "refine", "partial", "omit", "pick", "extend", "shape", 
        "parse", "parseAsync", "safeParse", "validate", "validateSync", "validateAsync",
        "required", "optional", "nullable", "default"
      ];

      if (schemaChainMethods.includes(methodName)) {
        let baseKeys = await extractSchemaKeys(baseObject, filePath, ctx, visited);
        
        if ((methodName === "extend" || methodName === "shape") && node.arguments.length > 0) {
          const arg = unwrapTSExpression(node.arguments[0]);
          if (arg.type === "ObjectExpression") {
            const extraKeys = extractKeysFromObjectExpression(arg);
            baseKeys = Array.from(new Set([...baseKeys, ...extraKeys]));
          } else if (arg.type === "Identifier") {
            const extraKeys = await extractSchemaKeys(arg, filePath, ctx, visited);
            baseKeys = Array.from(new Set([...baseKeys, ...extraKeys]));
          }
        }
        return baseKeys;
      }
    }

    if ((callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") && !callee.computed) {
      const obj = unwrapTSExpression(callee.object);
      const prop = callee.property;
      if (obj.type === "Identifier" && prop.type === "Identifier") {
        const objName = obj.name.toLowerCase();
        const propName = prop.name;

        if (
          (objName === "z" || objName === "joi" || objName === "yup") &&
          propName === "object" &&
          node.arguments.length > 0
        ) {
          const arg = unwrapTSExpression(node.arguments[0]);
          if (arg.type === "ObjectExpression") {
            return extractKeysFromObjectExpression(arg);
          }
        }
      }
    }
  }

  if (node.type === "ObjectExpression") {
    return extractKeysFromObjectExpression(node);
  }

  return [];
}

async function resolveMemberExpression(
  objName: string,
  propName: string,
  filePath: string,
  ctx: ScannerContext,
  visited = new Set<string>()
): Promise<{ node: any; filePath: string } | null> {
  const k = `${filePath}|${objName}|${propName}`;
  if (visited.has(k)) return null;
  visited.add(k);

  const resolvedObj = await resolveImportedIdentifier(objName, filePath, ctx);
  if (!resolvedObj) return null;

  const ast = await ctx.getAst(resolvedObj.filePath);
  if (!ast) return null;

  let declNode: any = null;
  traverse(ast, {
    VariableDeclarator(p) {
      const id = unwrapTSExpression(p.node.id);
      if (id && id.type === "Identifier" && id.name === resolvedObj.localName) {
        declNode = p.node.init;
        p.stop();
      }
    },
    ClassDeclaration(p) {
      if (p.node.id && p.node.id.name === resolvedObj.localName) {
        declNode = p.node;
        p.stop();
      }
    },
    FunctionDeclaration(p) {
      if (p.node.id && p.node.id.name === resolvedObj.localName) {
        declNode = p.node;
        p.stop();
      }
    }
  });

  if (!declNode) {
    const funcNode = findFunctionInFile(ast, propName);
    if (funcNode) {
      return { node: funcNode, filePath: resolvedObj.filePath };
    }
    return null;
  }

  declNode = unwrapTSExpression(declNode);

  if (declNode.type === "NewExpression" && declNode.callee.type === "Identifier") {
    return resolveMemberExpression(declNode.callee.name, propName, resolvedObj.filePath, ctx, visited);
  }

  if (declNode.type === "ClassDeclaration") {
    if (declNode.body && Array.isArray(declNode.body.body)) {
      for (const member of declNode.body.body) {
        if (
          (member.type === "ClassMethod" || member.type === "MethodDefinition") &&
          member.key.type === "Identifier" &&
          member.key.name === propName
        ) {
          return { node: member, filePath: resolvedObj.filePath };
        }
      }
    }
  }

  if (declNode.type === "ObjectExpression") {
    for (const prop of declNode.properties) {
      if (prop.type === "ObjectMethod" && prop.key.type === "Identifier" && prop.key.name === propName) {
        return { node: prop, filePath: resolvedObj.filePath };
      }
      if (prop.type === "ObjectProperty" && prop.key.type === "Identifier" && prop.key.name === propName) {
        return { node: prop.value, filePath: resolvedObj.filePath };
      }
    }
  }

  if (declNode.type === "Identifier") {
    return resolveMemberExpression(declNode.name, propName, resolvedObj.filePath, ctx, visited);
  }

  const funcNode = findFunctionInFile(ast, propName);
  if (funcNode) {
    return { node: funcNode, filePath: resolvedObj.filePath };
  }

  return null;
}

async function resolveHandlerNode(
  handlerNode: any,
  currentFilePath: string,
  ctx: ScannerContext
): Promise<{ node: any; filePath: string } | null> {
  if (!handlerNode) return null;
  handlerNode = unwrapTSExpression(handlerNode);

  if (
    handlerNode.type === "ArrowFunctionExpression" ||
    handlerNode.type === "FunctionExpression"
  ) {
    const unwrapped = unwrapFunctionNode(handlerNode);
    return unwrapped ? { node: unwrapped, filePath: currentFilePath } : null;
  }

  if (handlerNode.type === "Identifier") {
    const localName = handlerNode.name;
    const resolved = await resolveImportedIdentifier(localName, currentFilePath, ctx);
    if (!resolved) return null;

    const targetAst = await ctx.getAst(resolved.filePath);
    if (!targetAst) return null;

    const funcNode = findFunctionInFile(targetAst, resolved.localName);
    if (funcNode) {
      const unwrapped = unwrapFunctionNode(funcNode);
      if (unwrapped) return { node: unwrapped, filePath: resolved.filePath };
    }
  }

  if (
    (handlerNode.type === "MemberExpression" || handlerNode.type === "OptionalMemberExpression") &&
    !handlerNode.computed &&
    handlerNode.property.type === "Identifier"
  ) {
    const obj = unwrapTSExpression(handlerNode.object);
    const propName = handlerNode.property.name;

    if (obj.type === "Identifier") {
      const resolved = await resolveMemberExpression(obj.name, propName, currentFilePath, ctx);
      if (resolved) {
        const unwrapped = unwrapFunctionNode(resolved.node);
        if (unwrapped) return { node: unwrapped, filePath: resolved.filePath };
      }
    }

    if (obj.type === "NewExpression" && obj.callee.type === "Identifier") {
      const className = obj.callee.name;
      const resolved = await resolveMemberExpression(className, propName, currentFilePath, ctx);
      if (resolved) {
        const unwrapped = unwrapFunctionNode(resolved.node);
        if (unwrapped) return { node: unwrapped, filePath: resolved.filePath };
      }
    }
  }

  return null;
}

function extractPathParams(routePath: string): string[] {
  const params: string[] = [];
  const segments = routePath.split("/");
  for (const seg of segments) {
    if (seg.startsWith(":")) {
      const match = seg.slice(1).match(/^([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        params.push(match[1]);
      }
    }
  }
  return params;
}

function appEntity(filePath: string, varName: string): EntityId {
  return `app:${filePath}:${varName}`;
}

function routerEntity(filePath: string, varName: string): EntityId {
  return `router:${filePath}:${varName}`;
}

function isIdent(node: any): node is { type: "Identifier"; name: string } {
  return !!node && node.type === "Identifier" && typeof node.name === "string";
}

function pickDefaultRouterEntity(info: FileInfo): EntityId | null {
  if (info.exportedRouterEntities.length > 0)
    return info.exportedRouterEntities[0];
  if (info.routerVars.size === 1) {
    const only = Array.from(info.routerVars)[0];
    return routerEntity(info.filePath, only);
  }
  return null;
}

function isRequireCall(
  node: any,
): node is { type: "CallExpression"; callee: any; arguments: any[] } {
  if (!node || node.type !== "CallExpression") return false;
  if (
    !node.callee ||
    node.callee.type !== "Identifier" ||
    node.callee.name !== "require"
  )
    return false;
  return Array.isArray(node.arguments) && node.arguments.length >= 1;
}

function evalStringExpr(
  node: any,
  constStrings: Map<string, string>,
): string | null {
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral") {
    if (node.expressions?.length) return null;
    return (node.quasis || []).map((q: any) => q.value?.cooked ?? "").join("");
  }
  if (node.type === "Identifier") return constStrings.get(node.name) ?? null;
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const l = evalStringExpr(node.left, constStrings);
    const r = evalStringExpr(node.right, constStrings);
    if (typeof l === "string" && typeof r === "string") return `${l}${r}`;
  }
  return null;
}

function findRouteBaseFromCall(
  expr: any,
): { ownerIdent: string; routePath: string } | null {
  // Supports chains like:
  // router.route('/x').get(...)
  // router.route('/x').get(...).post(...)
  let cur: any = expr;
  const maxHops = 25;

  for (let i = 0; i < maxHops; i++) {
    if (!cur || cur.type !== "CallExpression") return null;
    const callee = cur.callee;
    if (!callee || callee.type !== "MemberExpression" || callee.computed)
      return null;
    if (!callee.property || callee.property.type !== "Identifier") return null;

    const prop = callee.property.name;
    if (prop === "route") {
      if (callee.object?.type !== "Identifier") return null;
      const ownerIdent = callee.object.name;
      const routePath = literalString(cur.arguments?.[0] as any);
      if (!routePath) return null;
      return { ownerIdent, routePath };
    }

    if (!isHttpMethodName(prop)) return null;
    const next = callee.object;
    if (!next || next.type !== "CallExpression") return null;
    cur = next;
  }

  return null;
}

function extractExpressInfo(
  ctx: ScannerContext,
  filePath: string,
  ast: any,
): FileInfo {
  const appVars = new Set<string>();
  const routerVars = new Set<string>();
  const importToFile = new Map<string, string>();
  const exportedRouterEntities: EntityId[] = [];
  const importSpecifiers = new Map<string, { filePath: string; importedName: string }>();
  const reExports = new Map<string, { filePath: string; localName: string }>();
  const wildcardReExports: string[] = [];

  const constStrings = new Map<string, string>();

  const routes: FileInfo["routes"] = [];
  const mounts: FileInfo["mounts"] = [];

  const activeMiddlewares = new Map<string, string[]>();

  let expressDefault: string | null = null;
  const expressRouters = new Set<string>();

  function markExported(varName: string) {
    if (!routerVars.has(varName)) return;
    const ent = routerEntity(filePath, varName);
    if (!exportedRouterEntities.includes(ent)) exportedRouterEntities.push(ent);
  }

  function isRouterMountTarget(node: any): boolean {
    if (!node) return false;
    if (node.type === "Identifier" && routerVars.has(node.name)) {
      return true;
    }
    let importedFile: string | undefined;
    if (node.type === "Identifier") {
      importedFile = importToFile.get(node.name);
    } else if (node.type === "CallExpression" && isIdent(node.callee)) {
      importedFile = importToFile.get(node.callee.name);
    } else if (isRequireCall(node)) {
      const src = literalString(node.arguments[0] as any);
      if (src) {
        importedFile = ctx.resolveImport(filePath, src) || undefined;
      }
    }
    if (importedFile) {
      const lower = importedFile.toLowerCase();
      return lower.includes("route") || lower.includes("router");
    }
    return false;
  }

  traverse(ast, {
    VariableDeclaration(p) {
      // Capture simple top-level const strings: const API_PREFIX = '/api'
      if (p.parentPath?.node?.type !== "Program") return;
      if (p.node.kind !== "const") return;
      for (const d of p.node.declarations) {
        if (d.id.type !== "Identifier") continue;
        const v = literalString(d.init as any);
        if (typeof v === "string") constStrings.set(d.id.name, v);
      }
    },

    ImportDeclaration(p) {
      const src = p.node.source.value;
      for (const s of p.node.specifiers) {
        if (s.type === "ImportDefaultSpecifier") {
          if (src === "express") expressDefault = s.local.name;
          const resolved = ctx.resolveImport(filePath, src);
          if (resolved) {
            importToFile.set(s.local.name, resolved);
            importSpecifiers.set(s.local.name, { filePath: resolved, importedName: "default" });
          }
        } else if (s.type === "ImportSpecifier") {
          if (
            src === "express" &&
            s.imported.type === "Identifier" &&
            s.imported.name === "Router"
          ) {
            expressRouters.add(s.local.name);
          }
          const resolved = ctx.resolveImport(filePath, src);
          if (resolved) {
            importToFile.set(s.local.name, resolved);
            const importedName = s.imported.type === "Identifier" ? s.imported.name : s.local.name;
            importSpecifiers.set(s.local.name, { filePath: resolved, importedName });
          }
        } else if (s.type === "ImportNamespaceSpecifier") {
          const resolved = ctx.resolveImport(filePath, src);
          if (resolved) {
            importToFile.set(s.local.name, resolved);
            importSpecifiers.set(s.local.name, { filePath: resolved, importedName: "*" });
          }
        }
      }
    },

    VariableDeclarator(p) {
      const init: any = p.node.init;

      if (!init) return;

      // Destructured require: const { router: productsRouter } = require('./x')
      if (p.node.id?.type === "ObjectPattern" && isRequireCall(init)) {
        const src = literalString(init.arguments[0] as any);
        const resolved = src ? ctx.resolveImport(filePath, src) : null;
        if (!resolved) return;
        for (const prop of p.node.id.properties) {
          if (prop.type !== "ObjectProperty") continue;
          const value = prop.value;
          if (value.type === "Identifier") {
            importToFile.set(value.name, resolved);
            const importedName = prop.key.type === "Identifier" ? prop.key.name : value.name;
            importSpecifiers.set(value.name, { filePath: resolved, importedName });
          }
        }
        return;
      }

      if (!p.node.id || p.node.id.type !== "Identifier") return;
      const localName = p.node.id.name;

      // const x = require('...')
      if (isRequireCall(init)) {
        const src = literalString(init.arguments[0] as any);
        if (src === "express") expressDefault = localName;
        const resolved = src ? ctx.resolveImport(filePath, src) : null;
        if (resolved) {
          importToFile.set(localName, resolved);
          importSpecifiers.set(localName, { filePath: resolved, importedName: "default" });
        }
        return;
      }

      // const app = express()
      if (init.type === "CallExpression" && isIdent(init.callee)) {
        if (expressDefault && init.callee.name === expressDefault) {
          appVars.add(localName);
          return;
        }
        if (expressRouters.has(init.callee.name)) {
          routerVars.add(localName);
          return;
        }
      }

      // const router = express.Router()
      if (
        init.type === "CallExpression" &&
        init.callee &&
        init.callee.type === "MemberExpression"
      ) {
        const callee = init.callee;
        if (
          !callee.computed &&
          callee.object.type === "Identifier" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "Router" &&
          expressDefault &&
          callee.object.name === expressDefault
        ) {
          routerVars.add(localName);
          return;
        }

        // const router = require('express').Router()
        if (
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "Router" &&
          callee.object.type === "CallExpression" &&
          isRequireCall(callee.object) &&
          literalString(callee.object.arguments[0] as any) === "express"
        ) {
          routerVars.add(localName);
          return;
        }
      }
    },

    ExportAllDeclaration(p) {
      const src = p.node.source.value;
      const resolved = ctx.resolveImport(filePath, src);
      if (resolved) {
        wildcardReExports.push(resolved);
      }
    },

    ExportNamedDeclaration(p) {
      const decl = p.node.declaration;
      if (decl) {
        if (decl.type === "VariableDeclaration") {
          for (const d of decl.declarations) {
            if (d.id.type === "Identifier") {
              markExported(d.id.name);
            }
          }
        } else if (decl.type === "FunctionDeclaration" && decl.id?.type === "Identifier") {
          markExported(decl.id.name);
        }
      }

      if (p.node.source) {
        const src = p.node.source.value;
        const resolved = ctx.resolveImport(filePath, src);
        if (resolved && Array.isArray(p.node.specifiers)) {
          for (const spec of p.node.specifiers) {
            if (spec.type === "ExportSpecifier" && spec.local.type === "Identifier") {
              const localName = spec.local.name;
              const exportedName = spec.exported.type === "Identifier" ? spec.exported.name : spec.local.name;
              reExports.set(exportedName, { filePath: resolved, localName });
            }
          }
        }
      } else {
        if (Array.isArray(p.node.specifiers)) {
          for (const spec of p.node.specifiers) {
            if (spec.type === "ExportSpecifier" && spec.local.type === "Identifier") {
              const localName = spec.local.name;
              const exportedName = spec.exported.type === "Identifier" ? spec.exported.name : spec.local.name;
              markExported(localName);
              const imp = importSpecifiers.get(localName);
              if (imp) {
                reExports.set(exportedName, { filePath: imp.filePath, localName: imp.importedName });
              }
            }
          }
        }
      }
    },

    ExportDefaultDeclaration(p) {
      const decl = p.node.declaration;
      if (decl.type === "Identifier") {
        markExported(decl.name);
        const imp = importSpecifiers.get(decl.name);
        if (imp) {
          reExports.set("default", { filePath: imp.filePath, localName: imp.importedName });
        }
      } else if (decl.type === "CallExpression") {
        // export default Router() etc. (no named entity)
      }
    },

    AssignmentExpression(p) {
      // module.exports = router
      const left = p.node.left;
      const right = p.node.right;
      if (
        left.type === "MemberExpression" &&
        !left.computed &&
        left.object.type === "Identifier" &&
        left.object.name === "module" &&
        left.property.type === "Identifier" &&
        left.property.name === "exports" &&
        right.type === "Identifier"
      ) {
        markExported(right.name);
      }
    },

    CallExpression(p) {
      const callee = p.node.callee;
      if (callee.type !== "MemberExpression" || callee.computed) return;
      if (callee.property.type !== "Identifier") return;

      const prop = callee.property.name;
      const obj = callee.object;

      // router.route('/x').get(...)
      if (isHttpMethodName(prop) && obj.type === "CallExpression") {
        const base = findRouteBaseFromCall(obj);
        if (
          base &&
          (routerVars.has(base.ownerIdent) || appVars.has(base.ownerIdent))
        ) {
          const args = p.node.arguments;
          const handlerNode = args.length > 0 ? args[args.length - 1] : null;
          const middlewareNodes = args.slice(0, Math.max(0, args.length - 1));

          const ownerIdent = base.ownerIdent;
          const inlineMiddlewares = middlewareNodes
            .map((a) => exprToString(a as any))
            .filter(Boolean);
          const middlewares = [
            ...(activeMiddlewares.get(ownerIdent) || []),
            ...inlineMiddlewares
          ];
          const handler = handlerNode
            ? exprToString(handlerNode as any)
            : undefined;

          const method = methodToUpper(prop) as Method;
          const owner = appVars.has(ownerIdent)
            ? appEntity(filePath, ownerIdent)
            : routerEntity(filePath, ownerIdent);

          const routeDescription =
            extractJSDocDescription(p.parentPath?.node) ||
            extractJSDocDescription(p.node) ||
            "";

          routes.push({
            owner,
            method,
            path: base.routePath,
            handler,
            handlerNode,
            routeDescription,
            middlewares,
            middlewareNodes,
          });
          return;
        }
      }

      // app.get('/x', ...)
      if (isHttpMethodName(prop) && obj.type === "Identifier") {
        const ownerIdent = obj.name;
        if (!appVars.has(ownerIdent) && !routerVars.has(ownerIdent)) return;

        const routePath = literalString(p.node.arguments[0] as any);
        if (!routePath) return;

        const rest = p.node.arguments.slice(1);
        const handlerNode = rest.length > 0 ? rest[rest.length - 1] : null;
        const middlewareNodes = rest.slice(0, Math.max(0, rest.length - 1));

        const inlineMiddlewares = middlewareNodes
          .map((a) => exprToString(a as any))
          .filter(Boolean);
        const middlewares = [
          ...(activeMiddlewares.get(ownerIdent) || []),
          ...inlineMiddlewares
        ];
        const handler = handlerNode
          ? exprToString(handlerNode as any)
          : undefined;

        const method = methodToUpper(prop) as Method;
        const owner = appVars.has(ownerIdent)
          ? appEntity(filePath, ownerIdent)
          : routerEntity(filePath, ownerIdent);

        const routeDescription =
          extractJSDocDescription(p.parentPath?.node) ||
          extractJSDocDescription(p.node) ||
          "";

        routes.push({
          owner,
          method,
          path: routePath,
          handler,
          handlerNode,
          routeDescription,
          middlewares,
          middlewareNodes,
        });
        return;
      }

      // mounts: app.use('/prefix', router)
      if (prop === "use" && obj.type === "Identifier") {
        const ownerIdent = obj.name;
        if (!appVars.has(ownerIdent) && !routerVars.has(ownerIdent)) return;

        const args = p.node.arguments;
        if (args.length === 0) return;

        let mountPath = "/";
        let rest = args;
        const maybePath =
          evalStringExpr(args[0] as any, constStrings) ??
          literalString(args[0] as any);
        if (maybePath) {
          mountPath = maybePath;
          rest = args.slice(1);
        }

        // Extract active middlewares from rest
        let middlewareCount = rest.length;
        if (middlewareCount > 0) {
          const lastArg = rest[middlewareCount - 1];
          if (isRouterMountTarget(lastArg)) {
            middlewareCount--;
          }
        }

        const fileLevelMws = rest
          .slice(0, middlewareCount)
          .map((a) => exprToString(a as any))
          .filter(Boolean);

        if (fileLevelMws.length > 0) {
          if (!activeMiddlewares.has(ownerIdent)) {
            activeMiddlewares.set(ownerIdent, []);
          }
          activeMiddlewares.get(ownerIdent)!.push(...fileLevelMws);
        }

        if (rest.length === 0) return;

        // pick last router-ish argument
        const cand = rest[rest.length - 1];
        let to: FileInfo["mounts"][number]["to"] | null = null;

        if (cand.type === "Identifier") {
          if (routerVars.has(cand.name)) {
            to = { kind: "local", varName: cand.name };
          } else {
            const importedFile = importToFile.get(cand.name);
            if (importedFile) {
              const imp = importSpecifiers.get(cand.name);
              to = {
                kind: "import",
                filePath: importedFile,
                exportName: imp ? imp.importedName : "default",
              };
            }
          }
        } else if (cand.type === "CallExpression" && isIdent(cand.callee)) {
          const importedFile = importToFile.get(cand.callee.name);
          if (importedFile) {
            const imp = importSpecifiers.get(cand.callee.name);
            to = {
              kind: "import",
              filePath: importedFile,
              exportName: imp ? imp.importedName : "default",
            };
          }
        } else if (isRequireCall(cand)) {
          const src = literalString(cand.arguments[0] as any);
          const resolved = src ? ctx.resolveImport(filePath, src) : null;
          if (resolved) {
            to = { kind: "require", filePath: resolved, exportName: "default" };
          }
        }

        if (!to) return;

        const from = appVars.has(ownerIdent)
          ? appEntity(filePath, ownerIdent)
          : routerEntity(filePath, ownerIdent);

        mounts.push({ from, mountPath: normalizePath(mountPath), to });
      }
    },
  });

  return {
    filePath,
    appVars,
    routerVars,
    importToFile,
    exportedRouterEntities,
    reExports,
    wildcardReExports,
    routes,
    mounts,
  };
}

function resolveExportedRouterEntity(
  fileInfos: Map<string, FileInfo>,
  filePath: string,
  exportName: string,
  visited = new Set<string>(),
): EntityId | null {
  const key = `${filePath}::${exportName}`;
  if (visited.has(key)) return null;
  visited.add(key);

  const info = fileInfos.get(filePath);
  if (!info) return null;

  if (info.reExports.has(exportName)) {
    const re = info.reExports.get(exportName)!;
    return resolveExportedRouterEntity(fileInfos, re.filePath, re.localName, visited);
  }

  if (info.routerVars.has(exportName)) {
    return routerEntity(filePath, exportName);
  }

  if (exportName === "default") {
    if (info.exportedRouterEntities.length > 0) {
      return info.exportedRouterEntities[0];
    }
    if (info.routerVars.size === 1) {
      const only = Array.from(info.routerVars)[0];
      return routerEntity(filePath, only);
    }
  }

  for (const wildPath of info.wildcardReExports) {
    const res = resolveExportedRouterEntity(fileInfos, wildPath, exportName, visited);
    if (res) return res;
  }

  if (info.exportedRouterEntities.length > 0) {
    return info.exportedRouterEntities[0];
  }
  if (info.routerVars.size === 1) {
    const only = Array.from(info.routerVars)[0];
    return routerEntity(filePath, only);
  }

  return null;
}

function computeRouterPrefixes(
  fileInfos: Map<string, FileInfo>,
  ctx: ScannerContext,
): Map<EntityId, string[]> {
  const prefixes = new Map<EntityId, string[]>();

  // Important: do NOT default routers to [""] if they are mounted.
  // We'll add [""] only for routers that are never reached from any app.

  // Build edge list after resolving import/require targets to router entities
  const edges = new Map<EntityId, Array<{ to: EntityId; mountPath: string }>>();

  const resolveToEntity = (
    to: FileInfo["mounts"][number]["to"],
  ): EntityId | null => {
    if (to.kind === "local") return null; // handled at call site
    const exportName = to.exportName || "default";
    return resolveExportedRouterEntity(fileInfos, to.filePath, exportName);
  };

  for (const info of fileInfos.values()) {
    for (const m of info.mounts) {
      let target: EntityId | null = null;
      if (m.to.kind === "local") {
        target = routerEntity(info.filePath, m.to.varName);
      } else {
        target = resolveToEntity(m.to);
      }

      if (!target) continue;
      const list = edges.get(m.from) || [];
      list.push({ to: target, mountPath: m.mountPath });
      edges.set(m.from, list);
    }
  }

  const starts: Array<{ entity: EntityId; prefix: string }> = [];
  for (const info of fileInfos.values()) {
    for (const a of info.appVars) {
      starts.push({ entity: appEntity(info.filePath, a), prefix: "" });
    }
  }

  const maxDepth = 20;
  for (const s of starts) {
    const queue: Array<{ entity: EntityId; prefix: string; depth: number }> = [
      { ...s, depth: 0 },
    ];
    const seen = new Set<string>();

    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.depth > maxDepth) continue;

      const k = `${cur.entity}|${cur.prefix}`;
      if (seen.has(k)) continue;
      seen.add(k);

      const outEdges = edges.get(cur.entity) || [];
      for (const e of outEdges) {
        const nextPrefix = cur.prefix
          ? joinPaths(cur.prefix, e.mountPath)
          : normalizePath(e.mountPath);

        const prev = prefixes.get(e.to) || [];
        if (!prev.includes(nextPrefix))
          prefixes.set(e.to, [...prev, nextPrefix]);

        queue.push({ entity: e.to, prefix: nextPrefix, depth: cur.depth + 1 });
      }
    }
  }

  // For routers that were never reached from an app mount, keep them visible as unmounted routes.
  for (const info of fileInfos.values()) {
    for (const r of info.routerVars) {
      const ent = routerEntity(info.filePath, r);
      if (!prefixes.has(ent)) prefixes.set(ent, [""]);
    }
  }

  return prefixes;
}

export const expressParser: FrameworkParser = {
  id: "express",
  detectProject: () => true,
  async parseRoutes(ctx) {
    const fileInfos = new Map<string, FileInfo>();

    for (const f of ctx.files) {
      const ast = await ctx.getAst(f);
      if (!ast) continue;
      const info = extractExpressInfo(ctx, f, ast as any);
      if (
        info.appVars.size ||
        info.routerVars.size ||
        info.routes.length ||
        info.mounts.length ||
        info.reExports.size ||
        info.wildcardReExports.length
      ) {
        fileInfos.set(f, info);
      }
    }

    const prefixes = computeRouterPrefixes(fileInfos, ctx);

    const out: DetectedRoute[] = [];

    for (const info of fileInfos.values()) {
      for (const r of info.routes) {
        const resolved = await resolveHandlerNode(
          r.handlerNode,
          info.filePath,
          ctx
        );

        let description = r.routeDescription || "";
        let pathParams = extractPathParams(r.path);
        let inferredBodyFields: string[] = [];
        let inferredQueryFields: string[] = [];

        const schemaBodyFields = new Set<string>();
        const schemaQueryFields = new Set<string>();
        const schemaPathParams = new Set<string>();

        if (Array.isArray(r.middlewareNodes)) {
          for (const mw of r.middlewareNodes) {
            const unwrappedMw = unwrapTSExpression(mw);
            if (unwrappedMw && unwrappedMw.type === "CallExpression") {
              const callee = unwrapTSExpression(unwrappedMw.callee);
              if (callee.type === "Identifier" && unwrappedMw.arguments.length > 0) {
                const mwName = callee.name.toLowerCase();
                const schemaArg = unwrappedMw.arguments[0];

                const keys = await extractSchemaKeys(schemaArg, info.filePath, ctx);
                if (keys.length > 0) {
                  if (mwName.includes("query")) {
                    for (const k of keys) schemaQueryFields.add(k);
                  } else if (mwName.includes("param")) {
                    for (const k of keys) schemaPathParams.add(k);
                  } else {
                    for (const k of keys) schemaBodyFields.add(k);
                  }
                }
              }
            }
          }
        }

        if (resolved) {
          const analysis = await analyzeFunctionNode(resolved.node, resolved.filePath, ctx);
          if (analysis.description) {
            description = analysis.description;
          }
          const mergedPathParams = new Set([
            ...pathParams,
            ...analysis.pathParams,
            ...schemaPathParams,
          ]);
          pathParams = Array.from(mergedPathParams);
          inferredBodyFields = Array.from(
            new Set([...analysis.inferredBodyFields, ...schemaBodyFields]),
          );
          inferredQueryFields = Array.from(
            new Set([...analysis.inferredQueryFields, ...schemaQueryFields]),
          );
        } else {
          pathParams = Array.from(new Set([...pathParams, ...schemaPathParams]));
          inferredBodyFields = Array.from(schemaBodyFields);
          inferredQueryFields = Array.from(schemaQueryFields);
        }

        if (r.owner.startsWith("app:")) {
          out.push({
            id: "",
            framework: "express",
            method: r.method,
            path: normalizePath(r.path),
            file: info.filePath,
            handler: r.handler,
            middlewares: r.middlewares,
            description,
            pathParams,
            inferredBodyFields,
            inferredQueryFields,
          });
          continue;
        }

        const ps = prefixes.get(r.owner) || [""];
        for (const pfx of ps) {
          const full = pfx ? joinPaths(pfx, r.path) : normalizePath(r.path);
          const fullPathParams = Array.from(
            new Set([...extractPathParams(full), ...pathParams])
          );

          out.push({
            id: "",
            framework: "express",
            method: r.method,
            path: full,
            file: info.filePath,
            handler: r.handler,
            middlewares: r.middlewares,
            description,
            pathParams: fullPathParams,
            inferredBodyFields,
            inferredQueryFields,
          });
        }
      }
    }

    return out;
  },
};
