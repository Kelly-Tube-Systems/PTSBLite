# ADR-0014: PTSBLite is the only product

- **Status:** Superseded in part by
  [ADR-0051](0051-ptsblite-also-ships-as-an-unsigned-windows-app.md): PTSBLite also ships as an
  unsigned Windows app, so desktop packaging and release automation are back. PTSBLite is still the
  only product.
- **Date:** 2026-08-16

The internal Electron version of PTSBuilder has been removed from the project's scope indefinitely.
This repository now produces only PTSBLite: Kelly Tube Systems' public, consumer-facing web
app and marketing tool. The Electron host, commercial quote and pricing model, desktop packaging,
release automation, and two-product composition boundary are removed rather than kept dormant.

PTSBLite remains a static browser application with no prices or other commercial data. It
autosaves one design in the visitor's browser and exports a bill of materials. There is one Vite
entry point, one browser platform, and one deployment target.

This superseded ADR-0010 (one codebase, two products) and made ADR-0003 and ADR-0006 obsolete.
Those records, and the reverted ADR-0008, were deleted rather than kept as tombstones; git history
retains them. Gaps in the ADR numbering are deliberate.
