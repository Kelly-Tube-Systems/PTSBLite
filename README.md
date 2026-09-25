# PTSBLite

PTSBLite is a public, consumer-facing marketing tool for Kelly Tube Systems. Visitors can lay out
a pneumatic tube system in a web browser, explore routing and validation, and export a bill of
materials.

It is a static web application with no backend. One design autosaves in the visitor's browser.

It also ships as a Windows app that works offline:
[download the installer](https://github.com/Kelly-Tube-Systems/PTSBLite/releases/latest/download/PTSBLite-Setup.exe).
It is not code-signed, so Windows shows "Windows protected your PC" the first time; choose *More
info*, then *Run anyway*. Installed copies update themselves.

## Development

Requires Node 24 and pnpm 11.

```sh
pnpm install
pnpm dev       # Vite development server
pnpm run check # formatting, lint, typecheck, and tests
pnpm run build # production build into dist/
pnpm preview   # serve the production build locally
```

On Windows, `pnpm run desktop` opens the Windows app and `pnpm run package:desktop` builds its
installer.

Deployment settings, and how the Windows app is released, are in
[docs/deploying.md](docs/deploying.md).

## Architecture

| Path | Contains |
|---|---|
| `src/domain/` | Pure geometry, placement, routing, validation, serialization, and BOM logic |
| `src/renderer/` | Three.js viewport and interaction helpers |
| `src/components/` | React UI and colocated stylesheets |
| `src/platform/` | Browser storage, downloads, and the contact form's post; the Windows app's version sends nothing |
| `src/data/` | The part catalog, and the Kel2020 geometry baked out of KTS's CAD |
| `tools/` | Hand-run authoring scripts, outside the app and its dependencies |
| `functions/` | The Cloudflare Pages Functions that email the contact form and each downloaded BOM to sales |
| `desktop/` | The Windows app: its Electron main process, installer config, and smoke test |
| `web-public/` | Production headers copied into the static build |
| `docs/adr/` | Decisions with lasting consequences |

## Controls

The app shows this list in a legend at the bottom-left of the viewport.

| Input | Action |
|---|---|
| Left click | Place |
| Right click | Erase |
| Left-drag | Pan |
| Right-drag | Orbit |
| Wheel | Zoom |
| `V` / `O` / `X` | Select / obstacle / erase |
| `R` / `Shift`+`R` | Rotate the placement ghost |
| `[` / `]` | Lower / raise the placement elevation |
| `Esc` | Cancel the active tool |
| `Ctrl`/`Cmd`+`Z` | Undo; add `Shift` to redo |
