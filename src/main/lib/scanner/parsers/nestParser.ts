import fs from "node:fs";
import path from "node:path";
import traverse from "@babel/traverse";
import { joinPaths } from "../core/pathUtils";
import { literalString } from "../core/astUtils";
import type {
  DetectedRoute,
  FrameworkParser,
  ScannerContext,
} from "../core/types";
import type { Method } from "../../../../types";

const HTTP_DECORATORS: Record<string, Method> = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Delete: "DELETE",
  Patch: "PATCH",
  All: "ALL",
};

const GUARD_LIKE_DECORATORS = new Set([
  "UseGuards",
  "UseInterceptors",
  "UsePipes",
]);

type DecoratorInfo = { name: string; call: any | null };

function getDecoratorInfo(dec: any): DecoratorInfo | null {
  const expr = dec.expression;
  if (expr.type === "CallExpression" && expr.callee.type === "Identifier") {
    return { name: expr.callee.name, call: expr };
  }
  if (expr.type === "Identifier") {
    return { name: expr.name, call: null };
  }
  return null;
}

function findDecorator(decorators: any[] | undefined, name: string): any | null {
  if (!Array.isArray(decorators)) return null;
  return decorators.find((d) => getDecoratorInfo(d)?.name === name) || null;
}

function extractPathStrings(node: any): string[] {
  if (!node) return [""];
  if (node.type === "StringLiteral") return [node.value];
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return [node.quasis.map((q: any) => q.value.cooked ?? "").join("")];
  }
  if (node.type === "ArrayExpression") {
    const out: string[] = [];
    for (const el of node.elements) {
      if (el) out.push(...extractPathStrings(el));
    }
    return out.length ? out : [""];
  }
  if (node.type === "ObjectExpression") {
    for (const prop of node.properties) {
      if (
        prop.type === "ObjectProperty" &&
        prop.key.type === "Identifier" &&
        prop.key.name === "path"
      ) {
        return extractPathStrings(prop.value);
      }
    }
    return [""];
  }
  return [""];
}

function extractJSDocDescription(node: any): string | undefined {
  if (!node || !Array.isArray(node.leadingComments)) return undefined;
  const lines = node.leadingComments
    .filter((c: any) => c.type === "CommentBlock")
    .map((c: any) =>
      c.value
        .split("\n")
        .map((line: string) => line.replace(/^\s*\*\s?/, "").trim())
        .filter((line: string) => line && !line.startsWith("@"))
        .join("\n"),
    )
    .filter(Boolean);
  return lines.length > 0 ? lines.join("\n\n") : undefined;
}

function extractApiOperationSummary(decorators: any[] | undefined): string | undefined {
  const dec = findDecorator(decorators, "ApiOperation");
  const info = dec ? getDecoratorInfo(dec) : null;
  const arg = info?.call?.arguments?.[0];
  if (!arg || arg.type !== "ObjectExpression") return undefined;
  for (const prop of arg.properties) {
    if (
      prop.type === "ObjectProperty" &&
      prop.key.type === "Identifier" &&
      prop.key.name === "summary"
    ) {
      const val = literalString(prop.value);
      if (val) return val;
    }
  }
  return undefined;
}

function extractGuardNames(decorators: any[] | undefined): string[] {
  if (!Array.isArray(decorators)) return [];
  const names: string[] = [];
  for (const dec of decorators) {
    const info = getDecoratorInfo(dec);
    if (!info || !info.call || !GUARD_LIKE_DECORATORS.has(info.name)) continue;
    for (const arg of info.call.arguments) {
      if (arg.type === "Identifier") names.push(arg.name);
    }
  }
  return names;
}

function extractPathParams(routePath: string): string[] {
  const params: string[] = [];
  for (const seg of routePath.split("/")) {
    if (seg.startsWith(":")) {
      const m = seg.slice(1).match(/^([a-zA-Z0-9_]+)/);
      if (m && m[1]) params.push(m[1]);
    }
  }
  return params;
}

