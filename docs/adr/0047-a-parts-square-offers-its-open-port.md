# ADR-0047: The square a part stands in offers its open port to the terminal

- **Status:** Accepted
- **Date:** 2026-09-20
- **Card:** [Terminal: soft-lock to a blower's port with the cursor on the blower's square at floor
  height](https://trello.com/c/sR0xl0uL)
- **Builds on** [ADR-0035](0035-aiming-happens-on-the-floor.md), which put the aim on the floor and
  left the height to the placement plane.

The terminal has snapped to an open port under the cursor for as long as there have been ports to
snap to, and [the lift onto tube and bend ports](https://trello.com/c/97vUxYcU) made the snap reach
a run at height. The client came back to say that the half he wanted was still missing:

> When a blower is either not on the ground plane OR a "Remote blower" system is trying to be
> built, the terminal doesn't auto soft-lock to the available port **when the cursor is on the
> blower-occupied square at floor plane height**.

with, on a screenshot of a blower whose port sits up at 5 ft, what he expected instead:

> app should recognize that the terminal placement is likely at 5ft, connecting to the top of the
> blower

The snap was never the problem. A port is found by its landing cell, and the cursor only reaches
that cell once the placement plane is already at the port's height — so a blower five feet up, or
the open top of a riser, could be seated on only by someone who had reached for `[` and `]` first.
Aiming at the blower itself, from the floor, got nothing: that square is the blower's own, so the
placement was refused as occupied.

## The rule

**A terminal aimed at the square a part stands in is offered that part's nearest open port at or
above the aim, and goes to it.**

"Square" is the column, not the cell: the aim stays on the floor of the storey (ADR-0035) and the
square carries whatever height the port is at. A port belongs to the square its owner's opening
leaves *from*, so a blower's square offers its port whether that port faces up or sideways, and a
riser's square offers the open end five feet above the blower rather than the blower underneath it
— which is what makes the client's remote-blower build seatable from the floor.

Everything downstream is unchanged. The port still decides the facing, `terminalSeatCell` still
decides which of the two cells the 2 ft body is stored in (ADR-0027), and the ghost and the click
resolve the same seat, so what is previewed is what lands.

## What follows

- **A port below the aim is not on offer.** The plane is what the cursor aims along, so a port
  under it belongs to something the aim is already past. This is also the escape hatch: raise the
  plane above a part and its square is an ordinary square again.
- **`R` still gives up the port.** Turned off the port's heading the terminal is an ordinary
  placement on the square under the cursor, exactly as it is for a port the cursor is on.
- **A terminal can no longer be put down on the floor square beneath an open port.** That square
  now means "seat on the port", and the client asked for it to. Any neighbouring square still
  takes a free-standing terminal, and so does the same square with the plane raised past the part.
- **The lift is the terminal's alone.** A terminal is the part hung on something already standing;
  a blower is the part being stood somewhere. Pointing a blower at an occupied square still means
  what it always did — that square is taken — so nothing about placing blowers moves.
- **No engineering constraint moves.** This is which square the cursor means, not what a system
  may be built out of.
