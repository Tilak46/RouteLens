export function normalizePath(p: string): string {
  const s = String(p || "").trim();
  if (!s) return s;

  let out = s.startsWith("/") ? s : `/${s}`;
  out = out.replace(/\\+/g, "/");
  out = out.replace(/\/+/g, "/");
  if (out.length > 1) out = out.replace(/\/+$/, "");
  return out;
}

export function joinPaths(basePrefix: string, childPath: string): string {
  const base = String(basePrefix || "").trim();
  const child = String(childPath || "").trim();

  if (!base) return normalizePath(child);
  if (!child || child === "/") return normalizePath(base);

  const b = normalizePath(base);
  const c = child.startsWith("/") ? child : `/${child}`;
  return normalizePath(`${b}${c}`);
}
