# ADR-0032: A pedestal stands on what is beneath it

- **Status:** Accepted
- **Date:** 2026-09-15
- **Supersedes:** the closing paragraph of
  [ADR-0020](0020-a-pedestal-is-drawn-but-not-counted.md)

A blower or terminal aimed at an impenetrable obstacle steps onto its top rather than being refused
for the cells the obstacle claims: the client built a shelf out of one and wanted to stand a blower
on it. A blower with a pedestal was deliberately left out of that, because its mast was measured to
the floor of the storey and would have run straight through the obstacle holding the blower up.

The client asked for the other half: "The 'Blower auto elevates to the top of an impenetrable
object' mechanic works great - care to make it work for 'blowers with pedestal' too?"

## The rule

**A pedestal blower climbs like the other two, and its mast lands on whatever it is standing on.**
The mast measures down to the highest impenetrable obstacle beneath the blower in its own column,
or to the floor of the storey when there is none. On the floor, nothing changes.

Two things are not a surface:

- **A penetrable volume**, which claims no grid cells and exists to be built through (ADR-0016).
  The mast passes through it as a tube does, down to the floor.
- **A part**. The mast is still refused when a blower, terminal, tube or bend is in the column
  beneath it, with the message that names the mast rather than the cell under the cursor. Standing
  on an obstacle is a mounting surface; standing on the pipework is not something to invent on the
  client's behalf.

## What this changes about ADR-0020

ADR-0020 ends "a pedestal stands on the floor, and that is why the pedestal tool is left out of
`restOnObstacles`". That sentence is now wrong, and only that sentence: everything else in ADR-0020
holds unchanged. The mast is still `BlowerPart.pedestalFeet`, still drawn but not counted, still
stored rather than derived, still claims its grid cells, and still shares the plain blower's KTS
part number (ADR-0030). A shorter mast is a shorter column of uncounted geometry, not a different
kind of thing.

## Where it lives

`pedestalBaseElevation` in `pedestal.ts` answers what the mast stands on, and `pedestalHeightAt`
takes the design rather than its metadata because obstacles are now part of the answer.
`resolvePlacementCell` in `placement-session.ts` sends `blowerPedestal` through `restOnObstacles`
with the other two tools.

The base lookup asks `design.obstacles` directly rather than reusing `solidTopAt` in
`obstacle-placement.ts`: that function answers which volume covers a given cell, for a part climbing
one step at a time, and the mast needs the highest volume below a cell. Reading the grid instead
would have been shorter and wrong — the grid cannot tell an obstacle from a part, and a part
beneath the blower is a refusal rather than a surface.
