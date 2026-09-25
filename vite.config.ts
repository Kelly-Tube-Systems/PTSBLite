import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

// PTSBLite is the repository's only application and deployment target.

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")) as {
  version: string;
  description: string;
  repository: { url: string };
};
const repoUrl = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

/**
 * What this build calls itself.
 *
 * The commit identifies the exact static build that is deployed. Cloudflare
 * Pages supplies `CF_PAGES_COMMIT_SHA`; a local build falls back to git, and a
 * build with neither says so rather than inventing a number.
 */
function buildId(): string {
  const fromPages = process.env.CF_PAGES_COMMIT_SHA;
  if (fromPages) return fromPages.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Stands in for functions/api/contact.ts, which only runs on Cloudflare. It
 * answers the contact form as a deployment without a Resend key does, sending
 * nothing, so a first visit to `pnpm dev` or `pnpm preview` gets past it.
 */
function contactStandIn(): Plugin {
  const answer: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== "POST" || req.url !== "/api/contact") return next();
    res.statusCode = 204;
    res.end();
  };
  return {
    name: "ptsblite-contact-stand-in",
    configureServer: (server) => void server.middlewares.use(answer),
    configurePreviewServer: (server) => void server.middlewares.use(answer)
  };
}

export default defineConfig({
  root: ".",
  publicDir: resolve(__dirname, "web-public"),
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(buildId()),
    __APP_DESCRIPTION__: JSON.stringify(pkg.description),
    __GITHUB_URL__: JSON.stringify(repoUrl)
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  plugins: [react(), contactStandIn()]
});
