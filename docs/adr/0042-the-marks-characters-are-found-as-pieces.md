# ADR-0042: The terminal's mark is found as pieces, not inside a window

- **Status:** Accepted
- **Date:** 2026-09-18
- **Supersedes:** the predicate in
  [ADR-0041](0041-the-terminals-mark-is-picked-by-its-panel.md)
- **Amended:** 2026-09-21 — the rule below is kept exactly as it is, but
  [ADR-0050](0050-the-terminals-mark-is-the-artwork-on-the-mouldings-cylinder.md) cuts the faces it
  finds out of the drawing instead of painting them, and a decal of the client's artwork takes their
  place. Everything below about *finding* the mark still applies; the `DoubleSide` material it ends
  with is gone with the painted faces.

[ADR-0040](0040-the-terminals-mark-is-painted-not-decalled.md) paints the KEL2020 mark moulded into
the terminal's housing by lifting its faces out of the `body` role with a `BakedSplit`. Two rules
have now picked those faces, and both cut a character short.

ADR-0040 asked whether a face stood proud of the housing, taken as a cylinder. That dropped the
last `0`. [ADR-0041](0041-the-terminals-mark-is-picked-by-its-panel.md) replaced it with a window —
the strokes' height band, the front of the unit, and the width the lettering occupies,
`x = -0.177` to `x = 0.178`. That painted all seven characters, and still cut the mark:

> Need to address this: if it's a size limitation, let's resize the logo placement

The artwork opens `K` with a solid block a fifth of the whole mark wide. The lettering runs from
`x = -0.2074` to `x = 0.1632`, so the window took about 0.04 ft off the far end of that block — ten
faces, left in plain plastic.

## Why the window was short

The span was measured from the extent of the faces the *old* rule picked, plus a margin. The old
rule was clipping both ends, so that reasoning was circular: the right-hand end was checked, because
a missing `0` is obvious, and the left-hand end was taken on trust, because a clipped block reads as
a narrow stem rather than as a missing character.

That is the failure worth designing against. Both rules were a region drawn around the lettering,
and a region can always be drawn slightly too small — quietly, in a way that looks like a design
choice rather than a bug.

## Decision

A character is found as a **piece** rather than inside a region. The split unions the vertices the
housing's faces share, and takes the connected pieces that lie wholly inside the strokes' measured
height band, `y = 0.77` to `y = 0.862`, on the front of the unit.

This works because the CAD moulds the lettering as solids of its own, so a character's triangles
join up to each other and to nothing else, and because nothing else the housing is made of both
starts and ends inside 0.08 ft of height: the panel the lettering stands on runs `y = 0.75` to
`0.91` unbroken, and the shell runs the length of the unit.

A piece is all of a character or none of it. There is no longer a width to get wrong, and no model
of the housing's surface — the part ADR-0041 correctly concluded could not be fitted, since no
cylinder or ellipse separates 0.003 ft of lettering from 0.016 ft of drift.

Three pieces of hinge leaf do share the band. They lie flat against the side of the unit and reach
no further forward than `z = 0.018`, where the mark's furthest-round character starts at
`z = 0.078`, so a front test half way between the two separates them with room to spare. The emblem
moulded into the back of the housing is a piece in the same band, and the same test leaves it
unpainted, which is what ADR-0040 already decided should happen to it.

It still fails in the direction ADR-0040 wanted: a re-bake that welded the lettering into the shell
stops painting the mark, loudly, rather than quietly painting a stripe of plain housing.

## `BakedSplit` picks a role at a time

Connectivity is not visible from one triangle, so `BakedSplit.pick` now takes the whole role — the
part's positions, its index buffer, and where each of the role's faces starts — and returns the set
of faces that belong to the new role. It was already called once per part behind `drawnGeometry`'s
cache, so this costs nothing per mesh and the ghost still rebuilds cheaply on every cell the cursor
crosses.

## The bites were a culled face, not a missing one

With every character found whole, the strokes still had lumps out of them — the other half of what
the client photographed. Those faces are not unpainted: nothing moulded onto the front of the
housing in the strokes' band is left in the `body` role now.

The characters are open shells. Parts of the `2`, the `0` and the `2` have no outward facet, and the
only triangle covering those patches is one turned into the unit, which back-face culling threw
away. The mark is drawn `DoubleSide` instead. Nothing is lost by keeping those faces: the material
is unlit, so a face reads the same green whichever side of it meets the camera. Seen from behind,
through a housing that is see-through at the client's request, the mark now shows faintly and
mirrored — the same thing ADR-0040 accepted for the emblem on the back.

## The test that would have caught both

The width assertion is the one that let this through: it read "about 0.3 ft across", which `KEL202`
satisfied, and then 0.33, which the clipped block cleared by a thousandth of a foot. A width can
always be set a little too generously.

So the mark is now also held from the other side: **no face moulded onto the front of the housing
between the top and bottom of the strokes is left in the housing's own plastic.** That is bounded by
the lettering rather than by whatever the split measures, so it cannot be quieted by widening the
split — the panel would come with it and fail the height check. It fails on both of the rules this
ADR replaces.
