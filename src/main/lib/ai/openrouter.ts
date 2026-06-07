import { geminiChat, getGeminiKey, getGeminiModel } from "./gemini";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export function getOpenRouterKey(): string {
  return String(process.env["OPENROUTER_API_KEY"] ?? "").trim();
}

export function getOpenRouterModel(): string {
  // Prefer the user's model, otherwise default to a currently-valid free model.
  return String(process.env["OPENROUTER_MODEL"] ?? "qwen/qwen3-4b:free").trim();
}

export function getAiProvider(): "gemini" | "openrouter" | "none" {
  if (getGeminiKey()) return "gemini";
  if (getOpenRouterKey()) return "openrouter";
  return "none";
}

export function getAiModel(): string {
  const provider = getAiProvider();
  if (provider === "gemini") return getGeminiModel() || "(auto)";
  if (provider === "openrouter") return getOpenRouterModel();
  return "";
}

function parseOpenRouterError(text: string): {
  message: string;
  code?: number;
} {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return { message: "" };
  try {
    const json = JSON.parse(trimmed) as any;
    const message = String(json?.error?.message ?? "").trim();
    const codeRaw = json?.error?.code;
    const code = typeof codeRaw === "number" ? codeRaw : undefined;
    return { message, code };
  } catch {
    return { message: trimmed.slice(0, 500) };
  }
}

function isModelNotFound404(args: { status: number; text: string }): boolean {
  if (args.status !== 404) return false;
  const { message, code } = parseOpenRouterError(args.text);
  if (code === 404) return true;
  return /no endpoints found for/i.test(message);
}

async function openRouterChatWithModel(args: {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    throw new Error(
      "AI not configured. Put OPENROUTER_API_KEY in devdash/.env (next to package.json) and restart DevDash.",
    );
  }

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // Optional but recommended by OpenRouter
      "HTTP-Referer": "https://devdash.local",
      "X-Title": "DevDash",
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature ?? 0.2,
      max_tokens: args.maxTokens ?? 256,
    }),
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "OpenRouter auth failed (401/403). Check OPENROUTER_API_KEY.",
      );
    }
    if (res.status === 429) {
      const detail = text ? ` ${text.slice(0, 500)}` : "";
      throw new Error(
        `OpenRouter request failed: 429 (model=${args.model}).${detail || " Rate limited."}`,
      );
    }

    const detail = text ? ` ${text.slice(0, 500)}` : "";
    throw new Error(
      `OpenRouter request failed: ${res.status} (model=${args.model}).${detail}`,
    );
  }

  let json: OpenRouterChatResponse;
  try {
    json = JSON.parse(text) as OpenRouterChatResponse;
  } catch {
    throw new Error(
      `OpenRouter returned invalid JSON (model=${args.model}). Response: ${text.slice(0, 500)}`,
    );
  }

  const out = String(json?.choices?.[0]?.message?.content ?? "").trim();
  if (!out) {
    const errMsg = String(json?.error?.message ?? "").trim();
    if (errMsg)
      throw new Error(
        `OpenRouter returned empty response (model=${args.model}): ${errMsg}`,
      );
    throw new Error(
      `OpenRouter returned empty response (model=${args.model}).`,
    );
  }

  return out;
}

export async function openRouterChat(args: {
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  // Prefer Gemini if configured; keep name for backwards compatibility.
  if (getGeminiKey()) {
    return await geminiChat({
      messages: args.messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
    });
  }

  const preferred = getOpenRouterModel();

  const debug = (() => {
    const a = String(process.env["OPENROUTER_DEBUG"] ?? "")
      .trim()
      .toLowerCase();
    const b = String(process.env["API_EXPLORER_AI_DEBUG"] ?? "")
      .trim()
      .toLowerCase();
    const asBool = (v: string) => v === "1" || v === "true" || v === "yes";
    return asBool(a) || asBool(b);
  })();

  // Small, conservative fallback list (free models change over time).
  // Only used if the preferred model returns a 404 "No endpoints found".
  const fallbackModels = [
    // A short list of currently-valid free models on OpenRouter.
    // Keep this list small to avoid excessive retries.
    "qwen/qwen3-4b:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    // Gemma sometimes rejects system/developer instructions depending on provider;
    // keep it last so others get a chance first.
    "google/gemma-3-12b-it:free",
  ];

  const tried: string[] = [];
  const modelsToTry = [
    preferred,
    ...fallbackModels.filter((m) => m && m !== preferred),
  ];

  let lastErr: unknown = null;
  for (const model of modelsToTry) {
    tried.push(model);
    if (debug) console.log(`[AI] OpenRouter: trying model=${model}`);
    try {
      return await openRouterChatWithModel({
        model,
        messages: args.messages,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
      });
    } catch (e: any) {
      lastErr = e;

      // Only fallback when the model is unavailable (404).
      const msg = String(e?.message ?? "");
      if (/OpenRouter request failed: 404/i.test(msg)) {
        if (debug)
          console.log(
            `[AI] OpenRouter: model unavailable (404), falling back...`,
          );
        continue;
      }
      // If response body was included, check for the specific "No endpoints" error.
      // (Some errors are wrapped with JSON.)
      if (/No endpoints found for/i.test(msg)) {
        if (debug)
          console.log(
            `[AI] OpenRouter: no endpoints for model, falling back...`,
          );
        continue;
      }

      if (/not a valid model id/i.test(msg)) {
        if (debug)
          console.log(`[AI] OpenRouter: invalid model id, falling back...`);
        continue;
      }

      if (/does not support chat completions/i.test(msg)) {
        if (debug)
          console.log(
            `[AI] OpenRouter: model doesn't support chat, falling back...`,
          );
        continue;
      }

      if (/developer instruction is not enabled/i.test(msg)) {
        if (debug)
          console.log(
            `[AI] OpenRouter: provider rejected system/developer instruction, falling back...`,
          );
        continue;
      }

      if (
        /OpenRouter request failed: 429/i.test(msg) ||
        /rate[- ]limited/i.test(msg)
      ) {
        throw new Error(
          "OpenRouter rate-limited (429). Wait a bit, then try again (or lower API_EXPLORER_AI_BATCH_SIZE / API_EXPLORER_AI_BUDGET_ROUTES).",
        );
      }

      throw e;
    }
  }

  throw new Error(
    `OpenRouter model not available. Tried: ${tried.join(", ")}. Last error: ${String(
      (lastErr as any)?.message ?? lastErr,
    )}`,
  );
}
