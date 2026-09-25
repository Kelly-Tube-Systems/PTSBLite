# Deploying PTSBLite

PTSBLite is a static site with one Pages Function, `functions/api/contact.ts`, which emails the
first-visit contact form to sales through Resend
([ADR-0054](adr/0054-the-contact-form-emails-sales-through-a-pages-function.md)). That post is the
only request the page makes after load, and the app stores nothing outside the visitor's own
browser.

Production is **https://ptsblite.kellytubesystems.com**, a CNAME to `ptsblite-2kg.pages.dev` in
Kelly's own DNS. The Pages project and the Resend account both belong to Kelly Tube Systems.

## Cloudflare Pages project

Created through **Workers & Pages → Create → Pages → Connect to Git**. Not the Workers flow, which
the dashboard offers first and which needs a `wrangler.jsonc` this repository does not have.

| Setting | Value |
|---|---|
| Project name | `ptsblite` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `pnpm run build` |
| Build output directory | `dist` |
| Root directory | *(empty)* |

Environment variables, set for both Production and Preview:

```
NODE_VERSION = 24
PNPM_VERSION = 11.5.0
```

**`NODE_VERSION` is not optional.** Cloudflare's default build image ships an older Node than the
`^24` in `package.json`'s `engines`, and `pnpm install` refuses outright rather than warning. It is
a confusing failure because nothing in the log points at the version.

One secret, set for **Production only**, as an encrypted variable:

```
RESEND_API_KEY = <the send-only key from Kelly's Resend account>
```

Leave it off Preview. Without it the Function sends nothing and lets the visitor in, so test
submissions on a preview never reach sales.

**Verify the sending domain in Resend before adding the secret.** Resend refuses to send from
`kellytubesystems.com` until the DNS records its Domains page lists are in place. With the secret
set and the domain unverified, every send fails and no first-time visitor can get past the contact
form.

## Who can see what

Production is public, from `main`. Every push that passes the required `verify` check is live.

Preview deployments are **restricted** — they build for pull requests but are not publicly
reachable. That was a deliberate choice: previews are useful, since nobody had seen this UI in a
browser before it shipped, but a branch that has not been reviewed should not have a public URL.

## What the build does

`pnpm run build` runs `tsc --noEmit && vite build`, so a type error fails the deploy before
anything is published.

Pages builds `functions/` on its own, from the repository root; it is not part of `dist/`. The
Workers flow ignores that directory, which is one more reason the project must be a Pages one.

`web-public/_headers` is copied into the output. It carries the Content-Security-Policy and the
cache rules, and explains itself — including why `connect-src 'self'` is a statement of fact rather
than an aspiration.

## Before changing the hostname

**The hostname is `ptsblite.kellytubesystems.com`, and it is permanent.**

A visitor's design autosaves to `localStorage`, which is scoped to the origin
([ADR-0012](adr/0012-lite-persists-a-session-not-files.md)). Moving to another hostname makes every
stored design unreachable — silently, because the new origin simply has nothing in it. There is no
migration path and there is nothing to warn with. The same goes for anyone using the
`ptsblite-2kg.pages.dev` address directly: it serves the same build, but its designs are its own.

## What the deployed build calls itself

The short commit SHA — taken from `CF_PAGES_COMMIT_SHA` on Cloudflare and from `git rev-parse`
locally — is stamped onto every autosaved design as its `appVersion`. Nothing on screen shows it, so
identifying the build a stored design came from means reading the payload in `localStorage`.

## Running the same build locally

```sh
pnpm run build # into dist/
pnpm preview   # serve it on http://localhost:4173
```

`preview` serves the built output, not the dev server, so it is the closest thing to what
Cloudflare publishes. It does **not** apply `_headers` — the CSP is only enforced once Cloudflare is
serving it, so a policy violation will not show up locally. Nor does it run the Function: `pnpm dev`
and `pnpm preview` answer `/api/contact` themselves and send nothing.
