// ============================================================================
// Multi-Signal Consensus Collection Engine - Lexical NLP Tokenizer
// ============================================================================

import { toTitleCaseFromSlug } from "../../../shared/apiTree";

// Universal HTTP & RPC Action Verbs across multiple languages and architectures
export const KNOWN_VERBS = new Set([
  "get", "fetch", "find", "list", "search", "query", "read", "view", "show", "load", "retrieve", "index",
  "create", "add", "new", "insert", "post", "save", "store", "register", "signup", "init", "start", "initiate",
  "update", "edit", "patch", "modify", "replace", "put", "change", "set", "reset", "reorder", "touch",
  "delete", "remove", "destroy", "drop", "purge", "clear", "cancel", "trash", "prune", "abort",
  "close", "reopen", "archive", "restore", "submit", "approve", "reject", "lock", "unlock", "confirm", "complete",
  "send", "publish", "unpublish", "sync", "import", "export", "download", "upload", "presign", "run", "execute",
  "generate", "suggest", "schedule", "recommend", "build", "like", "reply", "chat", "summarize",
  "login", "logout", "refresh", "verify", "check", "confirm", "validate", "auth", "token", "connect", "disconnect",
  "enable", "disable", "pause", "resume", "retry", "invite", "accept", "decline", "share", "duplicate", "clone", "click"
]);

// Non-plural words ending in 's' that must never have trailing 's' stripped
export const NON_PLURAL_S_WORDS = new Set([
  "brand-os", "os", "status", "analytics", "metrics", "statistics", "access", "business", "address",
  "process", "pass", "loss", "canvas", "lens", "news", "series", "species", "sms", "gmb", "smm", "qr", "crm", "ai", "precedents", "stats"
]);

/**
 * Robust singularizer that preserves invariant English nouns, mass nouns, and acronyms
 */
export function singularizeNoun(word: string): string {
  if (!word) return "";
  const lower = word.toLowerCase().trim();
  if (NON_PLURAL_S_WORDS.has(lower) || lower.endsWith("ss") || lower.endsWith("ics") || lower.endsWith("-os")) {
    return word;
  }
  if (lower.endsWith("ies") && lower.length > 4) {
    return word.slice(0, -3) + "y";
  }
  if (lower.endsWith("es") && (lower.endsWith("shes") || lower.endsWith("ches") || lower.endsWith("xes") || lower.endsWith("zes"))) {
    return word.slice(0, -2);
  }
  if (lower.endsWith("s") && lower.length > 3 && !lower.endsWith("us") && !lower.endsWith("is") && !lower.endsWith("os")) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Normalizes entity naming for standard acronyms and canonical products
 */
export function formatEntityName(token: string): string {
  if (!token) return "";
  const lower = token.toLowerCase();
  if (lower === "gmb") return "GMB";
  if (lower === "smm") return "SMM";
  if (lower === "crm") return "CRM";
  if (lower === "qr") return "QR";
  if (lower === "ai") return "AI";
  if (lower === "mcp") return "MCP";
  if (lower === "a2a") return "A2A";
  if (lower === "fir") return "FIR";
  if (lower === "brand-os" || lower === "brand_os" || lower === "brand os") return "Brand OS";
  if (lower === "link-in-bio" || lower === "link_in_bio") return "Link In Bio";
  if (lower === "oauth") return "OAuth";
  if (lower === "youtube") return "YouTube";
  return toTitleCaseFromSlug(token);
}

/**
 * Splits a slug like "build-prompt", "generate-batch", "auto-reply-consent" into action verb and target noun
 */
export function parseCompoundAction(token: string): { verb: string; noun: string } {
  const parts = token.split(/[-_]+/).filter(Boolean);
  if (parts.length === 0) return { verb: "", noun: "" };
  if (parts.length === 1) {
    const p = parts[0].toLowerCase();
    if (KNOWN_VERBS.has(p)) return { verb: toTitleCaseFromSlug(p), noun: "" };
    return { verb: "", noun: formatEntityName(p) };
  }
  const first = parts[0].toLowerCase();
  if (KNOWN_VERBS.has(first)) {
    return {
      verb: toTitleCaseFromSlug(first),
      noun: formatEntityName(parts.slice(1).join(" ")),
    };
  }
  const last = parts[parts.length - 1].toLowerCase();
  if (KNOWN_VERBS.has(last)) {
    return {
      verb: toTitleCaseFromSlug(last),
      noun: formatEntityName(parts.slice(0, -1).join(" ")),
    };
  }
  return { verb: "", noun: formatEntityName(token) };
}

// Well-known singleton nouns that should not be isolated into orphan folders
export const SINGLETON_DOMAINS = new Map<string, string>([
  ["me", "User Profile"],
  ["profile", "User Profile"],
  ["avatar", "User Profile"],
  ["userinfo", "User Profile"],
  ["settings", "Settings"],
  ["config", "Configuration"],
  ["configuration", "Configuration"],
  ["preferences", "Preferences"],
  ["health", "System & Health"],
  ["db-health", "System & Health"],
  ["ping", "System & Health"],
  ["status", "System & Health"],
  ["ready", "System & Health"],
  ["live", "System & Health"],
  ["version", "System & Health"],
  ["info", "System & Health"],
  ["metrics", "System & Health"],
  ["robots.txt", "System & Health"],
  ["favicon.ico", "System & Health"],
  ["webhook", "Webhooks"],
  ["webhooks", "Webhooks"],
]);

/**
 * Splits camelCase, PascalCase, snake_case, and kebab-case into distinct lowercase word tokens.
 * e.g. "createUser" -> ["create", "user"], "api_v1_sendInvoice" -> ["api", "v1", "send", "invoice"]
 */
export function tokenizeLexicalString(s: string): string[] {
  if (!s) return [];
  const words: string[] = [];
  const normalized = s.replace(/[_\-./\\]+/g, " ");
  const parts = normalized.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|\s+/).filter(Boolean);
  for (const p of parts) {
    const w = p.trim().toLowerCase();
    if (w) words.push(w);
  }
  return words;
}

/**
 * Decomposes a segment or RPC action into [ActionVerb, EntityNoun]
 * e.g. "createUser" -> { verb: "create", noun: "user" }
 * e.g. "close" -> { verb: "close", noun: "" }
 * e.g. "tickets" -> { verb: "", noun: "ticket" }
 */
export function decomposeVerbNoun(token: string): { verb: string; noun: string } {
  const words = tokenizeLexicalString(token);
  if (words.length === 0) return { verb: "", noun: "" };

  if (words.length === 1) {
    const w = words[0];
    if (KNOWN_VERBS.has(w)) return { verb: w, noun: "" };
    return { verb: "", noun: singularizeNoun(w) };
  }

  // Check if first word is a verb: e.g. ["create", "user"], ["send", "whatsapp", "message"]
  if (KNOWN_VERBS.has(words[0])) {
    const verb = words[0];
    const nounWords = words.slice(1);
    const noun = nounWords.join(" ");
    return { verb, noun };
  }

  // Check if last word is a verb: e.g. ["ticket", "close"]
  if (KNOWN_VERBS.has(words[words.length - 1])) {
    const verb = words[words.length - 1];
    const nounWords = words.slice(0, words.length - 1);
    const noun = nounWords.join(" ");
    return { verb, noun };
  }

  return { verb: "", noun: words.join(" ") };
}

