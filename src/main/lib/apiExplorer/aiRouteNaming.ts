import crypto from "node:crypto";
import Store from "electron-store";

import type { ApiRoute } from "../../../types";
import {
  getAiModel,
  getAiProvider,
  getOpenRouterKey,
  openRouterChat,
} from "../ai/openrouter";
import { normalizePathSegments } from "../../../shared/apiTree";

type NameCacheSchema = {
  v: 1;
  names: Record<string, string>;
  updatedAt: Record<string, number>;
};

const cacheStore = new Store<NameCacheSchema>({
  name: "api-explorer-ai-names",
  defaults: { v: 1, names: {}, updatedAt: {} },
});

function cacheKey(method: string, path: string): string {
  return `${String(method).toUpperCase()} ${String(path)}`;
}

function looksHuman(name: string | undefined): boolean {
  const s = String(name ?? "").trim();
  if (!s) return false;
  if (s.includes(" ")) return true;
  if (/[A-Z]/.test(s)) return true;
  return false;
}

function stableHash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}

function extractJson(text: string): string {
  const t = String(text ?? "");
  const firstBrace = t.indexOf("{");
  const firstBracket = t.indexOf("[");
  const start =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);
  if (start === -1) return t.trim();

  const lastBrace = t.lastIndexOf("}");
  const lastBracket = t.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);
  if (end === -1 || end <= start) return t.slice(start).trim();
  return t.slice(start, end + 1).trim();
}

function readBudgetNumber(envKey: string, def: number): number {
  const raw = String(process.env[envKey] ?? "").trim();
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0) return v;
  return def;
}

