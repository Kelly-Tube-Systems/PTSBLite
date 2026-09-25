import type { Platform } from "@/platform/types";
import { webPlatform } from "@/platform/web";

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
