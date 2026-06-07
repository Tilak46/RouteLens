import { ipcMain } from "electron";

import { openRouterChat } from "../lib/ai/openrouter";
import { generateAiCommitMessage } from "../lib/git/aiCommitMessage";

export function registerAIHandlers() {
  ipcMain.handle(
    "ai:generate-commit-message",
    async (_event, diff: string): Promise<string> => {
      const safeDiff = String(diff ?? "").slice(0, 5000);
      const prompt = `You are an expert developer. Generate ONE concise conventional git commit message for the following diff.
Format: <type>(<scope>): <subject>
Rules:
- subject is <= 72 chars
- prefer type: feat|fix|chore|refactor|docs|test

Diff:
${safeDiff}`;

      return await openRouterChat({
        messages: [
          {
            role: "system",
            content:
              "You write excellent conventional commits. Output only the commit line.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        maxTokens: 64,
      });
    },
  );

  ipcMain.handle(
    "ai:generate-commit-message-for-project",
    async (
      _event,
      args: { projectPath: string; mode?: "staged" | "all" },
    ): Promise<string> => {
      return await generateAiCommitMessage({
        projectPath: args?.projectPath,
        mode: args?.mode ?? "staged",
      });
    },
  );

  ipcMain.handle(
    "ai:explain-log",
    async (_event, log: string): Promise<string> => {
      const safeLog = String(log ?? "").slice(0, 5000);
      const prompt = `You are an expert developer. Explain this error log in plain English, then give 3 concrete fixes.

Log:
${safeLog}`;

      return await openRouterChat({
        messages: [
          {
            role: "system",
            content:
              "You are a senior engineer. Be specific and actionable. No fluff.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        maxTokens: 350,
      });
    },
  );
}