function extractDtoFieldNames(node: any): string[] {
  const fields = new Set<string>();
  if (!node) return [];

  if (node.type === "ClassDeclaration" && node.body?.body) {
    for (const member of node.body.body) {
      if (member.type === "ClassProperty" && !member.static) {
        if (member.key.type === "Identifier") fields.add(member.key.name);
        else if (member.key.type === "StringLiteral") fields.add(member.key.value);
      } else if (member.type === "ClassMethod" && member.kind === "constructor") {
        for (const param of member.params) {
          if (param.type === "TSParameterProperty" && param.parameter.type === "Identifier") {
            fields.add(param.parameter.name);
          }
        }
      }
    }
  }

  if (node.type === "TSInterfaceDeclaration" && node.body?.body) {
    for (const member of node.body.body) {
      if (member.type === "TSPropertySignature") {
        if (member.key.type === "Identifier") fields.add(member.key.name);
        else if (member.key.type === "StringLiteral") fields.add(member.key.value);
      }
    }
  }

  if (node.type === "TSTypeAliasDeclaration") {
    const annot = node.typeAnnotation;
    if (annot?.type === "TSTypeLiteral" && Array.isArray(annot.members)) {
      for (const member of annot.members) {
        if (member.type === "TSPropertySignature") {
          if (member.key.type === "Identifier") fields.add(member.key.name);
          else if (member.key.type === "StringLiteral") fields.add(member.key.value);
        }
      }
    }
  }

  return Array.from(fields);
}

async function resolveDtoFieldNames(
  typeName: string,
  filePath: string,
  ctx: ScannerContext,
  visited = new Set<string>(),
): Promise<string[]> {
  const key = `${filePath}|${typeName}`;
  if (visited.has(key)) return [];
  visited.add(key);

  const ast = await ctx.getAst(filePath);
  if (!ast) return [];

  let localNode: any = null;
  let importSource: string | null = null;

  traverse(ast, {
    ClassDeclaration(p) {
      if (!localNode && p.node.id?.name === typeName) {
        localNode = p.node;
      }
    },
    TSInterfaceDeclaration(p) {
      if (!localNode && p.node.id?.name === typeName) {
        localNode = p.node;
      }
    },
    TSTypeAliasDeclaration(p) {
      if (!localNode && p.node.id?.name === typeName) {
        localNode = p.node;
      }
    },
    ImportDeclaration(p) {
      if (importSource) return;
      for (const spec of p.node.specifiers) {
        if (
          spec.local.name === typeName &&
          (spec.type === "ImportSpecifier" || spec.type === "ImportDefaultSpecifier")
        ) {
          importSource = p.node.source.value;
        }
      }
    },
  });

  if (localNode) return extractDtoFieldNames(localNode);

  if (importSource) {
    const resolved = ctx.resolveImport(filePath, importSource);
    if (resolved) return resolveDtoFieldNames(typeName, resolved, ctx, visited);
  }

  return [];
}

function getTypeReferenceName(target: any): string | null {
  const ann = target?.typeAnnotation?.typeAnnotation;
  if (ann?.type === "TSTypeReference" && ann.typeName?.type === "Identifier") {
    return ann.typeName.name;
  }
  return null;
}

async function analyzeMethodParams(
  methodNode: any,
  filePath: string,
  ctx: ScannerContext,
): Promise<{
  pathParams: Set<string>;
  bodyFields: Set<string>;
  queryFields: Set<string>;
}> {
  const pathParams = new Set<string>();
  const bodyFields = new Set<string>();
  const queryFields = new Set<string>();

  for (const param of methodNode.params || []) {
    const target = param.type === "TSParameterProperty" ? param.parameter : param;
    if (!target?.decorators?.length) continue;

    for (const dec of target.decorators) {
      const info = getDecoratorInfo(dec);
      if (!info) continue;

      const arg = info.call?.arguments?.[0];
      const argStr = arg ? literalString(arg) : null;

      if (info.name === "Param") {
        if (argStr) pathParams.add(argStr);
        continue;
      }

      if (info.name === "Body") {
        if (argStr) {
          bodyFields.add(argStr);
        } else {
          const typeName = getTypeReferenceName(target);
          if (typeName) {
            const fields = await resolveDtoFieldNames(typeName, filePath, ctx);
            for (const f of fields) bodyFields.add(f);
          }
        }
        continue;
      }

      if (info.name === "Query") {
        if (argStr) {
          queryFields.add(argStr);
        } else {
          const typeName = getTypeReferenceName(target);
          if (typeName) {
            const fields = await resolveDtoFieldNames(typeName, filePath, ctx);
            for (const f of fields) queryFields.add(f);
          }
        }
      }
    }
  }

  return { pathParams, bodyFields, queryFields };
}

