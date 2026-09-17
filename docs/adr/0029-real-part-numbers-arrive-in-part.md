# ADR-0029: Real part numbers arrive in part, and the bend is held back

- **Status:** Accepted; both open questions answered in [ADR-0030](0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md), and the tube number corrected by the client in [ADR-0036](0036-the-client-corrects-the-tube-part-number.md)
- **Date:** 2026-09-13

Kelly Tube Systems delivered a parts folder on 2026-09-10: seven STEP files and six logo images,
the answer to the long-standing request recorded in
[ADR-0013](0013-lite-publishes-placeholder-part-numbers.md). ADR-0013 anticipated the real catalogue
arriving all at once, at which point it would be "superseded rather than amended". It arrived
partially instead, so ADR-0013 is superseded **in part**: it still governs the entries below that
remain invented.

What the drop contained, by part number and KTS catalogue name:

| Part number | KTS name |
| --- | --- |
| `A444200` | 4 Inch Blower Assy for KEL2020 |
| `ALP78403` | 4 O.D. Alum. Tube |
| `ALP64401` | 4 O.D. Split Sleeve |
| `ALP08404` | 4 O.D. 48R 90º Alum. Bend |
| `A444942` | 4 Inch Terminal Assy w 3 Inch Insert |
| `A444940` | 4 Inch Terminal Body Fabrication For KEL2020 Assy |
| `AEA51032` | Fabrication Power Box for KEL2020 |

## Decision

**Three numbers go into `parts.json`: the blower, the tube and the split sleeve.** Those map one to
one onto an app part with nothing to choose. A bill of materials downloaded from PTSBLite now
carries real KTS numbers for them.

**`partNo` is replaced; `name` is not.** The catalogue names are recorded above and are the right
thing to quote when ordering, but they are long, and `name` is a viewport label — it is the button
in the parts palette, the text in the active-tool bar, and the row heading in the BOM. Replacing
"Blower Unit" with "4 Inch Blower Assy for KEL2020" would restyle three pieces of UI in the name of
a catalogue fix. The invented data that ADR-0013 identified as dangerous is the number, not the
label: a `partNo` "looks exactly as authoritative" as a real one, whereas "Blower Unit" does not
pretend to be a catalogue entry.

**Three entries keep their placeholders, deliberately.**

- **The bend.** `ALP08404` is a **4 ft centreline radius** part. This is not inferred from the
  "48R" in its filename — the STEP file declares its swept surface as
  `TOROIDAL_SURFACE(..., 1219.2, 50.8)` in millimetres, a major radius of 1219.2 mm (exactly
  48.000 in, 4.000 ft) about a minor radius of 50.8 mm (exactly 2.000 in, the 4 in O.D.). The app's
  bend radius is 3 ft, and per [ADR-0001](0001-engineering-constraints-are-authoritative.md) that is
  an authoritative spec fact, not a catalogue value: `CONTEXT.md` derives the 7-cell staircase in a
  4x4 bounding box from it, and the pathfinder and every placed corner follow. A vendor STEP file is
  a citable source, so the disagreement is real and the question is with the client. Until it is
  settled the bend keeps `BN-90-3R`, because printing `ALP08404` on a parts list generated from 3 ft
  geometry would have someone order bends that do not fit the layout they are holding.
- **The terminal.** Two candidate numbers arrived, `A444942` and `A444940`, and the app lists one
  terminal per station. Picking one would be a guess about which assembly KTS expects on an order.
- **The blower with pedestal.** The app has had a pedestal variant in the Build drawer since
  [ADR-0020](0020-a-pedestal-is-drawn-but-not-counted.md), and the drop has one blower number. The
  mast under it is already drawn but not counted, so the open question is narrow: whether the
  pedestal-mounted unit is a distinct catalogue item or `A444200` with mounting hardware that no
  parts list itemises.

`AEA51032` models nothing. PTSBLite has no power box, and inventing one is exactly the kind of
guessing `AGENTS.md` forbids.

## Consequences

**The catalogue is now mixed, which is worse for a reader than uniformly invented.** Before this
change every `partNo` was false and `CONTEXT.md` could say so in one row. Now `A444200` is real and
`TM-2020-S` is not, and they sit adjacent in the same file looking alike — the same hazard ADR-0026
noted when the parts started looking real while still being named wrong. `CONTEXT.md` and
`docs/baked-in-assumptions.md` therefore name the remaining three explicitly rather than describing
the file as placeholder data.

**The risk ADR-0013 records shrinks but does not go.** A downloaded BOM still contains three numbers
that identify nothing, with nothing in the document saying which three. The cheap middle option
ADR-0013 kept available — a notice on the PDF — is now cheaper to justify, because it would need to
disclaim only part of the list.

**The STEP files do not reopen the parts' appearance.** ADR-0026 settled that the parts are modelled
from marketing media as the final Lite appearance, at the client's explicit direction. Real geometry
arriving later does not reverse that decision, and nothing here re-models anything. The one thing
the CAD is used for is reading a dimension that contradicts an authoritative constant, which is
precisely what ADR-0001 asks for: a cited source.

## When to revisit

When the client answers either open question. The terminal and pedestal answers are a `parts.json`
edit. The bend answer is not: confirming 4 ft changes the bend footprint and therefore Auto-Build's
routing, bend spacing and every existing saved design, and needs its own ADR.
