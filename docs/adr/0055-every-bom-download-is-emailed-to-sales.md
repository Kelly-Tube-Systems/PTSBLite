# ADR-0055: Every BOM download is emailed to sales

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** [ADR-0053](0053-the-bom-says-who-it-was-prepared-for.md) where it said the
  details are sent nowhere. They now travel with each BOM to sales. The rest of it stands.

## Context

The client wants every BOM a visitor finalizes to reach Kelly's sales team, not only the visitor's
own downloads folder. ADR-0053 already prints who the BOM was prepared for on its first page, and
the contact form already emails sales through Resend from a Pages Function (ADR-0054). Chris
confirmed the trigger: pressing **Download PDF** in the Finalize dialog, every time, repeat
downloads included.

## Decision

**A second Pages Function sends the PDF.** `functions/api/bom.ts` takes the PDF as base64 JSON at
`/api/bom`, with its file name and the contact details the browser kept, and emails it to sales as
an attachment. The body lists the details the same way the contact email does, and the visitor's
address is the Reply-To. A browser that kept no details still sends its BOM, without either. It
shares the contact Function's Origin check, From address, `CONTACT_TO` override and key, and
answers the same way: 204 without a key, 502 when Resend refuses. The PDF is encoded in the page
rather than on Cloudflare, which keeps the Function's own work to a parse and a forward.

**It takes only a PDF, and only up to 10 MB.** Anything whose content does not start `%PDF-` is
refused, and so is a PDF over 10 MB. Resend's limit is 40 MB an email once base64, so the cap keeps
well clear of it while still being far larger than a BOM.

**The download never waits on the email.** The page hands the PDF to the browser first and posts it
afterwards without waiting. If the post fails, a message says the BOM downloaded but could not be
sent; nothing is retried and nothing stops the visitor.

## Consequences

- Every press of Download PDF on Production sends one email, so a visitor who downloads five times
  sends sales five copies.
- Previews have no key, so their downloads send nothing, as with the contact form.
- The endpoint accepts any PDF from the internet under the same forgeable Origin check as
  `/api/contact`. Cloudflare Turnstile remains the answer if it is abused.
- The Windows app ([ADR-0051](0051-ptsblite-also-ships-as-an-unsigned-windows-app.md)) has no
  `/api/bom` either, and would report every download's email as failed until it posts to the
  website.
- The BOM still carries no prices (ADR-0011).
