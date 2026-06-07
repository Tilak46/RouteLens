import fs from "node:fs";
import path from "node:path";

export function resolveImportToFile(
  fromFile: string,
  importSource: string,
): string | null {
  const raw = String(importSource || "").trim();
  if (!raw) return null;

  // Only handle relative/absolute filesystem imports.
  if (!raw.startsWith(".") && !raw.startsWith("/")) return null;

  const base = path.resolve(path.dirname(fromFile), raw);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.js`,
    `${base}.tsx`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
    path.join(base, "index.tsx"),
    path.join(base, "index.jsx"),
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      // ignore
    }
  }

  return null;
}
