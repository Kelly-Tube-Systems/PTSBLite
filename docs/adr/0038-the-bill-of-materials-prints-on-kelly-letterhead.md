# ADR-0038: The bill of materials prints on Kelly Systems letterhead

- **Status:** Accepted, amended
- **Date:** 2026-09-17
- **Amended:** 2026-09-18 — the picture pages tile the logo instead of stamping the name. See
  "What the pages of pictures carry" below.

The client asked for the first page of the exported PDF to carry his own branding:

> The first page of the PDF version of the bill of materials needs to be redesigned to include more
> Kelli branding. My initial idea is to have the logo at the top center, and the "don't Carey" image
> as the footer, and maybe adding other elements to give it a very "official" look.

The page he is describing is the parts list. It had no branding at all: a title, the room, the
table, and a line naming the tool that produced it.

## What the page carries now

- The **Kelly Systems wordmark**, centred at the head of the sheet, over a rule of the accent green
  — thick over thin, which is what makes a printed sheet read as issued stationery.
- The **"Don't carry it... Kelly it." banner** across the foot, the artwork the Quick Start Guide
  already shows, which is the one he asked for by name.
- The column headings on a **washed green band**. That is the "other element": enough to read as a
  ruled form, and the only change inside the table's own area.

The rows are untouched — same descriptions, same part numbers, same quantities, and no prices. The
document is a bill of materials and never a quote ([ADR-0011](0011-lite-has-no-commercial-data-path.md)).
"Other elements" is our judgement rather than his instruction, so it stops at furniture: nothing
was invented that a reader could mistake for data, no document number, no issuing address, no
revision (see `docs/baked-in-assumptions.md` on why there is no revision to print).

The pages of pictures carry the watermark decided on the same day and get none of the letterhead.
Two marks on one page is one too many, and the parts list is the page people work from.

## What the pages of pictures carry

**Amended 2026-09-18.** The watermark shipped as the words "KELLY SYSTEMS" typeset once across the
diagonal, a SAMPLE stamp saying Kelly Systems instead. The client asked for the real thing:

> this is good but can we make it the actual logo? And could we also make it smaller to fit multiple
> on the screen, similar to the background of the build area?

So the mark is now the wordmark artwork itself, at 150 pt across, repeated in the artwork's own
brick course — the 2016 x 1040 tile of `kelly-systems-watermark.svg`, whose rows sit 520 apart with
every other row shifted half a tile — laid out from the middle of the sheet so the marks the edges
cut through are cut evenly on both sides. That is the pattern the viewport already tiles behind the
build area, which is the comparison he drew.

It is the same paths the masthead fills, so the tiling cost nothing but a loop: `drawWordmark` in
`pdf-typesetting.ts` draws one mark at a width, and the masthead and the watermark are both callers.
The opacity is unchanged at 0.14, which was chosen to read over both the near-black pictures and
white paper, and it is one constant to revise when he has the page in front of him.

## The wordmark is baked path data, not an image

`src/data/kelly-systems-wordmark.ts` holds the mark as SVG path data in its own 1316 x 158 box,
generated from `src/assets/kelly-systems-watermark.svg` by `tools/bake-kelly-wordmark.mjs`.

This follows [ADR-0034](0034-the-units-carry-the-kel2020-wordmark.md), where the KEL2020 decal
became path data for the renderer: an outline stays sharp at any size the document prints or zooms
to, where a raster of a masthead has one resolution and is wrong on either side of it.

It is a bake rather than an import because the artwork is a watermark *tile*. It lays the mark out
three times through `<use>`, so one copy has to be lifted out of the `<symbol>`; and most of the
mark sits inside a `<g transform="translate(0,158) scale(0.01,-0.01)">`, the signature of a traced
outline, whose flip and scale `pdf-lib` has no way to apply. The bake folds that transform into the
coordinates. It is hand-run, like the CAD bake beside it
([ADR-0033](0033-the-blower-and-terminal-come-from-kts-cad.md)), and `--svg` writes a single mark
back out so the result can be checked against the artwork by eye.

The cost is that the same artwork now exists twice: as the tile the viewport masks, and as the paths
the PDF fills. They are kept in step by re-running the bake, not by editing the generated file.

## The banner is inlined at build time

The footer artwork is a photograph-like PNG with an illustration in it, so it stays an image. Its
bytes reach the document through a Vite `?inline` import rather than a fetch: `bom-pdf.ts` *is* the
document, and a PDF that has to wait on a network round trip for its letterhead is a PDF that can
fail to download. The same import works unchanged under Vitest, so the tests exercise the real
artwork.

## Consequences

- The parts list starts about 46 pt lower down the page. The table has at most a dozen rows and the
  document has never paginated it, so nothing is displaced.
- Brand decisions are the client's to revise. He has said he wants to see the page before judging
  it, and the layout constants sit together at the top of `bom-pdf.ts` for that reason.
