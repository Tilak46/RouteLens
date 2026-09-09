import fs from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

function copyWasmAssetsPlugin() {
  return {
    name: "copy-tree-sitter-wasms",
    closeBundle() {
      const outMain = resolve(__dirname, "out/main");
      if (!fs.existsSync(outMain)) {
        fs.mkdirSync(outMain, { recursive: true });
      }

      // Copy tree-sitter.wasm
      const webTreeSitterWasm = resolve(__dirname, "node_modules/web-tree-sitter/tree-sitter.wasm");
      if (fs.existsSync(webTreeSitterWasm)) {
        fs.copyFileSync(webTreeSitterWasm, resolve(outMain, "tree-sitter.wasm"));
      }

      // Copy tree-sitter-wasms
      const wasmsOutDir = resolve(__dirname, "node_modules/tree-sitter-wasms/out");
      const targetWasmsDir = resolve(outMain, "tree-sitter-wasms");
      if (fs.existsSync(wasmsOutDir)) {
        if (!fs.existsSync(targetWasmsDir)) {
          fs.mkdirSync(targetWasmsDir, { recursive: true });
        }
        for (const file of fs.readdirSync(wasmsOutDir)) {
          if (file.endsWith(".wasm")) {
            fs.copyFileSync(resolve(wasmsOutDir, file), resolve(targetWasmsDir, file));
          }
        }
      }
    },
  };
}

export default defineConfig({
  main: {
    plugins: [copyWasmAssetsPlugin()],
    build: {
      rollupOptions: {
        external: ["node-llama-cpp", /^@node-llama-cpp\/.*/],
      },
    },
  },
  preload: {
    // Preload script config
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
          ghost: resolve(__dirname, "src/renderer/ghost.html"),
        },
      },
    },
    // THIS IS THE CRUCIAL FIX
    resolve: {
      alias: {
        // Tell Vite that '@/' maps to the 'src/renderer' folder
        "@": resolve(__dirname, "src/renderer"),
      },
    },
    plugins: [react()],
  },
});
