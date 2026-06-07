import { GoogleGenerativeAI } from "@google/generative-ai";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getGeminiKey(): string {
  return String(
    process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"] ?? "",
  ).trim();
}

export function getGeminiModel(): string {
  return String(process.env["GEMINI_MODEL"] ?? "").trim();
}

async function listGeminiModels(
  apiKey: string,
): Promise<Array<{ name: string; supportedGenerationMethods?: string[] }>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
    apiKey,
  )}`;

  const res = await fetch(url, { method: "GET" });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `Gemini ListModels failed: ${res.status}. ${text.slice(0, 300)}`,
    );
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Gemini ListModels returned invalid JSON: ${text.slice(0, 300)}`,
    );
  }

  const models = Array.isArray(json?.models) ? json.models : [];
  return models
    .filter((m: any) => typeof m?.name === "string")
    .map((m: any) => ({
      name: String(m.name),
      supportedGenerationMethods: Array.isArray(m.supportedGenerationMethods)
        ? m.supportedGenerationMethods.map(String)
        : undefined,
    }));
}

function toModelId(name: string): string {
  const n = String(name ?? "").trim();
  if (n.startsWith("models/")) return n.slice("models/".length);
  return n;
}

async function pickGeminiModel(apiKey: string): Promise<string> {
  const models = await listGeminiModels(apiKey);
  const candidates = models.filter((m) =>
    (m.supportedGenerationMethods ?? []).includes("generateContent"),
  );

  if (candidates.length === 0) {
    throw new Error(
      "No Gemini models available for generateContent. (ListModels returned none with supportedGenerationMethods including generateContent.)",
    );
  }

  const score = (name: string) => {
    const s = name.toLowerCase();
    // Prefer fast/cheap-ish models first.
    if (s.includes("flash")) return 3;
    if (s.includes("lite")) return 2;
    if (s.includes("pro")) return 1;
    return 0;
  };

  candidates.sort((a, b) => score(b.name) - score(a.name));
  return toModelId(candidates[0].name);
}

function coalesceContents(
  messages: ChatMessage[],
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const out: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> =
    [];

  const push = (role: "user" | "model", text: string) => {
    const t = String(text ?? "").trim();
    if (!t) return;

    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: t });
      return;
    }

    out.push({ role, parts: [{ text: t }] });
  };

  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") push("user", m.content);
    else push("model", m.content);
  }

  return out;
}

export async function geminiChat(args: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error(
      "AI not configured. Put GEMINI_API_KEY in devdash/.env (next to package.json) and restart DevDash.",
    );
  }

  const requestedModel = getGeminiModel();

  const systemText = args.messages
    .filter((m) => m.role === "system")
    .map((m) => String(m.content ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  const contents = coalesceContents(args.messages);

  // Some models/providers are picky about system instructions.
  // We try systemInstruction first; if that fails, we retry by prefixing the first user message.
  const genAI = new GoogleGenerativeAI(apiKey);

  const run = async (
    modelId: string,
    useSystemInstruction: boolean,
    opts?: { forceJson?: boolean },
  ) => {
    const model = genAI.getGenerativeModel(
      useSystemInstruction && systemText
        ? { model: modelId, systemInstruction: systemText }
        : { model: modelId },
    );

    const effectiveContents = (() => {
      if (useSystemInstruction || !systemText) return contents;

      // Prefix system text into first user message.
      const copied = contents.map((c) => ({
        role: c.role,
        parts: c.parts.map((p) => ({ text: p.text })),
      }));

      const firstUser = copied.find((c) => c.role === "user");
      if (firstUser) {
        firstUser.parts.unshift({ text: systemText });
      } else {
        copied.unshift({ role: "user", parts: [{ text: systemText }] });
      }

      return copied;
    })();

    const result = await model.generateContent({
      contents: effectiveContents,
      generationConfig: {
        temperature: args.temperature ?? 0.2,
        maxOutputTokens: args.maxTokens ?? 256,
        // Many DevDash AI features expect strict JSON.
        // If a provider/model rejects this, we retry without it.
        ...(opts?.forceJson ? { responseMimeType: "application/json" } : {}),
      },
    });

    const out = String(result?.response?.text?.() ?? "").trim();
    if (!out)
      throw new Error(`Gemini returned empty response (model=${modelId}).`);
    return out;
  };

  const runWithJsonFallback = async (
    modelId: string,
    useSystemInstruction: boolean,
  ) => {
    try {
      return await run(modelId, useSystemInstruction, { forceJson: true });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/responsemimetype/i.test(msg)) {
        return await run(modelId, useSystemInstruction, { forceJson: false });
      }
      throw e;
    }
  };

  const modelNotUsable = (msg: string) =>
    /not found/i.test(msg) ||
    /is not supported for generatecontent/i.test(msg) ||
    /call listmodels/i.test(msg);

  const systemInstructionNotUsable = (msg: string) =>
    /systeminstruction|developer instruction is not enabled|not enabled/i.test(msg);

  try {
    const modelId = requestedModel || (await pickGeminiModel(apiKey));
    try {
      return await runWithJsonFallback(modelId, true);
    } catch (e1: any) {
      const msg1 = String(e1?.message ?? e1);
      if (systemInstructionNotUsable(msg1)) {
        return await runWithJsonFallback(modelId, false);
      }
      throw e1;
    }
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    // If the requested/default model isn't valid for this key/API version, auto-pick and retry once.
    if (modelNotUsable(msg)) {
      const fallbackModel = await pickGeminiModel(apiKey);
      try {
        return await runWithJsonFallback(fallbackModel, true);
      } catch (e2: any) {
        const msg2 = String(e2?.message ?? e2);
        if (systemInstructionNotUsable(msg2)) {
          return await runWithJsonFallback(fallbackModel, false);
        }
        throw e2;
      }
    }

    throw new Error(
      `Gemini request failed${requestedModel ? ` (requestedModel=${requestedModel})` : ""}: ${msg}`,
    );
  }
}
