# ADR-0032: A pedestal stands on what is under it

- **Status:** Superseded by [ADR-0043](0043-the-client-junks-the-pedestal-blower.md), which removes the part; amended [ADR-0020](0020-a-pedestal-is-drawn-but-not-counted.md)
- **Date:** 2026-09-15

[ADR-0020](0020-a-pedestal-is-drawn-but-not-counted.md) defined the mast under a pedestal blower as
reaching the floor of the storey the blower stands on, and said so explicitly: *"It does not step
down onto an obstacle beneath it — a pedestal stands on the floor, and that is why the pedestal tool
is left out of `restOnObstacles`."*

That left one tool out of a behaviour the client likes. Aiming a plain blower or a terminal at an
impenetrable obstacle steps it onto the top surface, which is what a solid volume in a room is
usually built to be — a shelf. The pedestal blower stayed on the cell under the cursor, inside the
obstacle, and the click was refused. The client, 2026-09-15: *"The 'Blower auto elevates to the top
of an impenetrable object' machanic works great - care to make it work for 'blowers with pedestal'
too?"*

## Decision

**A mast stands on the surface below it, which is the storey's floor or the top of an impenetrable
obstacle under the blower.** `pedestalBaseElevation` answers what that surface is, and
`pedestalHeightAt` measures from it. The pedestal tool joins `restOnObstacles`, so aiming it at an
obstacle steps it onto the top exactly as the other two endpoints do.

The two halves have to move together. Stepping up without changing where the mast measures from
would put a mast through the obstacle that lifted the blower — the grid cells are claimed, so every
such placement would be refused, and the tool would look broken in a new way rather than fixed.

**Only impenetrable obstacles hold a mast up.** A penetrable one claims no grid cells and exists to
be built through ([ADR-0016](0016-penetrable-obstacles-claim-no-grid-cells.md)), so a mast passes it
as a tube does and carries on to the floor.

**The highest obstacle below the blower wins, not the first one off the floor.** A blower raised
above a stack stands on the top of the tallest thing under it, with the mast spanning the gap. What
is in that gap is still checked: a part in the column is refused, now worded as the pedestal not
reaching the surface below rather than not reaching the floor.

## Consequences

**ADR-0020's reasoning survives; one sentence of its rule does not.** The mast is still a property
of the blower rather than a part, still drawn but not counted, still claims grid cells, and zero is
still a legal height — now meaning a pedestal blower standing on a shelf as well as one on the
floor. Only "a pedestal stands on the floor" is replaced.

**`pedestalHeightAt` needs the design, not just its metadata.** Where the floor is was a question
about metadata; what is under a cell is a question about obstacles. `freePlacementFootprint` takes
the design for the same reason.

**A saved design's masts do not move.** `pedestalFeet` is stored on the part
([ADR-0020](0020-a-pedestal-is-drawn-but-not-counted.md)), so an existing design reloads with the
mast it was placed with. The new rule applies at placement, and placed parts cannot be moved.
