# ADR-0043: The client junks the pedestal blower

- **Status:** Accepted
- **Date:** 2026-09-19
- **Supersedes:** [ADR-0020](0020-a-pedestal-is-drawn-but-not-counted.md) and
  [ADR-0032](0032-a-pedestal-stands-on-what-is-under-it.md), which describe a part that no longer
  exists

## Context

The pedestal blower entered the app on the client's own request: a fifth item in the Build drawer,
a blower that grows straight tubing under it as it is raised off the floor. ADR-0020 decided how to
model the mast — a property of the blower rather than a part, drawn but counted nowhere — and
ADR-0032 later amended what the mast measures down to, after the client asked for the step-up onto
an obstacle to cover the pedestal tool as well. ADR-0030 gave the unit its real KTS number.

On 2026-09-19 the client withdrew it:

> "blower with pedestal" has been junked, please remove.

— Nick Gray, Kelly Tube Systems, on the board, 2026-09-19.

This is the same shape of event as Terminal 1 flush against the blower (ADR-0019): the client
correcting the product rather than us discovering a bug. Kelly Tube Systems junked the hardware, so
the app has nothing to draw. It is recorded here rather than deleted quietly, because the part was
specified, sourced and numbered, and a later reader finding `pedestalFeet` in an old design file or
`blowerPedestal` in an old ADR needs to know why it went.

## Decision

The pedestal blower comes out of PTSBLite entirely.

- The `blowerPedestal` tool, its Build drawer card and its catalog entry are gone. The catalog now
  stocks one blower, `A444200` — the number itself is untouched, because it was always the plain
  unit's number too (ADR-0030).
- `BlowerPart.pedestalFeet` is gone, and with it `domain/pedestal.ts`, the mast's grid cells, its
  mesh, its thumbnail and the "n on a pedestal" note on the BOM's blower row.
- The blower row and the control box row are unchanged in every other respect: one control box per
  blower unit, 1:1 (ADR-0038).

**A design saved with a pedestal blower still opens.** `pedestalFeet` in a stored payload is read
and discarded, so the unit comes back as a plain blower on the square it was placed on, and the
column beneath it is free. Refusing such a design would be the worse failure: the browser autosave
is the only copy a visitor has, and the field describes mounting hardware rather than where the
blower is.

## Consequences

- Uncounted geometry no longer exists in the model. ADR-0020's reasoning — that a piece of hardware
  which is drawn but not counted belongs as a property of the part it mounts, never as a `TubePart`
  carrying a flag — is the part worth keeping if a hanger or a wall mount is ever asked for.
- The step-up onto an impenetrable obstacle stays exactly as it is for the blower and the terminal.
  What ADR-0032 removed was a special case, not a rule: nothing in it survives the part's removal.
- A blower is one thing again, which is one fewer tool, one fewer catalog key and one fewer branch
  in every placement, footprint and BOM query.
- If the client brings the pedestal back, this ADR and ADR-0020 are the design; the code is a
  revert of one commit.
