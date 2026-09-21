# ADR-0049: The obstacle tool disarms itself when the box is placed

- **Status:** Accepted
- **Date:** 2026-09-21
- **Card:** [Obstacle tool: drop back to the select tool after a successful Place](https://trello.com/c/izv45DcR)

Every placement tool in the app stays armed after it places something. Arm the blower and each
click puts another blower down; the same goes for the terminal, the pair, the tube and the bend.
The obstacle tool worked that way too — Place put the volume down, cleared the draft, and left the
tool ready to draw the next box.

The client asked for the obstacle tool alone to break that pattern:

> Obstacle tool resets to select tool after successful "place". Please. Thanks.

## The rule

**A committed Place disarms the obstacle tool and leaves the select tool armed. Nothing else about
a placement disarms a tool.**

The asymmetry is the point, and it follows from how the two kinds of placement are used. A part is
placed by aiming and clicking, so a run of them is a run of clicks and re-arming between each would
be pure friction. A box is drawn: two corners, a height, then a button. It is deliberate, and it is
usually singular — a column, a machine, a stairwell. The click after Place is far more likely to be
someone looking at what they just drew than someone starting another one, and under the old
behaviour that click anchored a corner instead.

Only a `committed` result disarms. A Place the placement rules reject — a volume out of bounds, or
one landing on cells it may not have — leaves the tool armed with its draft intact, because the
footprint still has to be redrawn somewhere it fits, and that is the obstacle tool's job.

## What follows

- **The disarm goes through `selectTool`, not the session reducer.** Arming and disarming a tool is
  also the automatic height-marker toggle taking the View-menu override back, and `App`'s
  `selectTool` is where that rule is stated. Reaching the same state by returning
  `tool: "cursor"` from `commitObstacleDraft` would leave the markers lit with nothing armed.
  `commitObstacleDraft` stays a pure function of session and design, and says only that the draft
  is spent.
- **The obstacle kind survives.** `obstacleKind` is sticky across tool changes, so a penetrable box
  followed by re-arming the tool still draws penetrable. The client chose that stickiness; being
  handed back to the select tool in between is not a reason to forget it.
- **Undo is unaffected.** The placement is one undoable step, as it was. Undoing it does not re-arm
  the obstacle tool: the design goes back, the tool the visitor is holding does not.
