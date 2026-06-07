import type { ApiFolder, ApiRoute } from "../types";

const generateId = () => Math.random().toString(36).substring(7);

export function toTitleCaseFromSlug(slug: string) {
  return slug
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function normalizePathSegments(routePath: string): string[] {
  const cleaned = String(routePath || "")
    .split("?")[0]
    .split("#")[0];
  const segments = cleaned.split("/").filter(Boolean);

  // Heuristic: drop common API prefixes
  const drop = new Set(["api"]);
  const out: string[] = [];

  for (const seg of segments) {
    if (drop.has(seg.toLowerCase())) continue;
    // drop v1/v2/etc
    if (/^v\d+$/i.test(seg)) continue;
    out.push(seg);
  }

  return out;
}

export function buildTreeFromRoutePaths(routes: ApiRoute[]): ApiFolder[] {
  const root: ApiFolder = { id: "root", name: "root", children: [] };

  const looksHuman = (name: string | undefined) => {
    const s = String(name ?? "").trim();
    if (!s) return false;
    if (s.includes(" ")) return true;
    if (/[A-Z]/.test(s)) return true;
    return false;
  };

  const isDynamicSegment = (seg: string) => {
    const s = String(seg || "");
    if (!s) return false;
    // Express style: :id, :id?
    if (s.startsWith(":")) return true;
    // Next.js style: [id], [...slug], [[...slug]]
    if (s.startsWith("[") && s.endsWith("]")) return true;
    return false;
  };

  const singularize = (s: string) => {
    const str = String(s || "");
    if (str.length > 3 && str.toLowerCase().endsWith("s"))
      return str.slice(0, -1);
    return str;
  };

  const humanNameFromContext = (args: {
    method: string;
    resourceSeg: string | undefined;
    leafSegments: string[];
  }): string => {
    const method = String(args.method || "").toUpperCase();
    const resourceSeg = args.resourceSeg;
    const resourcePlural = resourceSeg
      ? toTitleCaseFromSlug(resourceSeg)
      : "Resource";
    const resourceSingular = singularize(resourcePlural);

    const leaf = args.leafSegments;
    const staticSegs = leaf.filter((s) => !isDynamicSegment(s));
    const lastStatic = staticSegs.length
      ? staticSegs[staticSegs.length - 1]
      : undefined;
    const lastStaticTitle = lastStatic
      ? toTitleCaseFromSlug(lastStatic)
      : undefined;
    const lastStaticSingular = lastStaticTitle
      ? singularize(lastStaticTitle)
      : undefined;

    const endsWithDynamic =
      leaf.length > 0 && isDynamicSegment(leaf[leaf.length - 1]);
    const startsWithDynamic = leaf.length > 0 && isDynamicSegment(leaf[0]);

    const actionWords = new Set([
      "login",
      "logout",
      "register",
      "refresh",
      "callback",
      "verify",
      "reset",
      "reset-password",
      "forgot-password",
      "change-password",
      "send-otp",
      "otp",
      "ping",
      "health",
      "ready",
    ]);

    // Collection base: /resource
    // Only when the leaf IS the resource segment (avoid treating /auth/login as a collection).
    if (
      leaf.length === 1 &&
      !startsWithDynamic &&
      resourceSeg &&
      String(leaf[0]).toLowerCase() === String(resourceSeg).toLowerCase()
    ) {
      if (method === "GET") return `List ${resourcePlural}`;
      if (method === "POST") return `Create ${resourceSingular}`;
      if (method === "PUT" || method === "PATCH")
        return `Update ${resourcePlural}`;
      if (method === "DELETE") return `Delete ${resourcePlural}`;
    }

    // Item base: /resource/:id
    if (leaf.length === 1 && startsWithDynamic) {
      if (method === "GET") return `Get ${resourceSingular} By Id`;
      if (method === "POST") return `Create ${resourceSingular}`;
      if (method === "PUT" || method === "PATCH")
        return `Update ${resourceSingular}`;
      if (method === "DELETE") return `Delete ${resourceSingular}`;
    }

    // Action endpoint (login/logout/etc): keep it simple.
    if (leaf.length === 1 && lastStatic) {
      const w = String(lastStatic).toLowerCase();
      if (actionWords.has(w)) return toTitleCaseFromSlug(lastStatic);
    }

    // Sub-resource: /resource/:id/comments or /resource/:id/comments/:commentId
    if (lastStaticTitle) {
      const subPlural = lastStaticTitle;
      const subSingular = lastStaticSingular ?? subPlural;

      if (method === "GET") {
        return endsWithDynamic
          ? `Get ${subSingular} By Id`
          : `List ${subPlural}`;
      }
      if (method === "POST") return `Create ${subSingular}`;
      if (method === "PUT" || method === "PATCH")
        return `Update ${subSingular}`;
      if (method === "DELETE") return `Delete ${subSingular}`;
    }

    // Fallback: title-case the visible leaf path
    const fallback = leaf.join("/") || "/";
    return toTitleCaseFromSlug(fallback.replace(/\//g, " "));
  };

  // Used to decide whether a single-segment route like `/posts` should live
  // inside a `Posts` folder (Postman-style) or remain at the root.
  const firstSegmentStats = new Map<
    string,
    { count: number; hasNested: boolean }
  >();

  for (const r of routes) {
    const segments = normalizePathSegments(r.path);
    if (segments.length === 0) continue;
    const first = segments[0];
    const prev = firstSegmentStats.get(first) || { count: 0, hasNested: false };
    firstSegmentStats.set(first, {
      count: prev.count + 1,
      hasNested: prev.hasNested || segments.length > 1,
    });
  }

  const getOrCreateFolder = (
    children: (ApiFolder | ApiRoute)[],
    name: string,
  ) => {
    let folder = children.find(
      (c) => !(c as any).method && (c as any).name === name,
    ) as ApiFolder | undefined;
    if (!folder) {
      folder = { id: generateId(), name, children: [] };
      children.push(folder);
    }
    return folder;
  };

  for (const r of routes) {
    const segments = normalizePathSegments(r.path);
    if (segments.length === 0) {
      root.children.push(r);
      continue;
    }

    // If this is a base route like `/posts` and there are nested routes like
    // `/posts/:id` (or multiple base methods), put it inside the resource folder.
    if (segments.length === 1) {
      const first = segments[0];
      const stats = firstSegmentStats.get(first);

      if (stats?.hasNested || (stats?.count ?? 0) > 1) {
        const folder = getOrCreateFolder(
          root.children,
          toTitleCaseFromSlug(first),
        );
        const insideFolderName = looksHuman(r.name)
          ? r.name
          : humanNameFromContext({
              method: String((r as any).method ?? ""),
              resourceSeg: first,
              leafSegments: [first],
            });

        folder.children.push({ ...r, name: insideFolderName || "/" });
        continue;
      }

      // Singleton segment routes (e.g. `/health`) stay at root.
      root.children.push(r);
      continue;
    }

    // Avoid creating folders for dynamic segments like `:id` / `[id]`.
    // We only create folders for the leading static prefix up to the first dynamic segment.
    const firstDynamicIndex = segments.findIndex((s) => isDynamicSegment(s));
    const folderSegments =
      firstDynamicIndex === -1
        ? segments.slice(0, -1)
        : segments.slice(0, Math.min(firstDynamicIndex, segments.length - 1));

    const leafSegments = segments.slice(folderSegments.length);
    const leafLabel = leafSegments.join("/");

    let current = root;
    for (const seg of folderSegments) {
      current = getOrCreateFolder(current.children, toTitleCaseFromSlug(seg));
    }

    const computedName = looksHuman(r.name)
      ? r.name
      : humanNameFromContext({
          method: String((r as any).method ?? ""),
          resourceSeg: folderSegments.length
            ? folderSegments[folderSegments.length - 1]
            : segments[0],
          leafSegments,
        });

    current.children.push({
      ...r,
      name: computedName || leafLabel,
    });
  }

  // Deterministic sort for readability: folders first (A→Z), then routes by method then path.
  const methodOrder: Record<string, number> = {
    GET: 1,
    POST: 2,
    PUT: 3,
    PATCH: 4,
    DELETE: 5,
    ALL: 9,
  };

  const sortNodeChildren = (folder: ApiFolder) => {
    folder.children.sort((a, b) => {
      const aIsRoute = (a as any).method !== undefined;
      const bIsRoute = (b as any).method !== undefined;
      if (aIsRoute !== bIsRoute) return aIsRoute ? 1 : -1;

      if (!aIsRoute && !bIsRoute) {
        return String((a as any).name).localeCompare(String((b as any).name));
      }

      const am = String((a as any).method);
      const bm = String((b as any).method);
      const byMethod = (methodOrder[am] ?? 99) - (methodOrder[bm] ?? 99);
      if (byMethod !== 0) return byMethod;
      return String((a as any).path).localeCompare(String((b as any).path));
    });

    for (const child of folder.children) {
      if ((child as any).children) sortNodeChildren(child as ApiFolder);
    }
  };

  sortNodeChildren(root);

  return root.children as ApiFolder[];
}
