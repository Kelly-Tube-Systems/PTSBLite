# Deploying PTSBLite

PTSBLite is a static site with two Pages Functions, both emailing sales through Resend:
`functions/api/contact.ts` sends the first-visit contact form
([ADR-0054](adr/0054-the-contact-form-emails-sales-through-a-pages-function.md)), and
`functions/api/bom.ts` sends each BOM PDF a visitor downloads
([ADR-0055](adr/0055-every-bom-download-is-emailed-to-sales.md)). Those two posts are the only
requests the page makes after load, and the app stores nothing outside the visitor's own browser.

Production is **https://ptsblite.kellytubesystems.com**, a CNAME to `ptsblite-2kg.pages.dev` in
Kelly's own DNS. The Pages project and the Resend account both belong to Kelly Tube Systems.

The same commit also ships as a Windows app, released on GitHub rather than Cloudflare. See
[The Windows app](#the-windows-app) below.

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

Leave it off Preview. Without it both Functions send nothing: the visitor is let in and the BOM
still downloads, so test submissions and downloads on a preview never reach sales.

To test Production without sales seeing it, add a plain variable `CONTACT_TO` with your own address
and redeploy. The contact and BOM emails go there instead of to sales. So does every real
visitor's, so delete it and redeploy as soon as the test is done.

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
serving it, so a policy violation will not show up locally. Nor does it run the Functions: `pnpm dev`
and `pnpm preview` answer `/api/contact` and `/api/bom` themselves and send nothing.

## The Windows app

PTSBLite also ships as an unsigned Windows app
([ADR-0051](adr/0051-ptsblite-also-ships-as-an-unsigned-windows-app.md)): the same page in an
Electron window, installed per user, with no contact form and no emails, so it works offline
([ADR-0056](adr/0056-the-windows-app-works-offline-and-sends-nothing.md)). Nothing about it
touches the website. The website's build does not include the desktop code and comes out
byte-for-byte what it was before the Windows app existed.

**Every push to `main` releases it.** The `windows` job in `.github/workflows/ci.yml` runs after
`verify` on a Windows runner. It builds the installer, runs the smoke test in `desktop/` against
the packaged app, and publishes a GitHub Release tagged `v<version>` with three files:
`PTSBLite-Setup.exe`, its `.blockmap`, and `latest.yml`. On a pull request it builds and tests
without publishing. If the job fails, nothing is released and installed copies stay where they
are.

**The version only goes up.** It is `major.minor` from `package.json` followed by the number of
commits on `main`, so the 300th commit releases `0.1.300`. An installed copy updates to any
release with a higher version, so never rewrite `main`'s history or lower `package.json`'s version.

**The download link never changes:**
https://github.com/Kelly-Tube-Systems/PTSBLite/releases/latest/download/PTSBLite-Setup.exe

**Installing.** The installer is not code-signed, so Windows shows "Windows protected your PC".
Choose *More info*, then *Run anyway*. It installs without further questions into
`%LOCALAPPDATA%\Programs\PTSBLite`, with no administrator prompt, and opens the app.

**Updating.** An installed copy checks this repository's releases when it starts and every four
hours after that. It downloads a newer version in the background, then asks, in one of the app's
own dialogs, whether to restart now or later. "Later" installs it the next time the app closes.
Updates are downloaded by the app itself, so SmartScreen does not ask again. With no connection
the check fails quietly.

**What must never change,** or every installed copy loses its design or stops updating:

- the page's origin, `app://ptsblite`, in `desktop/main.ts` (autosave lives there, as on the
  website);
- `name` in `package.json`, which names the folder the design is kept in, `%APPDATA%\ptsblite`;
- `appId` in `desktop/electron-builder.yml`;
- the `publish` block in `desktop/electron-builder.yml`, which is written into every copy as
  where it looks for updates.

**Guard release access.** Updates carry no signature, so anyone who can publish a Release on this
repository can ship code to every installed copy (ADR-0051).

### Building it locally

On Windows:

```sh
pnpm run desktop         # build and open the app, unpackaged
pnpm run package:desktop # build the installer into dist-desktop/release/
pnpm run test:desktop    # smoke-test the packaged app
```

A local package is versioned from `package.json` as it stands. The smoke test sets
`PTSBLITE_NO_UPDATES`, which stops the app checking for updates, and gives each run its own
profile. Without that variable, a packaged copy older than the latest release would download that
release and install it on your machine when it closes.
