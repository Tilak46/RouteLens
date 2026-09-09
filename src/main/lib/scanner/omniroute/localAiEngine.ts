import fs from "node:fs";
import path from "node:path";
import type { Method } from "../../../types";
import type { FileCandidate, OmniRoute, OmniFramework } from "./types";

let llamaInstance: any = null;
let loadedModel: any = null;
let modelContext: any = null;
let chatSession: any = null;
let routeGrammar: any = null;
let isInitializing = false;

// Default model cache path
function getPossibleModelPaths(): string[] {
  const paths = [
    path.resolve(process.cwd(), "models", "qwen2.5-coder-0.5b-instruct-q4_k_m.gguf"),
    path.resolve(__dirname, "..", "..", "..", "..", "models", "qwen2.5-coder-0.5b-instruct-q4_k_m.gguf"),
  ];

  // If running inside Electron, also check userData
  try {
    const { app } = require("electron");
    if (app?.getPath) {
      paths.unshift(path.join(app.getPath("userData"), "models", "qwen2.5-coder-0.5b-instruct-q4_k_m.gguf"));
    }
  } catch {
    // Non-electron context (CLI / test script)
  }

  return paths;
}

export function findAvailableModelPath(): string | null {
  for (const p of getPossibleModelPaths()) {
    if (fs.existsSync(p)) {
      const stats = fs.statSync(p);
      if (stats.size > 100_000_000) {
        return p;
      }
    }
  }
  return null;
}

export function isLocalAiAvailable(): boolean {
  return findAvailableModelPath() !== null;
}

const RouteScanSchema = {
  type: "object",
  properties: {
    framework: {
      type: "string",
      description: "Detected framework: express, fastapi, gin, or custom",
    },
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
          },
          path: {
            type: "string",
            description: "Route URL path",
          },
          summary: {
            type: "string",
            description: "Brief endpoint description",
          },
          params: {
            type: "array",
            items: { type: "string" },
          },
          body: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["method", "path"],
      },
    },
  },
  required: ["framework", "routes"],
};

async function getOrInitLlamaSession() {
  if (chatSession) return chatSession;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return chatSession;
  }

  isInitializing = true;
  try {
    const modelPath = findAvailableModelPath();
    if (!modelPath) {
      throw new Error("No local model found. Download the model using scripts/download-model.mjs");
    }

    // Dynamic import to keep packaging clean
    const { getLlama, LlamaChatSession } = await import("node-llama-cpp");

    llamaInstance = await getLlama();
    loadedModel = await llamaInstance.loadModel({ modelPath });
    modelContext = await loadedModel.createContext({ threads: 6, contextSize: 4096 });
    routeGrammar = await llamaInstance.createGrammarForJsonSchema(RouteScanSchema);

    chatSession = new LlamaChatSession({
      contextSequence: modelContext.getSequence(),
      systemPrompt:
        "You are an expert backend API scanner. Extract all HTTP routes with their exact HTTP methods and URL paths from the given code. Resolve route group prefixes (e.g. group '/api/v1' with route '/users' produces '/api/v1/users'). Output strictly valid JSON complying with the schema.",
    });

    return chatSession;
  } finally {
    isInitializing = false;
  }
}

function stableId(file: string, method: string, routePath: string): string {
  const raw = `${file}|${method}|${routePath}`;
  return `omni_ai_${Buffer.from(raw).toString("base64url")}`;
}

export async function extractRoutesWithAI(candidate: FileCandidate): Promise<OmniRoute[]> {
  const session = await getOrInitLlamaSession();
  if (!session) return [];

  // Reset conversation history for fresh extraction
  session.resetChatHistory();

  // If file is very large, take the lines containing route indicators plus surrounding context
  let codeToSend = candidate.content.trim();
  if (codeToSend.length > 4000) {
    const lines = codeToSend.split("\n");
    const selectedLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        /\b(GET|POST|PUT|DELETE|PATCH|Group|Route|Mount|router|endpoint|api)\b/i.test(line) ||
        /@(Get|Post|Put|Delete|Patch|RequestMapping)\b/i.test(line)
      ) {
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length - 1, i + 3);
        for (let j = start; j <= end; j++) {
          if (!selectedLines.includes(lines[j])) selectedLines.push(lines[j]);
        }
      }
    }
    if (selectedLines.length > 0 && selectedLines.length < lines.length) {
      codeToSend = selectedLines.join("\n");
    }
  }

  const promptText = `Extract all HTTP routes from this ${candidate.language} code:\n\`\`\`${candidate.language}\n${codeToSend}\n\`\`\``;

  let rawResponse = "";
  try {
    rawResponse = await session.prompt(promptText, {
      grammar: routeGrammar,
      temperature: 0.1,
      maxTokens: 512,
    });
  } catch (err) {
    console.error(`[LocalAI] Generation error on ${candidate.relativePath}:`, err);
    return [];
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return [];
  }

  if (!parsed || !Array.isArray(parsed.routes)) {
    return [];
  }

  const detectedFramework = (parsed.framework?.toLowerCase() || "custom") as OmniFramework;
  const routes: OmniRoute[] = [];

  for (const r of parsed.routes) {
    if (!r.method || !r.path) continue;
    let cleanPath = r.path.trim();
    if (!cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;

    routes.push({
      id: stableId(candidate.filePath, r.method, cleanPath),
      framework: detectedFramework,
      method: r.method.toUpperCase() as Method,
      path: cleanPath,
      file: candidate.filePath,
      summary: r.summary || undefined,
      params: Array.isArray(r.params) ? r.params : undefined,
      body: Array.isArray(r.body) ? r.body : undefined,
      confidence: "high",
      source: "local_ai",
    });
  }

  return routes;
}