export async function maybeApplyAiRouteNames(
  routes: ApiRoute[],
  args: {
    logs: string[];
    projectPath?: string;
  },
): Promise<ApiRoute[]> {
  const enabledRaw = String(process.env["API_EXPLORER_AI_NAMING"] ?? "")
    .trim()
    .toLowerCase();
  const enabled = enabledRaw
    ? enabledRaw === "1" || enabledRaw === "true" || enabledRaw === "yes"
    : Boolean(
        String(process.env["GEMINI_API_KEY"] ?? "").trim() ||
        String(process.env["GOOGLE_API_KEY"] ?? "").trim() ||
        String(process.env["OPENROUTER_API_KEY"] ?? "").trim(),
      );

  if (!enabled) return routes;

  const debugRaw = String(process.env["API_EXPLORER_AI_DEBUG"] ?? "")
    .trim()
    .toLowerCase();
  const debug = debugRaw === "1" || debugRaw === "true" || debugRaw === "yes";

  const forceRaw = String(process.env["API_EXPLORER_AI_FORCE"] ?? "")
    .trim()
    .toLowerCase();
  const force = forceRaw === "1" || forceRaw === "true" || forceRaw === "yes";

  const log = (msg: string) => {
    args.logs.push(msg);
    if (debug) console.log(msg);
  };

  const budgetRoutes = readBudgetNumber("API_EXPLORER_AI_BUDGET_ROUTES", 60);
  const batchSize = Math.max(
    1,
    Math.min(readBudgetNumber("API_EXPLORER_AI_BATCH_SIZE", 20), 40),
  );

  const provider = getAiProvider();
  const hasKey = provider !== "none";
  const model = getAiModel();
  log(
    `[AI] API naming: enabled=yes provider=${provider} key=${hasKey ? "yes" : "no"} model=${model} force=${force ? "yes" : "no"} budgetRoutes=${budgetRoutes} batchSize=${batchSize}`,
  );

  const cachedNames = (cacheStore.get("names") ?? {}) as Record<string, string>;
  const updatedAt = (cacheStore.get("updatedAt") ?? {}) as Record<
    string,
    number
  >;

  // Prefer naming the ugliest endpoints first (dynamic-only labels, '/', etc.)
  const needsAi = (r: ApiRoute) => {
    const n = String(r.name ?? "").trim();
    if (!n) return true;
    if (!force && looksHuman(n)) return false;

    const segs = normalizePathSegments(r.path);
    const isDynamic = (seg: string) => {
      const s = String(seg || "");
      if (!s) return false;
      if (s.startsWith(":")) return true;
      if (s.startsWith("[") && s.endsWith("]")) return true;
      return false;
    };
    const dynIndex = segs.findIndex(isDynamic);
    if (dynIndex === -1) return false;

    // Simple resource-by-id endpoints are already well-named by the built-in heuristic.
    // Example: /admin/:id
    if (!force && segs.length <= 2) return false;

    // Complex dynamic routes benefit most from AI.
    // Example: /fields/:fieldId/subfields/reorder
    return true;
  };

  const pending = routes
    .filter((r) => needsAi(r))
    .filter((r) => !cachedNames[cacheKey(r.method, r.path)]);

  if (debug) {
    const total = routes.length;
    const cachedTotal = routes.filter((r) =>
      Boolean(cachedNames[cacheKey(r.method, r.path)]),
    ).length;
    const candidates = routes.filter((r) => needsAi(r)).length;
    log(
      `[AI] API naming debug: totalRoutes=${total} candidates=${candidates} pending=${pending.length} cachedMatched=${cachedTotal}`,
    );
  }

  if (pending.length === 0) {
    // Apply cached names and exit
    const withCached = routes.map((r) => {
      const key = cacheKey(r.method, r.path);
      const cached = cachedNames[key];
      return cached ? { ...r, name: cached } : r;
    });
    log(`[AI] API naming: no pending routes (0 requests).`);
    return withCached;
  }

  const toRequest = pending.slice(0, budgetRoutes);
  const skipped = pending.length - toRequest.length;

  let requested = 0;
  let named = 0;

  // Prepare a quick project label for the prompt without leaking local paths.
  const projectLabel = args.projectPath
    ? `<project:${stableHash(args.projectPath)}>`
    : "<project>";

  // Clone routes so we can safely update names.
  const output = routes.map((r) => ({ ...r }));
  const byKey = new Map(output.map((r) => [cacheKey(r.method, r.path), r]));

  for (let i = 0; i < toRequest.length; i += batchSize) {
    const batch = toRequest.slice(i, i + batchSize);
    requested++;

    if (debug) {
      log(
        `[AI] API naming: requesting batch ${requested} size=${batch.length}`,
      );
    }

    const batchInput = batch.map((r) => ({
      key: cacheKey(r.method, r.path),
      method: String(r.method),
      path: String(r.path),
    }));

    const prompt = `You are helping name API endpoints for a sidebar (like Postman).

Return ONLY valid JSON: an array of objects [{"key": "METHOD /path", "name": "Human readable name"}, ...]

Rules for name:
- 3 to 7 words
- Title Case (e.g. "List Admins", "Get Admin Details")
- Do NOT include the HTTP method in the name
- If path is collection (e.g. /admin) and method is GET -> "List Admins"
- If path has :id or [id] and method is GET -> "Get Admin By Id"
- POST on collection -> "Create Admin"
- PUT/PATCH on :id -> "Update Admin"
- DELETE on :id -> "Delete Admin"
- If unsure, use a neutral but clear name.

Context: ${projectLabel}
Endpoints:
${JSON.stringify(batchInput)}`;

    let raw = "";
    try {
      raw = await openRouterChat({
        messages: [
          {
            role: "system",
            content:
              "You output strict JSON only. No markdown, no commentary, no code fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        maxTokens: 600,
      });
    } catch (e) {
      log(`[AI] API naming failed for a batch: ${String(e)}`);
      break;
    }

    const jsonText = extractJson(raw);
    let parsed:
      | Array<{ key?: string; name?: string }>
      | Record<string, string>
      | null = null;

    try {
      parsed = JSON.parse(jsonText) as any;
    } catch {
      log(
        `[AI] API naming returned non-JSON. Keeping defaults for this batch.`,
      );
      continue;
    }

    const pairs: Array<{ key: string; name: string }> = [];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const key = String((item as any)?.key ?? "").trim();
        const name = String((item as any)?.name ?? "").trim();
        if (!key || !name) continue;
        pairs.push({ key, name });
      }
    } else if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed)) {
        const key = String(k ?? "").trim();
        const name = String(v ?? "").trim();
        if (!key || !name) continue;
        pairs.push({ key, name });
      }
    }

    for (const { key, name } of pairs) {
      const node = byKey.get(key);
      if (!node) continue;
      if (!name || name.length > 80) continue;

      node.name = name;
      cachedNames[key] = name;
      updatedAt[key] = Date.now();
      named++;
    }
  }

  cacheStore.set("names", cachedNames);
  cacheStore.set("updatedAt", updatedAt);

  const cacheHits = output.filter((r) =>
    Boolean(cachedNames[cacheKey(r.method, r.path)]),
  ).length;

  // Apply cached names to anything we didn't request this run.
  for (const r of output) {
    const key = cacheKey(r.method, r.path);
    const cached = cachedNames[key];
    if (cached) r.name = cached;
  }

  log(
    `[AI] API naming: named=${named} requestedBatches=${requested} budgetRoutes=${budgetRoutes} skipped=${skipped} cachedTotal=${cacheHits}`,
  );

  return output;
}
