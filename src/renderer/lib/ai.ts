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
