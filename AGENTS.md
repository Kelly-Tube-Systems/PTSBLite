# Working on PTSBLite

Read [`CONTEXT.md`](CONTEXT.md) before changing anything under `src/domain/`. It defines the
vocabulary and identifies which engineering constraints are authoritative.

PTSBLite is the repository's only product
([ADR-0014](docs/adr/0014-ptsblite-is-the-only-product.md)); the README says what it is. It runs
in the browser and as an unsigned Windows desktop app
([ADR-0051](docs/adr/0051-ptsblite-also-ships-as-an-unsigned-windows-app.md)). Do not add a macOS
or Linux build, code signing, pricing, quotes, customer data, tax, or other commercial
functionality. The one exception is the first-visit contact form
([ADR-0052](docs/adr/0052-a-first-visit-leaves-contact-details-for-sales.md)).

## Commands

```sh
pnpm run check  # format:check + lint + typecheck + test, in CI order
pnpm run format # fix formatting
pnpm dev        # browser development server
pnpm run build  # production build into dist/
pnpm preview    # serve the production build
pnpm run test:e2e # Playwright smoke suite against the production build (real Chromium)
```

happy-dom has no WebGL, downloads, or meaningful storage behavior. `pnpm run test:e2e` covers the
basics in a real browser — boot, render, place, autosave/restore, PDF export — and CI runs it after
the build. Still check the production build by hand when your change is visual or outside what the
smoke suite exercises.

Every PR must leave `pnpm run check` green.

## kardboard Sessions

A kardboard Session's acceptance command is:

```sh
pnpm install --frozen-lockfile && pnpm run check && pnpm run build
```

Passing means Prettier reports every file formatted, ESLint and `tsc` print nothing, every Vitest
file passes, and Vite ends with `✓ built`; the chunk-size warning is expected. It needs Node 24;
pnpm switches itself to the version in `packageManager`. The container has no browser, so skip
`pnpm run test:e2e` — the `verify` check on the pull request runs it.

Cloudflare Pages builds every pull request and comments its Preview URL on it. Link that URL on
the card. Previews are restricted rather than public ([docs/deploying.md](docs/deploying.md)).

## The three things most likely to be wrong

**1. Authoritative spec versus placeholder data.** The 300 ft centerline cap, 6 ft tube stock,
90° bends at 3 ft radius, and 1 cell = 1 ft come from the real PTS specification. Do not change them
without a cited source. Terminal 1 flush against the blower was on this list and should not have
been — the client withdrew it
([ADR-0019](docs/adr/0019-a-valid-system-has-a-blower-at-each-end.md)), which is the process working:
the rule was flagged, questioned, and sourced rather than quietly edited. The 3 ft bend radius went
through the same process — the bend KTS shipped is a 4 ft radius, the client was asked, and kept
3 ft ([ADR-0030](docs/adr/0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md)).
Part *names* are ours; part *numbers* are real KTS numbers, every one of them, taken from the
client's own list rather than from the parts drop where the two disagree
([ADR-0036](docs/adr/0036-the-client-corrects-the-tube-part-number.md),
[ADR-0037](docs/adr/0037-the-bend-takes-the-clients-number-on-his-say-so.md),
[ADR-0038](docs/adr/0038-the-control-box-is-a-parts-list-line-with-no-model.md)). See
[ADR-0001](docs/adr/0001-engineering-constraints-are-authoritative.md).

User-facing copy must interpolate engineering constants rather than restating them.

**2. PTSBLite cannot express money.** `BomRow` has no price, the catalog loader rejects
`unitPrice`, and the UI tests assert no money reaches the screen. The application exports a BOM,
never a quote. See [ADR-0011](docs/adr/0011-lite-has-no-commercial-data-path.md).

**3. `parts` and `obstacles` must agree with `grid`.** `design-state.ts` is the write boundary. Use
`addPart`, `addObstacle`, `replacePart`, `removePart`, or `removeObstacle` for one change, and
`designFromScene` or `reconstructDesign` when rebuilding a whole design. `DesignState` exposes
read-only lists and a read-only grid; do not cast around that boundary. Call
`expectGridMatchesDesign` after operations that add or remove an occupant. Parts are strict;
impenetrable obstacles union, clip to the build area, and may overlap a part so validation can
report it. Penetrable obstacles claim no grid cells at all. That is what lets tubes route through
them (ADR-0016).

## Layout

The architecture table in [README.md](README.md#architecture) maps the directories;
[CONTEXT.md](CONTEXT.md) explains the layering in detail. Most tests live in `src/domain/`.

## Conventions

- Prettier and ESLint are authoritative.
- Component styling belongs in a colocated `Component.css`, never a `<style>` block. Use inline
  styles only for runtime values CSS cannot know. See [ADR-0009](docs/adr/0009-component-styling-lives-in-stylesheets.md).
- Commit subjects are imperative and sentence case, with a body explaining why.
- `main` is protected and requires the `verify` check. Work goes through a PR.
- Do not add a dependency, abstraction, or test without a concrete need.
- pnpm 11 reads settings from `pnpm-workspace.yaml`, not `package.json`.
- `pnpm audit` is expected to be clean.
- Record decisions with lasting consequences as ADRs.

## Before inventing behavior

The supported browsers, absence of money, BOM export, and browser autosave are decided. Questions
such as station count, moving placed parts, and the real catalog remain open. Do not guess answers
that only Kelly Tube Systems can provide.

Keep [`docs/baked-in-assumptions.md`](docs/baked-in-assumptions.md) current: it records what the
current model cannot express. Scoped features are tracked on the kardboard board, not in this
repository.
