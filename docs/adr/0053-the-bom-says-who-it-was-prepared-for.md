# ADR-0053: The BOM says who it was prepared for

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** [ADR-0052](0052-a-first-visit-leaves-contact-details-for-sales.md) where it kept
  only the fact that the contact form was submitted. The rest of it stands.

## Context

The client asked for the details a visitor gives the first-visit contact form to be printed in the
blank space on the first page of the BOM PDF, so a BOM that reaches Kelly's sales team says whose
it is. ADR-0052 had the browser keep only the fact that the form was submitted, so by the time a
visitor exports a BOM the details are gone. The site has no backend to hold them.

## Decision

**The browser keeps what the visitor submitted.** `ptsblite:contact:v1` in `localStorage` now
holds the details as JSON rather than the time they were submitted. They stay in the visitor's own
browser; nothing is sent anywhere.

**The BOM prints them under the parts list.** A "Prepared for" block on page 1 carries the name,
company, phone, email, industry, and any comments. Long comments are cut short with an ellipsis
rather than running into the disclaimer. A BOM exported without details leaves the space blank.

**A browser that submitted the form before this change is not asked again.** It stored only the
time, which still counts as submitted; its BOMs go without the block.

## Consequences

- The details now sit in `localStorage` until the visitor clears the site's data. Anyone using the
  same browser profile can read them there and on the BOMs it exports.
- Emailing the BOM to sales when a visitor finalizes a design is a separate step. It needs the same
  Cloudflare and Resend accounts as emailing the form (ADR-0052).
- The BOM still carries no prices (ADR-0011).
