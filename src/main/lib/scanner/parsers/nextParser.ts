import fs from "node:fs";
import path from "node:path";
import traverse from "@babel/traverse";
import type * as t from "@babel/types";
import { literalString, isReqMethodMember } from "../core/astUtils";
import { normalizePath } from "../core/pathUtils";
import type {
  DetectedRoute,
  FrameworkParser,
  ScannerContext,
} from "../core/types";
import type { Method } from "../../../../types";

const HTTP_METHODS: Method[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]; // ALL handled as fallback

function hasNextProjectMarkers(rootPath: string, files: string[]): boolean {
  const hasFolder = files.some((f) => {
    const rel = path.relative(rootPath, f).replace(/\\/g, "/");
    return (
      rel.startsWith("pages/api/") ||
      rel.includes("/pages/api/") ||
      rel.startsWith("app/api/") ||
      rel.includes("/app/api/")
    );
  });
  if (hasFolder) return true;

  try {
    const pkgPath = path.join(rootPath, "package.json");
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    return typeof deps.next === "string";
  } catch {
    return false;
  }
}

function fileToNextApiPath(
  rootPath: string,
  filePath: string,
  kind: "pages" | "app",
): string | null {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, "/");
  const parts = rel.split("/");

  const idx = parts.findIndex(
    (p) => p === (kind === "pages" ? "pages" : "app"),
  );
  if (idx === -1) return null;

  const apiIdx = parts.findIndex((p, i) => i > idx && p === "api");
  if (apiIdx === -1) return null;

  const sub = parts.slice(apiIdx + 1);
  if (sub.length === 0) return "/api";

  // remove filename
  let last = sub[sub.length - 1];
  const isRouteFile = kind === "app" && /^route\.(t|j)sx?$/.test(last);
  if (kind === "pages") {
    last = last.replace(/\.(t|j)sx?$/, "");
    sub[sub.length - 1] = last;
  } else {
    if (!isRouteFile) return null;
    sub.pop();
  }

  // index -> folder
  if (sub.length > 0 && sub[sub.length - 1] === "index") sub.pop();

  const segs = sub.map((s) => {
    // [id] -> :id
    const m1 = s.match(/^\[(.+)\]$/);
    if (m1) {
      const inner = m1[1];
      const catchAll = inner.startsWith("...");
      const name = catchAll ? inner.slice(3) : inner;
      return catchAll ? `:${name}*` : `:${name}`;
    }
    return s;
  });

  return normalizePath(`/api/${segs.filter(Boolean).join("/")}`);
}

function inferMethodsFromReqMethod(ast: t.File): Method[] {
  const found = new Set<Method>();

  traverse(ast, {
    BinaryExpression(p) {
      const op = p.node.operator;
      if (op !== "===" && op !== "==") return;

      const left = p.node.left;
      const right = p.node.right;

      const leftIs = isReqMethodMember(left as any);
      const rightIs = isReqMethodMember(right as any);

      const lit = leftIs
        ? literalString(right as any)
        : rightIs
          ? literalString(left as any)
          : null;
      if (!lit) return;

      const upper = lit.toUpperCase() as Method;
      if (HTTP_METHODS.includes(upper)) found.add(upper);
    },

    SwitchStatement(p) {
      if (!isReqMethodMember(p.node.discriminant as any)) return;
      for (const c of p.node.cases) {
        const v = literalString(c.test as any);
        if (!v) continue;
        const upper = v.toUpperCase() as Method;
        if (HTTP_METHODS.includes(upper)) found.add(upper);
      }
    },
  });

  return Array.from(found);
}

function exportedAppRouterMethods(ast: t.File): Method[] {
  const found = new Set<Method>();

  for (const stmt of ast.program.body) {
    if (stmt.type === "ExportNamedDeclaration") {
      const decl = stmt.declaration;
      if (!decl) continue;

      if (
        decl.type === "FunctionDeclaration" &&
        decl.id?.type === "Identifier"
      ) {
        const name = decl.id.name.toUpperCase() as Method;
        if (HTTP_METHODS.includes(name)) found.add(name);
      }

      if (decl.type === "VariableDeclaration") {
        for (const d of decl.declarations) {
          if (d.id.type !== "Identifier") continue;
          const name = d.id.name.toUpperCase() as Method;
          if (!HTTP_METHODS.includes(name)) continue;
          found.add(name);
        }
      }
    }
  }

  return Array.from(found);
}

export const nextParser: FrameworkParser = {
  id: "next-pages",
  detectProject: (ctx) => hasNextProjectMarkers(ctx.rootPath, ctx.files),
  async parseRoutes(ctx) {
    const out: DetectedRoute[] = [];

    const pagesFiles = ctx.files.filter((f) => {
      const rel = path.relative(ctx.rootPath, f).replace(/\\/g, "/");
      return rel.includes("pages/api/") || rel.startsWith("pages/api/");
    });

    for (const f of pagesFiles) {
      const routePath = fileToNextApiPath(ctx.rootPath, f, "pages");
      if (!routePath) continue;

      const ast = await ctx.getAst(f);
      if (!ast) continue;

      const methods = inferMethodsFromReqMethod(ast as any);
      const finalMethods = methods.length ? methods : (["ALL"] as Method[]);
      if (!methods.length) {
        ctx.log(`[NextPages] Could not infer methods for ${f}; emitting ALL.`);
      }

      for (const m of finalMethods) {
        out.push({
          id: "",
          framework: "next-pages",
          method: m,
          path: routePath,
          file: f,
          handler: "default",
          middlewares: [],
        });
      }
    }

    return out;
  },
};

export const nextAppParser: FrameworkParser = {
  id: "next-app",
  detectProject: (ctx) => hasNextProjectMarkers(ctx.rootPath, ctx.files),
  async parseRoutes(ctx) {
    const out: DetectedRoute[] = [];

    const appRouteFiles = ctx.files.filter((f) => {
      const rel = path.relative(ctx.rootPath, f).replace(/\\/g, "/");
      return (
        (rel.includes("app/api/") || rel.startsWith("app/api/")) &&
        /\/route\.(t|j)sx?$/.test(rel)
      );
    });

    for (const f of appRouteFiles) {
      const routePath = fileToNextApiPath(ctx.rootPath, f, "app");
      if (!routePath) continue;

      const ast = await ctx.getAst(f);
      if (!ast) continue;

      const methods = exportedAppRouterMethods(ast as any);
      for (const m of methods) {
        out.push({
          id: "",
          framework: "next-app",
          method: m,
          path: routePath,
          file: f,
          handler: m,
          middlewares: [],
        });
      }
    }

    return out;
  },
};
