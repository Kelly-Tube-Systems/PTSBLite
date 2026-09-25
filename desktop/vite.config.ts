import { resolve } from "node:path";
import { defineConfig } from "vite";

// The Windows app's main process, electron-updater included, bundled into one
// file beside the page. The installer then carries no node_modules at all.
// `pnpm run build:desktop` builds the page first, into renderer/ here.
export default defineConfig({
  build: {
    ssr: resolve(__dirname, "main.ts"),
    outDir: resolve(__dirname, "../dist-desktop/app"),
    emptyOutDir: false,
    rollupOptions: {
      output: { format: "cjs", entryFileNames: "main.cjs" }
    }
  },
  ssr: {
    noExternal: true,
    external: ["electron"]
  }
});
