// electron.vite.config.ts
import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
var __electron_vite_injected_dirname = "C:\\building-future\\devdash";
var electron_vite_config_default = defineConfig({
  main: {
    // Main process config
  },
  preload: {
    // Preload script config
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html"),
          ghost: resolve(__electron_vite_injected_dirname, "src/renderer/ghost.html")
        }
      }
    },
    // THIS IS THE CRUCIAL FIX
    resolve: {
      alias: {
        // Tell Vite that '@/' maps to the 'src/renderer' folder
        "@": resolve(__electron_vite_injected_dirname, "src/renderer")
      }
    },
    plugins: [react()]
  }
});
export {
  electron_vite_config_default as default
};
