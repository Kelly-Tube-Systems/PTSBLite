# ADR-0045: The blower-and-terminal pair is a placement, not a part

- **Status:** Accepted
- **Date:** 2026-09-19

The client, on the board:

> Please add a new build tool object: blower with terminal. It is simply the existing terminal and
> blower in its most common use case: together. behaves still as separate parts on BOM

Every other tile in the Build drawer is one catalog entry: a name, a real KTS part number, one
`Part` type and one BOM row. This one is not, and the client's own sentence says why — "behaves
still as separate parts on BOM". He is asking for a shortcut, not a product.

## Decision

**The pair is a tool, and nothing below the tool knows it exists.** A `blowerTerminal` `ToolId`
places a `BlowerPart` and a `TerminalPart` through `placeFreePart`, the same function the blower
and terminal tools use. After the click there is no pair: two ordinary parts with their own ids,
their own grid cells, their own ports and their own BOM lines. Erasing one leaves the other
untouched, autosave stores what it always stored, and `bomRows` needed no change at all — it
already counts blowers and terminals.

**No catalog entry, and therefore no part number of its own.** `parts.json` is unchanged. The
drawer tile reads both entries and prints both names and both numbers, because there is no third
number to print and inventing one is what ADR-0013 exists to prevent. The tool pill along the
bottom of the viewport is the one place that drops the numbers and shows only the two names: it is
already long enough for the client to have complained that the corner panels cover it, and a
number there is glanced at rather than read.

**"Together" means the terminal seated on the blower's open port.** That is where the app already
puts a terminal dropped onto a blower, so the pair is the arrangement the client has been building
by hand, saved a step. The terminal's 2 ft body fills the two cells in front of the blower, and the
pair's one free port is the far end of the terminal, facing the way the blower faces.

**The pair does not snap to an open port.** A blower has exactly one port and the terminal that
comes with it is already on it, so the pair arrives with its blower end closed and has nothing to
snap by. Its free end is three cells from the cursor, and swinging the unit round to bring that end
to a port would put the pair somewhere other than where it was clicked. So it is aimed with `R` and
placed where the pointer is, and Auto-Build joins it to the rest — which is how a design with an
endpoint at each end is built anyway. Nothing lights up as a landing cell for it, which is the same
thing the app says for the first blower of an empty design.

**Both parts go down, or neither.** The footprint is checked as a whole before either is placed, so
a pair refused for want of headroom leaves nothing behind and reports the terminal's blocked cells
rather than the free one under the cursor.

## Consequences

**A third `Part` type was not needed and is not there.** The grid invariant CONTEXT.md names — parts
agreeing with the grid — holds without new code, because both halves are registered by the existing
write boundary. The same is true of validation, topology, split sleeves, the PDF and the autosave
format: none of them changed, and none of them can tell a pair from two parts placed one after the
other.

**One click now creates two occupants.** `attemptPlacement` still takes one id, and the terminal's
is derived from it (`companionOccupantId`). Undo is unaffected — it snapshots designs, not
placements — so one undo takes the whole pair back, which is what a single click should do.

**The Build drawer has five tiles where it had four**, the pedestal blower having left it on the
same day ([ADR-0043](0043-the-client-junks-the-pedestal-blower.md)). The pair's tile is the only
one whose name and number lines carry two of each, so it is the one that ellipsises first — a
reason to keep watching the drawer's readability rather than a problem today.

## When to revisit

If the client says "together" means some other arrangement — the terminal beside the blower, or
remoted a fixed distance from it — that is a change to `blowerTerminalSeatCell` and nothing else.

If he asks for the pair to snap onto the end of a run, that is a real feature with a real question
behind it: which end of the unit lands on the port, and where the rest of it then sits relative to
the cursor. It is not a small change, and it should be asked about rather than guessed.

If Kelly Tube Systems ever sells a blower and terminal as one assembly with one part number, that
is a catalog entry and a different decision — this one deliberately does not create it.
