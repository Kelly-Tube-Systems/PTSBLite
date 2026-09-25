import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted because the production CSP allows no requests to other sites.
import "@fontsource-variable/geist/wght.css";
import App from "@/App";
import { desktopPlatform } from "@/platform/desktop";
import { webPlatform } from "@/platform/web";
import "@/styles/app.css";

// The Windows app is this page built with `--mode desktop` (ADR-0051). The
// website's build compares two constants here, so the desktop code is dropped
// from it and its output is exactly what it was before the Windows app.
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App platform={import.meta.env.MODE === "desktop" ? desktopPlatform() : webPlatform()} />
  </StrictMode>
);
