import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted because the production CSP allows no requests to other sites.
import "@fontsource-variable/geist/wght.css";
import App from "@/App";
import { webPlatform } from "@/platform/web";
import "@/styles/app.css";

// The Windows app is this page built with `--mode desktop` (ADR-0051), and
// renders from desktop.tsx instead. The website's build compares two constants
// here and drops the import, so none of the desktop code or its styles reach
// it, and its output is exactly what it was before the Windows app.
if (import.meta.env.MODE === "desktop") {
  void import("@/desktop").then(({ renderDesktop }) =>
    renderDesktop(document.getElementById("root") as HTMLElement)
  );
} else {
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <App platform={webPlatform()} />
    </StrictMode>
  );
}
