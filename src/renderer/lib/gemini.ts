// Backwards-compatible shim.
// Gemini has been replaced with OpenRouter (main-process IPC) so API keys never ship in the renderer bundle.

export const initGemini = (_apiKey: string) => {
  // no-op (kept to avoid runtime crashes if older code calls it)
};

export const generateCommitMessage = async (
  projectPath: string,
  mode: "staged" | "all" = "staged",
): Promise<string> => {
  return await window.api.aiGenerateCommitMessageForProject({
    projectPath,
    mode,
  });
};

export const explainLog = async (log: string): Promise<string> => {
  return await window.api.aiExplainLog(log);
};
