# ADR-0035: Aiming happens on the floor, and elevation lifts the result

- **Status:** Accepted
- **Date:** 2026-09-17
- **Supersedes the behaviour shipped for** [the ghost/landing mismatch](https://trello.com/c/LRgC3V3j)
  (PR #206)

The client reported that a part placed at height landed on a different square from the one the
ghost stood on: aim at a square, press `]`, click, and the part went three or four squares away.

The cause was that the pointer cast onto a plane raised to the placement height. Seen from the
camera, a raised plane meets a still pointer nearer than the floor does, so the square under the
pointer changed as the height changed. The ghost was drawn from the old square and the click picked
afresh, so the two disagreed.

That was fixed by re-picking under the pointer whenever the plane moved, which made the ghost and
the click agree — by moving both. The client rejected it:

> I don't love this solution. It feels clunky. Why can't it be solved to behave like this: user
> elevates an object, and when that object is then "placed" by the user, it retains its x/y
> position. The current solution "fixed" the problem in the opposite way, deciding to have the
> object move (and its ghost) when elevate is changed.

## The rule

**The pointer picks a square on the floor of the storey being worked on. The placement height says
how high above that square the part goes, and nothing else.**

Two things follow, and both are what the client asked for:

- `[` and `]` never move the ghost sideways. It rises and falls over the square being aimed at.
- The part lands on the square the ghost stood on, because the click picks the same way.

Selecting the other floor does move the picking plane, and the camera with it, so a still pointer
is over a different square afterwards and the viewport re-picks. Turning or zooming the camera does
the same. An elevation key does neither.

Snapping to an open port under the cursor is unaffected: a landing marker the ray crosses still
wins over the plane, which is what auto-elevates a terminal onto a blower or an open tube end
(ADR-0016's penetrable obstacles and the port markers both rely on it).

## What this costs

At height the ghost is no longer under the cursor on screen — it stands above it, offset by the
elevation. That is inherent in "it retains its x/y position" and is what the client chose; the
height markers say how far up it is. A future change that re-picks the pointer against a raised
plane to put the ghost back under the cursor is reversing this decision, not fixing a bug.

## Where it lives

`pickPointerCell` in `renderer/interaction.ts` takes the reported height as an argument now,
separately from the plane it casts onto. `Viewport` keeps that plane at the new `pickElevation`
prop, which `App` fills from `floorBeneath` in `floors.ts` — the same function that decides which
floor a raised part casts its shadow on, and where the height setting returns to after an endpoint
(ADR-0031). `withElevation` in `placement-session.ts` lifts the hover cell straight up, which is
now the whole answer rather than a stop-gap the viewport corrected.
