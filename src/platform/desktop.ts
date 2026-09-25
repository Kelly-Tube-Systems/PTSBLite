import type { Platform } from "@/platform/types";
import { webPlatform } from "@/platform/web";

/**
 * What desktop/preload.ts hands the page as `window.ptsblite`: the update the
 * main process has downloaded, and the way to install it (ADR-0051).
 */
export type DesktopBridge = {
  /** Resolves with the new version once an update has downloaded; never, if none does. */
  updateReady: () => Promise<string>;
  /** Close the app, install the downloaded update, and open it again. */
  installUpdate: () => Promise<void>;
};

declare global {
  interface Window {
    /** Set by the Windows app's preload script; absent in a browser. */
    ptsblite?: DesktopBridge;
  }
}

/**
 * The Windows app's services (ADR-0051): the browser's own storage and
 * download, and nothing sent anywhere (ADR-0056). There is no contact form to
 * get past, so no BOM says who it was prepared for, and no BOM is emailed.
 */
export function desktopPlatform(): Platform {
  const { session, savePdf } = webPlatform();
  return {
    session,
    savePdf,
    contact: {
      submitted: () => true,
      details: () => null,
      submit: () => Promise.resolve({})
    },
    emailBom: () => Promise.resolve({})
  };
}
