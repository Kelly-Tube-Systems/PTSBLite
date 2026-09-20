# ADR-0046: The two camera moves trade mouse buttons

- **Status:** Accepted
- **Date:** 2026-09-20
- **Card:** [Can we swap the orbit and pan mouse buttons?](https://trello.com/c/x0XnQNIY)

Since the first viewport the left drag orbited and the right drag panned. The client asked for the
pair to change hands:

> Can we swap the orbit and pan mouse buttons? exactly the same, just opposite buttons (change all
> UI elements to reflect this)

## The rule

**The left drag pans. The right drag orbits.** Nothing else about either move changes: the same
sensitivity, the same pitch clamp, the same 1:1 tracking of the cursor at the target plane.

[ADR-0044](0044-a-drag-draws-the-obstacle-box.md) says the left drag draws the obstacle box while
one is part-drawn and gives it to the camera the rest of the time. That rule still holds; what the
camera does with it is now a pan.

## What follows

- **The left button keeps everything else it had.** A left *click* still places, and a left drag
  still draws the obstacle box in preference to moving the camera. Only which camera move the left
  drag reaches for has changed.
- **The orbit is the camera move that is always offered.** No tool borrows the right button, so the
  legend's Orbit row is now unconditional and its Pan row is the one that steps aside for
  "Draw box". That is the reverse of ADR-0044's reading of the same legend, and the reason it
  changed is here rather than there: an ADR is a record.
- **The threshold moved with the binding.** The left drag has always waited about 4 px before it
  counts as a drag, to tell a drag from a click; panning inherits that, and the orbit — on a button
  that places nothing — turns from the first pixel, as the pan used to.
- **Two files carry it.** `Viewport.tsx` binds the gestures; `ControlsLegend.tsx` names them. The
  pure drag maths in `interaction.ts` never knew which camera move it was feeding and still does
  not.

A reversal like this is cheap to make and expensive to half-make: a legend that still says "Left
click drag — Orbit" teaches the wrong thing to the next person who reads it. The client asked for
the UI to follow, and the README control table and `docs/baked-in-assumptions.md` are part of that.
