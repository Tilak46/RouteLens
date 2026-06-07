import type * as t from "@babel/types";

const METHODS = new Set(["get", "post", "put", "delete", "patch", "all"]);

export function isHttpMethodName(name: string): boolean {
  return METHODS.has(String(name || "").toLowerCase());
}

export function methodToUpper(name: string): string {
  const n = String(name || "").toUpperCase();
  return n === "ALL" ? "ALL" : n;
}

export function literalString(node: t.Node | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral") {
    if (node.expressions.length > 0) return null;
    const cooked = node.quasis.map((q) => q.value.cooked ?? "").join("");
    return cooked;
  }
  return null;
}

export function memberExprToString(
  node: t.MemberExpression | t.OptionalMemberExpression,
): string {
  const obj = exprToString(node.object as any);
  const prop = node.computed
    ? `[${exprToString(node.property as any)}]`
    : exprToString(node.property as any);
  return obj && prop ? `${obj}.${prop}` : obj || prop || "";
}

export function exprToString(node: t.Node | null | undefined): string {
  if (!node) return "";
  switch (node.type) {
    case "Identifier":
      return node.name;
    case "StringLiteral":
      return JSON.stringify(node.value);
    case "MemberExpression":
    case "OptionalMemberExpression":
      return memberExprToString(node);
    case "CallExpression":
      return `${exprToString(node.callee as any)}()`;
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return "<anonymous>";
    case "ObjectExpression":
      return "<object>";
    case "ArrayExpression":
      return "<array>";
    default:
      return `<${node.type}>`;
  }
}

export function isReqMethodMember(node: t.Node | null | undefined): boolean {
  if (!node) return false;
  if (
    node.type !== "MemberExpression" &&
    node.type !== "OptionalMemberExpression"
  )
    return false;
  const prop = node.property;
  if (node.computed) return false;
  if (prop.type !== "Identifier") return false;
  if (prop.name !== "method") return false;
  // allow req.method / request.method / context.req.method, etc.
  return true;
}
