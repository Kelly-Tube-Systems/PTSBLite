# ADR-0044: A left drag draws the obstacle box, and only while one is being drawn

- **Status:** Accepted
- **Date:** 2026-09-19
- **Card:** [Obstacle tool: drag one corner to the other to draw the box](https://trello.com/c/le2IIkIV)

The obstacle tool took two clicks: one corner, then the opposite corner. Watching people use it,
the client found they reached for a press-and-drag instead, the way they would in any other drawing
tool. The left drag was the camera orbit, so the reach for a box got the view spinning with a
corner anchored somewhere behind them.

He asked for the drag, and turned down the on-screen hint offered alongside it:

> I like the feature of solution 2, so let's go ahead and work on and ship that, it will be a good
> addition regardless. ... I don't like the solution to 1 so let's ignore it.

## The rule

**While an obstacle box is part-drawn, the left drag draws it. Every other time, the left drag
orbits the camera.**

"Part-drawn" is the whole of it, and it is narrower than "the obstacle tool is armed": once the
second corner is down, the footprint is closed and the draft is waiting for its height and the
Place button. There is nothing left to draw then, and taking the orbit away would stop the visitor
looking at the box he just drew from another angle. `dragDrawPhase` is that state, read off the
session rather than guessed at by the renderer, and it has two live values:

- `"anchor"` — nothing is down, so the press puts the first corner on the grid and the release
  closes the footprint on the square it lands on.
- `"close"` — a corner is already down from a first click, so the press adds nothing and the
  release closes the footprint.

Both clicks and the drag therefore run through the same two steps `attemptPlacement` already had.
The drag is a different way to reach them, not a second way to build a draft: nothing about the
box, its base, its height limit or its commit knows which gesture drew it.

## What follows

- **The corner goes down on the press, not the release.** The box has to follow the pointer while
  the button is held, which means the anchor exists before the release does.
- **A press and release on one square is still a click.** Closing the box there as well would turn
  every first click into a finished one-foot box, so `dragDrawRelease` returns nothing for a
  gesture that anchored and ended where it started. Two clicks still work exactly as before, which
  is what the card asked for — "after this change both work".
- **The controls legend follows the drag, not the tool.** It reads "Left click drag — Draw box"
  while a box is being drawn and "Orbit" the rest of the time, including with the obstacle tool
  armed and the footprint closed. A legend may only say what the app does, and this is the one row
  whose answer now depends on more than the armed tool.
- **Nothing is added to the viewport.** The hint the client turned down is not here in another
  form: no prompt, no marker, no change to the preview. The drag simply works.

The gesture maths is pure and lives in `src/renderer/interaction.ts` beside the click-versus-drag
discrimination it extends; the phase is domain state in `placement-session.ts`. The one part that
is neither — a held button drawing a box rather than orbiting — is covered by the Playwright smoke
suite, because happy-dom has no raycaster to press against.
</content>
</invoke>
