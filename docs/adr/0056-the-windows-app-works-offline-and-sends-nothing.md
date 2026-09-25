# ADR-0056: The Windows app works offline and sends nothing

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** [ADR-0052](0052-a-first-visit-leaves-contact-details-for-sales.md) where it said
  the Windows app shows the same contact form, and the Windows-app consequences of
  [ADR-0054](0054-the-contact-form-emails-sales-through-a-pages-function.md) and
  [ADR-0055](0055-every-bom-download-is-emailed-to-sales.md). Amends
  [ADR-0051](0051-ptsblite-also-ships-as-an-unsigned-windows-app.md), which otherwise stands.

## Context

ADR-0051 put PTSBLite in an Electron window for Windows, with no network request from the page.
The website has since gained a first-visit contact form and an email of every downloaded BOM to
sales (ADR-0052 to ADR-0055). Both go through Pages Functions on the website, so the Windows app
would have had to post across the internet to them, and could not let a first visitor in while
offline.

Chris decided the Windows app installs and runs on its own, with no internet access needed, and
without the form or the emails.

## Decision

**No contact form, no email.** The Windows app is the page built with `vite build --mode desktop`.
In that mode `main.tsx` hands the app `desktopPlatform()`, which reports the form as already
submitted, keeps no details, and sends nothing. Its BOMs leave the "Prepared for" space blank
(ADR-0053), as the website's do for a browser that kept no details.

**It needs no network to work.** Everything the page loads is in the installer. The main process
serves it from `app://ptsblite/` under a Content-Security-Policy with `connect-src 'none'`. The
one thing that goes online is the main process's update check, and without a connection it fails
quietly.

**The website's build does not change.** The mode is a constant, so the website's bundle drops the
desktop code and is byte-for-byte what it was before the Windows app.

## Consequences

- Sales learns nothing about who uses the Windows app or what they plan with it. Collecting that
  would mean holding the details while offline and sending them later, which reopens this decision.
- The Windows app's BOM says less than the website's: it never names who it was prepared for.
- The desktop page's policy is set in `desktop/main.ts`, not `web-public/_headers`. Loosening
  `connect-src` there would break the promise that it sends nothing.
- The Windows app still does everything else the website does, from the same commit (ADR-0051).
