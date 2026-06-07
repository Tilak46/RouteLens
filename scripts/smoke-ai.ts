import dotenv from "dotenv";

dotenv.config();

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function main() {
  const { getAiProvider, getAiModel, openRouterChat } =
    await import("../src/main/lib/ai/openrouter");

  const provider = getAiProvider();
  const model = getAiModel();

  console.log(`AI provider=${provider} model=${model || "(none)"}`);

  if (provider === "none") {
    console.error(
      "No AI key configured. Set GEMINI_API_KEY (preferred) or OPENROUTER_API_KEY in devdash/.env",
    );
    process.exit(1);
  }

  if (provider !== "gemini") {
    console.error(
      "Gemini is not selected. If you want Gemini, set GEMINI_API_KEY=... (or GOOGLE_API_KEY=...) in devdash/.env and leave OPENROUTER_API_KEY empty.",
    );
  }

  const messages: Msg[] = [
    {
      role: "system",
      content:
        'Return ONLY valid JSON. No markdown. No extra text. Output must be exactly: {"ok":true}.',
    },
    { role: "user", content: "Say ok." },
  ];

  const started = Date.now();
  const out = await openRouterChat({
    messages,
    temperature: 0,
    maxTokens: 96,
  });

  const ms = Date.now() - started;
  const trimmed = String(out ?? "").trim();

  const tryExtractJson = (s: string) => {
    const t = String(s ?? "");
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return "";
    return t.slice(start, end + 1);
  };

  const jsonText = tryExtractJson(trimmed) || trimmed;
  let parsed: any = null;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // fall through
  }

  if (!parsed || parsed.ok !== true) {
    console.error(
      `AI smoke test failed. provider=${provider} model=${model} tookMs=${ms} output=${JSON.stringify(trimmed)}`,
    );
    process.exit(2);
  }

  console.log(
    `AI smoke test OK. provider=${provider} model=${model} tookMs=${ms}`,
  );
}

main().catch((e) => {
  console.error(String(e?.stack ?? e));
  process.exit(1);
});
