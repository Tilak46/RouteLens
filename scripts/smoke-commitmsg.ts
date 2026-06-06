import dotenv from "dotenv";

dotenv.config();

async function main() {
  const { generateAiCommitMessage } =
    await import("../src/main/lib/git/aiCommitMessage");

  const projectPath =
    process.argv.find((a) => a.startsWith("--projectPath="))?.split("=")[1] ||
    process.cwd();
  const mode = (process.argv
    .find((a) => a.startsWith("--mode="))
    ?.split("=")[1] || "all") as "staged" | "all";

  const msg = await generateAiCommitMessage({ projectPath, mode });
  console.log(msg);
}

main().catch((e) => {
  console.error(String(e?.stack ?? e));
  process.exit(1);
});
