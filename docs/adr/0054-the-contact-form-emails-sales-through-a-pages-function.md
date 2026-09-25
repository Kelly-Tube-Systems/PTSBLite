# ADR-0054: The contact form emails sales through a Pages Function

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** [ADR-0052](0052-a-first-visit-leaves-contact-details-for-sales.md) where it built
  the form before the email was wired. The rest of it stands.

## Context

Kelly Tube Systems now has its own Resend account and has handed over a send-only API key. The key
cannot go in the page, where every visitor could read it, and until now the site was nothing but
static files with `connect-src 'none'`.

## Decision

**A Cloudflare Pages Function sends the email.** `functions/api/contact.ts` takes the form as JSON
at `/api/contact` and sends a plain-text email to sales@kellytubesystems.com through Resend's HTTP
API, with the visitor's address as Reply-To. The key lives on Cloudflare as the `RESEND_API_KEY`
secret and never reaches the browser. The Function refuses a post from another site's page, and
anything that is not a completed form.

**A visitor is let in only once the details have gone.** A failed send keeps them at the form with
a message saying so, and they can try again. The client wants every visitor's details, and the form
never comes back once it has let someone in, so letting them in on a failure would lose that lead
for good. The cost is that a Resend outage, or an unverified sending domain, keeps new visitors out
until it is fixed. Returning visitors are unaffected.

**Without a key, nothing is sent and the visitor is let in.** Only Production has the secret, so
test submissions on previews never reach sales. `pnpm dev` and `pnpm preview` answer
`/api/contact` the same way, since the Function only runs on Cloudflare.

**The page may connect to its own site.** `connect-src` goes from `'none'` to `'self'`, which is
what the post needs and nothing more.

## Consequences

- Resend refuses to send from a domain it has not verified, so kellytubesystems.com must be
  verified in Kelly's Resend account before the secret goes on Production. Verifying adds a DKIM
  TXT record and a `send` subdomain's MX and SPF records; none of them touch the domain's own mail.
- The Function's own logs on Cloudflare are the only place a refused send is recorded. The visitor
  sees only that it failed.
- Nothing limits how often the endpoint is called beyond the Origin check, which a script can
  forge. Every email goes to the same sales address, so the harm is noise in that inbox and
  Resend's sending quota. Cloudflare Turnstile is the answer if that happens.
- The Windows app ([ADR-0051](0051-ptsblite-also-ships-as-an-unsigned-windows-app.md)) serves the
  page from a local origin, which has no `/api/contact`. It will need to post to the website's
  address instead, from a local origin the Function currently refuses, and it cannot let a first
  visitor in while offline.
