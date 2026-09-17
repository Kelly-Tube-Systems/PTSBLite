# ADR-0037: The control box is a parts-list line with no model

- **Status:** Accepted
- **Date:** 2026-09-17

The power box in the KTS parts folder of 2026-09-10 has been out of the app twice. ADR-0029 left
`AEA51032` out because "`AEA51032` models nothing. PTSBLite has no power box, and inventing one is
exactly the kind of guessing `AGENTS.md` forbids."
[ADR-0030](0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md) kept it out a second
time, because the client's answer that day named only the terminal and the blower as the parts
wanted from the drop.

Both decisions turned on the same thing: nobody had asked for the box. On 2026-09-17 the client
asked for it directly, on the board:

> On the bill of materials, for every blower unit, add another line for "control box" . 1:1

and, in the same message that corrected the tube number:

> there is another part number for a part that is not shown visually, and that is the external power
> supply otherwise referred to as control box. The part number for that is AEA751032

`AEA751032` is not the folder's `AEA51032` — there is an extra `7`. Asked which to print, the
client answered:

> hopefully the new card cleared this up, as for the number of mismatch, ship what I specified today

## Decision

**The control box is a catalog entry and a BOM row, and nothing else.** `parts.json` gains a
`controlBox` entry with part number `AEA751032`, and `bomRows` emits a row whose quantity is the
number of blower units in the design. It is not placeable, not drawn, not in the Build drawer, and
claims no grid cells. The client says it is "not shown visually", so nothing here invents a shape
for it — the reversal of ADR-0029 is about the parts list, not about modelling a part.

**One per blower unit, pedestal or not.** A blower on a pedestal is the same KTS blower unit
(ADR-0030), so it takes a control box like any other. The row carries the note "one per blower
unit", which is what makes a line for a part absent from the pictures readable.

**The client's number wins over the folder's.** Same reasoning as
[ADR-0036](0036-the-client-corrects-the-tube-part-number.md): the client is the authority on their
own catalog, and a direct answer about numbers is better evidence than a delivery of models. The
caution that still holds the bend back does not apply here. A wrong bend number ships geometry that
does not fit — `ALP08404` is a 4 ft radius part against the 3 ft radius the app draws — whereas the
two power box numbers describe the same box, so the worst case is a re-order rather than a system
that cannot be built. The client was shown the discrepancy and chose.

**A catalog entry may have no colour.** `PartCatalogEntry.color` is now optional, because the
control box is the first entry nothing renders. `PartThumbnail` draws nothing without one; it
already drew nothing for an unrecognised type, so this states the same fact in the type.

## Consequences

**`bomRows` is no longer one row per drawn part type.** It was, up to now: every row named
something visible in the viewport. A reader of a BOM PDF will find a Control Box line and no
control box in the pictures, which is why the row is noted rather than bare.

**ADR-0029 and ADR-0030 are superseded on this point only.** "`AEA51032` stays out" and
"`AEA51032` models nothing" describe the state before the client asked. Their reasoning is intact:
the box was kept out for as long as nobody had asked for it, and it arrives now because somebody
did. Neither ADR's other decisions are touched.

**The published catalog is real except for the bend, still.** `AEA751032` is a client-supplied
number, so it joins the sourced ones rather than the invented one. `BN-90-3R` remains the single
invented entry, subject to https://trello.com/c/KRcyIeAp.

## When to revisit

If the client says a design needs some other number of control boxes — one per system rather than
one per blower, say — the quantity is a one-line change in `bomRows`. If they later ask for the box
to be drawn, that is a new part with geometry, a footprint and grid cells, and a separate decision.
