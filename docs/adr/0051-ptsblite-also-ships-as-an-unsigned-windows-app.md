# ADR-0051: PTSBLite also ships as an unsigned Windows app

- **Status:** Accepted
- **Date:** 2026-09-24
- **Supersedes:** [ADR-0014](0014-ptsblite-is-the-only-product.md) where it removed desktop
  packaging and release automation. Its other half, that PTSBLite is the repository's only product,
  stands.
- **Amended:** 2026-09-25 — [ADR-0056](0056-the-windows-app-works-offline-and-sends-nothing.md)
  leaves the contact form and the BOM email out of the Windows app, so it works offline.

## Context

ADR-0014 removed the Electron host together with the product it served: the internal PTSBuilder,
with its quotes, pricing, design files, and installers for three platforms. The desktop packaging
went because the product that needed it went, not because a desktop PTSBLite had been considered
and turned down.

A desktop version of PTSBLite is now in scope. Kelly Tube Systems has accepted that it will be
Windows-only and unsigned.

## Decision

**One product, two hosts.** The desktop app is PTSBLite in an Electron window: the same build,
catalog, validation and BOM as the website. It is not PTSBuilder coming back.
[ADR-0011](0011-lite-has-no-commercial-data-path.md) applies to it unchanged, and it gets no
feature the website lacks.

**Windows only.** No macOS or Linux build.

**Unsigned.** No code-signing certificate. A Windows certificate is bought and renewed every year,
and its private key must now live on a hardware token or in a cloud HSM, which adds a paid account
and a step to every release. All that buys is the removal of a warning dialog.

**Built and released by CI on every merge to `main`,** as a GitHub Release on this repository. The
merge that deploys the website also publishes a matching installer, so the two never drift apart.

**Installed copies update themselves.** The app checks this repository's GitHub Releases with
`electron-updater`, downloads a newer version in the background, and installs it. The installer is
NSIS, installed per user, which is the Windows target `electron-updater` can update without an
administrator prompt. The client has been told the app updates itself.

## Consequences

- Running the installer brings up SmartScreen's "Windows protected your PC". The user chooses
  *More info*, then *Run anyway*. SmartScreen builds reputation per file from download volume, and a
  new build on every merge never accumulates any, so treat the prompt as permanent for a fresh
  download. Updates the installed app fetches for itself do not bring it back, so each machine sees
  it once. A company whose IT policy blocks unsigned executables cannot install the app at all; that
  is the signal to revisit signing.
- A macOS build would reopen this decision rather than extend it. Gatekeeper refuses an unsigned Mac
  app on first open, recent macOS versions make the user approve it in System Settings, and
  Squirrel.Mac will not apply an unsigned update.
- Updates are not signature-checked. `electron-updater` verifies an update's checksum against the
  release's `latest.yml`, but with no certificate there is no publisher to verify, so anyone who can
  publish a Release on this repository can ship code to every installed copy. Guard release access
  accordingly.
- `electron-updater` currently skips the signature check on an unsigned build with a warning, and
  has announced that v28 will fail closed when there is no publisher name. Before upgrading past
  v27, confirm how v28 lets an unsigned app keep updating, or installed copies stop updating
  silently.
- The repository's address is written into every installed copy as its update feed. The first
  release should come from wherever the repository will live, not from an address it is about to
  leave.
- The desktop app's autosave is its own. A design started on the website does not appear in the
  desktop app, or the reverse ([ADR-0012](0012-lite-persists-a-session-not-files.md)). The desktop
  app's origin must stay the same across releases, for the same reason the website's hostname must.
- Cloudflare applies `web-public/_headers`; Electron does not. The desktop app sets its own
  Content-Security-Policy, and `connect-src 'none'` stays true there: the page makes no network
  request. The update check runs in Electron's main process, outside the page.
- The Electron host deleted in commit `285c499` is in git history. It was built for PTSBuilder
  (design files, quote export, installers for three platforms), so treat it as
  reference material, not something to revert.
