import { ApiVariable } from "../types/environments";

export type ScopedVariable = ApiVariable & {
  source: "global" | "environment";
  sourceName?: string;
};

/**
 * Resolves standard dynamic/faker system variables.
 */
export function resolveDynamicVariable(key: string): string | null {
  const k = key.trim().toLowerCase();
  switch (k) {
    case "$guid":
    case "$uuid":
      return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    case "$timestamp":
      return Math.floor(Date.now() / 1000).toString();
    case "$isotimestamp":
      return new Date().toISOString();
    case "$randomint":
      return Math.floor(Math.random() * 1000 + 1).toString();
    case "$randomemail":
      return `user${Math.floor(Math.random() * 10000)}@example.com`;
    default:
      return null;
  }
}

/**
 * Merges Globals and Backend-Dedicated variables into a single scoped lookup array.
 * Dedicated backend variables override Globals if keys collide.
 */
export function mergeScopedVariables(
  globalVars: ApiVariable[] = [],
  backendVars: ApiVariable[] = [],
  backendEnvName = "Environment"
): ScopedVariable[] {
  const map = new Map<string, ScopedVariable>();

  // 1. Add Globals first
  for (const v of globalVars) {
    if (v.key) {
      map.set(v.key, {
        ...v,
        source: "global",
        sourceName: "Globals",
      });
    }
  }

  // 2. Add / override with Backend-Dedicated variables
  for (const v of backendVars) {
    if (v.key) {
      map.set(v.key, {
        ...v,
        source: "environment",
        sourceName: backendEnvName,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Safe multi-pass string interpolation engine.
 * - Resolves nested variables (e.g. {{protocol}}://{{host}}:{{port}})
 * - Fixes JavaScript '$' regex backreference mangling using callback replacer
 * - Supports dynamic variables ($guid, $timestamp, etc.)
 */
export function interpolate(
  str: string,
  variables: ApiVariable[] = [],
  maxPasses = 5
): string {
  if (!str || typeof str !== "string") return str;

  // Build key-to-value map for fast lookup
  const valMap = new Map<string, string>();
  for (const v of variables) {
    if (v.enabled !== false && v.key) {
      const activeVal = v.currentValue ?? v.value ?? "";
      valMap.set(v.key, activeVal);
    }
  }

  let current = str;
  let passes = 0;

  // Recursive multi-pass substitution
  while (passes < maxPasses) {
    let replacedInThisPass = false;

    // Matches {{ key }}
    current = current.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawKey) => {
      const key = rawKey.trim();

      // Check dynamic system variable first ($guid, $timestamp, etc.)
      const dynamicVal = resolveDynamicVariable(key);
      if (dynamicVal !== null) {
        replacedInThisPass = true;
        return dynamicVal;
      }

      // Check defined environment/global variable
      if (valMap.has(key)) {
        replacedInThisPass = true;
        // String replacer returns literal value safely without interpreting $
        return valMap.get(key) ?? "";
      }

      // If key is undefined, leave raw {{key}} intact for user inspection
      return match;
    });

    passes++;
    if (!replacedInThisPass) break;
  }

  return current;
}