async function findGlobalPrefix(ctx: ScannerContext): Promise<string> {
  for (const f of ctx.files) {
    if (!/main\.(t|j)sx?$/.test(f)) continue;
    const ast = await ctx.getAst(f);
    if (!ast) continue;

    let prefix = "";
    traverse(ast, {
      CallExpression(p) {
        if (prefix) return;
        const callee = p.node.callee;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "setGlobalPrefix"
        ) {
          const arg = literalString(p.node.arguments[0] as any);
          if (arg) prefix = arg;
        }
      },
    });
    if (prefix) return prefix;
  }
  return "";
}

async function detectNestProject(ctx: ScannerContext): Promise<boolean> {
  try {
    const pkgRaw = await fs.promises.readFile(
      path.join(ctx.rootPath, "package.json"),
      "utf-8",
    );
    const pkg = JSON.parse(pkgRaw);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["@nestjs/core"] || deps["@nestjs/common"]) return true;
  } catch {
    // fall through to file-based heuristic
  }
  return ctx.files.some((f) => /\.controller\.tsx?$/.test(f));
}

export const nestParser: FrameworkParser = {
  id: "nest",
  detectProject: detectNestProject,
  async parseRoutes(ctx) {
    const globalPrefix = await findGlobalPrefix(ctx);
    const out: DetectedRoute[] = [];

    for (const filePath of ctx.files) {
      const ast = await ctx.getAst(filePath);
      if (!ast) continue;

      const controllerClasses: any[] = [];
      traverse(ast, {
        ClassDeclaration(p) {
          if (findDecorator(p.node.decorators, "Controller")) {
            controllerClasses.push(p.node);
          }
        },
      });

      for (const classNode of controllerClasses) {
        const controllerDecorator = findDecorator(classNode.decorators, "Controller");
        const controllerInfo = getDecoratorInfo(controllerDecorator);
        const controllerPrefixes = extractPathStrings(controllerInfo?.call?.arguments?.[0]);
        const classGuards = extractGuardNames(classNode.decorators);
        const className = classNode.id?.name || "Controller";

        for (const member of classNode.body.body) {
          if (member.type !== "ClassMethod" || member.kind !== "method") continue;

          const methodDecorator = (member.decorators || []).find((d: any) => {
            const info = getDecoratorInfo(d);
            return info ? Boolean(HTTP_DECORATORS[info.name]) : false;
          });
          if (!methodDecorator) continue;

          const methodInfo = getDecoratorInfo(methodDecorator)!;
          const method = HTTP_DECORATORS[methodInfo.name];
          const methodPaths = extractPathStrings(methodInfo.call?.arguments?.[0]);
          const methodGuards = extractGuardNames(member.decorators);
          const handlerName = member.key.type === "Identifier" ? member.key.name : "handler";

          const description =
            extractJSDocDescription(member) ||
            extractApiOperationSummary(member.decorators) ||
            "";

          const { pathParams: decoratorPathParams, bodyFields, queryFields } =
            await analyzeMethodParams(member, filePath, ctx);

          const middlewares = Array.from(new Set([...classGuards, ...methodGuards]));

          for (const cPrefix of controllerPrefixes) {
            const basePrefix = globalPrefix ? joinPaths(globalPrefix, cPrefix) : cPrefix;
            for (const mPath of methodPaths) {
              const full = joinPaths(basePrefix, mPath);
              const pathParams = Array.from(
                new Set([...extractPathParams(full), ...decoratorPathParams]),
              );

              out.push({
                id: "",
                framework: "nest",
                method,
                path: full,
                file: filePath,
                handler: `${className}.${handlerName}`,
                middlewares,
                description,
                pathParams,
                inferredBodyFields: Array.from(bodyFields),
                inferredQueryFields: Array.from(queryFields),
              });
            }
          }
        }
      }
    }

    return out;
  },
};
