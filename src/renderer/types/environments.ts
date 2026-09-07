export type VariableType = "default" | "secret";

export interface ApiVariable {
  id: string;
  enabled: boolean;
  key: string;
  type?: VariableType;        // "default" or "secret"
  initialValue?: string;      // Base / shared value
  currentValue?: string;      // Current active local value
  value?: string;             // Backward-compatibility alias for currentValue
  description?: string;
}

export interface ApiEnvironment {
  id: string;
  name: string;
  projectId?: string | null;  // null = Globals; string = dedicated to backend project
  variables: ApiVariable[];
  createdAt?: number;
  updatedAt?: number;
}

export const GLOBALS_ENV_ID = "env_globals";

export function createNewVariable(key = "", value = "", type: VariableType = "default"): ApiVariable {
  return {
    id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    enabled: true,
    key,
    type,
    initialValue: value,
    currentValue: value,
    value,
  };
}

export function createDefaultGlobals(): ApiEnvironment {
  return {
    id: GLOBALS_ENV_ID,
    name: "Globals",
    projectId: null,
    variables: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Normalizes any legacy or imported variable object to ensure all fields exist.
 */
export function normalizeVariable(v: any): ApiVariable {
  const current = v.currentValue ?? v.value ?? "";
  const initial = v.initialValue ?? current;
  return {
    id: v.id || `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    enabled: v.enabled !== false,
    key: v.key || "",
    type: v.type === "secret" ? "secret" : "default",
    initialValue: String(initial),
    currentValue: String(current),
    value: String(current),
    description: v.description || "",
  };
}

/**
 * Normalizes an environment object ensuring its variables array is valid.
 */
export function normalizeEnvironment(env: any): ApiEnvironment {
  return {
    id: env.id || `env_${Date.now()}`,
    name: env.name || "Untitled Environment",
    projectId: env.projectId ?? null,
    variables: Array.isArray(env.variables) ? env.variables.map(normalizeVariable) : [],
    createdAt: env.createdAt || Date.now(),
    updatedAt: env.updatedAt || Date.now(),
  };
}
