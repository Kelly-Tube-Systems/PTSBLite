# ADR-0041: The terminal's mark is picked by the panel it stands on, not by relief

- **Status:** Accepted
- **Date:** 2026-09-18
- **Amends:** the predicate described in
  [ADR-0040](0040-the-terminals-mark-is-painted-not-decalled.md); the decision there stands

[ADR-0040](0040-the-terminals-mark-is-painted-not-decalled.md) paints the KEL2020 mark the
terminal's CAD already carries, and picks its faces out of the housing with a `BakedSplit` that asks
whether a face stands proud of the housing: the housing taken as a cylinder of radius 0.2119 ft
about an axis 0.025 ft off the unit's own, the mark as anything between 0.0006 ft and 0.01 ft above
it inside the band the lettering occupies.

It painted six characters out of seven. The client, 2026-09-18:

> Need to address this: if it's a size limitation, let's resize the logo placement

with a screenshot of a terminal reading **KEL202** in green and a seventh character left in the
housing's own grey.

It is not a size limitation, and the mark does not need moving or resizing. The lettering is
moulded onto a raised panel, and that panel is flatter than any cylinder drawn through it: measured
against the reference above, the housing's surface drifts about 0.016 ft across the width of the
mark while the lettering only stands about 0.003 ft off it. Near the middle the drift is in the
mark's favour and every character is caught. Towards the ends it overtakes the relief, and the last
0 — whose outer edge lies 0.078 ft round the front, further round than any other character, because
the lettering is centred on the unit rather than on the housing's own axis — measured as *below* the
housing rather than above it and was never picked.

## Decision

The split picks the mark by the band and the width the lettering occupies, and drops the relief test
and the cylinder it was measured against.

That works because the panel is one surface and the lettering is another: the panel's faces run from
y = 0.75 to y = 0.91 unbroken, while every face of the lettering standing on it lies strictly inside
that. A band of 0.75–0.88 therefore holds all of the lettering, including the faces that climb the
side of a stroke, and cuts every face of the panel under it. The width — x from -0.177 to 0.178 —
is what keeps the hinge rail and the latch down the sides of the unit out of the mark; they bake as
`body` with the housing and cross the same band. Both numbers are measured off the baked geometry,
as ADR-0040 requires of everything in this predicate.

## What this costs

ADR-0040 claimed the shape test "fails in the right direction: the mark stops being painted, loudly,
rather than quietly painting the wrong thing, if KTS ships a housing of another size". This bug is
the counter-example: it failed quietly, painting most of a mark, and it took the client to find it.
The new predicate can fail the same way, and one bound is now doing work the relief test used to
share — the band's top edge at 0.88 is 0.02 ft below the panel's, and a re-bake that moved the panel
would paint a green stripe across the unit rather than a mark.

So the test in `Viewport.test.ts` is what carries the guarantee, and it is written for both
directions rather than one: the painted faces must reach across all seven characters (0.33 ft, where
the first six span 0.29 ft), and must stay inside a band the height of the lettering rather than the
height of the panel. The old test asserted neither; it held the faces to "about 0.3 ft across",
which KEL202 satisfies.

## Alternatives rejected

**Fit the housing better.** A circle fitted to the panel leaves a residual of about 0.006 ft at the
ends of the mark, twice the relief being measured, and an ellipse is no better: the panel is not a
conic section. Nothing in this family separates 0.003 ft of lettering from 0.016 ft of drift.

**Re-bake with the mark as its own role.** Still unavailable, for the reason ADR-0040 gives: the
data file is generated and the STEP files are a client drop that is not in the repository.
