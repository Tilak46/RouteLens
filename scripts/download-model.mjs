import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MODELS_DIR = path.resolve(__dirname, "..", "models");

export const MODEL_CATALOG = {
  "0.5b": {
    name: "Qwen2.5-Coder-0.5B-Instruct-Q4_K_M",
    fileName: "qwen2.5-coder-0.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-0.5b-instruct-q4_k_m.gguf",
    expectedBytes: 491400064,
  },
  "1.5b": {
    name: "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M",
    fileName: "qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
    expectedBytes: 1117409280,
  },
};

export async function ensureModel(modelKey = "0.5b") {
  const modelInfo = MODEL_CATALOG[modelKey] || MODEL_CATALOG["0.5b"];
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  const targetPath = path.join(MODELS_DIR, modelInfo.fileName);
  const tempPath = targetPath + ".download.tmp";

  if (fs.existsSync(targetPath)) {
    const stats = fs.statSync(targetPath);
    if (stats.size > 100_000_000) {
      console.log(`[Model] Found cached model: ${modelInfo.fileName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      return targetPath;
    }
  }

  console.log(`[Model] Downloading ${modelInfo.name} from Hugging Face...`);
  console.log(`[Model] Target: ${targetPath}`);

  const response = await fetch(modelInfo.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
  }

  const totalBytes = Number(response.headers.get("content-length") || modelInfo.expectedBytes);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

  let downloadedBytes = 0;
  const startTime = Date.now();
  let lastPrint = 0;

  const fileStream = fs.createWriteStream(tempPath);
  const reader = response.body.getReader();

  const nodeReadable = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          downloadedBytes += value.length;
          const now = Date.now();
          if (now - lastPrint > 250 || downloadedBytes === totalBytes) {
            lastPrint = now;
            const elapsedSec = (now - startTime) / 1000;
            const speedMBs = (downloadedBytes / (1024 * 1024) / (elapsedSec || 1)).toFixed(1);
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            const currentMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
            const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
            const etaSec = Number(speedMBs) > 0 ? (remainingBytes / (parseFloat(speedMBs) * 1024 * 1024)).toFixed(0) : "?";
            process.stdout.write(`\r[Model] ${currentMB}/${totalMB} MB (${percent}%) | Speed: ${speedMBs} MB/s | ETA: ${etaSec}s    `);
          }
          this.push(Buffer.from(value));
        }
      } catch (err) {
        this.destroy(err);
      }
    },
  });

  await finished(nodeReadable.pipe(fileStream));
  console.log(`\n[Model] Download complete! Finalizing file...`);

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
  fs.renameSync(tempPath, targetPath);

  const finalStats = fs.statSync(targetPath);
  console.log(`[Model] Ready at ${targetPath} (${(finalStats.size / 1024 / 1024).toFixed(1)} MB)`);
  return targetPath;
}

// Allow direct CLI invocation: node scripts/download-model.mjs [0.5b|1.5b]
const isMain = process.argv[1] && (
  process.argv[1].endsWith("download-model.mjs") ||
  process.argv[1].endsWith("download-model.js")
);

if (isMain) {
  const modelArg = process.argv[2] || "0.5b";
  ensureModel(modelArg)
    .then((p) => {
      console.log(`Successfully verified model: ${p}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Download failed:", err);
      process.exit(1);
    });
}
