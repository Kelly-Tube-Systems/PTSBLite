import { resolve } from "node:path";
import { defineConfig } from "vite";

// The Windows app's main process, electron-updater included, and its preload
// script, each bundled into one file beside the page. The installer then
// carries no node_modules at all, and the preload needs none: a sandboxed
// preload can load nothing but Electron. `pnpm run build:desktop` builds the
// page first, into renderer/ here.
export default defineConfig({
  build: {
    ssr: true,
    outDir: resolve(__dirname, "../dist-desktop/app"),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "main.ts"),
        preload: resolve(__dirname, "preload.ts")
      },
      output: { format: "cjs", entryFileNames: "[name].cjs" }
    }
  },
  ssr: {
    noExternal: true,
    external: ["electron"]
  }
});
