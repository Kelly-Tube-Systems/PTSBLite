import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { desktopPlatform } from "@/platform/desktop";

/**
 * The Windows app's page (ADR-0051): the app, with its desktop services, and
 * beside it the offer of an update the main process has downloaded.
 */
export function renderDesktop(root: HTMLElement): void {
  createRoot(root).render(
    <StrictMode>
      <App platform={desktopPlatform()} />
      {window.ptsblite && <UpdatePrompt updates={window.ptsblite} />}
    </StrictMode>
  );
}
