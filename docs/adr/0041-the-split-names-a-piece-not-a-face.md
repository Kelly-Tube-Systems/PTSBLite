# ADR-0041: A split names a piece of geometry, not a face at a time

- **Status:** Accepted
- **Date:** 2026-09-18

[ADR-0040](0040-the-terminals-mark-is-painted-not-decalled.md) painted the KEL2020 mark the
terminal's CAD already carries, by lifting its faces out of the housing's role with a predicate:
a face was the mark's if it stood between 0.0006 ft and 0.01 ft proud of the housing — modelled as
a cylinder of radius 0.2119 ft about an axis 0.025 ft off the unit's own — between y = 0.778 and
y = 0.859, and no more than 45° round from the front.

The client read the result off the unit:

> Need to address this: if it's a size limitation, let's resize the logo placement

with a photograph of the door reading **KEL202**. It is not a size limitation. The mark wraps about
66° each side of the front, and two of the predicate's terms cut the last character off:

- **The front-facing term.** The last 0 reaches z = 0.078 in the part's frame, and any face with a
  corner behind z = 0.1 was rejected.
- **The cylinder.** The housing is a cylinder near the front and flattens toward its sides. Past
  about 45° the real surface falls up to 0.005 ft inside the fitted radius, so the mark's own
  0.001–0.004 ft of relief measures as *below* the housing and never reaches the threshold.

Both terms are the same mistake: a face was being tested against a model of the housing, and the
model is only good where it was fitted.

## Decision

`BakedSplit` carries a box in the part's own frame instead of a predicate, and moves a whole
connected piece of geometry whose every vertex falls inside it.

This is the rule `ROLE_CORRECTIONS` already applies in the bake
([ADR-0039](0039-the-bake-corrects-one-cad-colour.md)) — only a mesh that fits entirely inside the
box is corrected — one step further down, in the renderer. The two now say the same thing about the
same lettering, in the same terms.

It works because the CAD moulds each character as its own solid and welds none of them to the
shell, so a character survives the bake as a piece of its own. The housing, the plate the lettering
stands on and the full-height trim rail all run outside the box and stay the housing's.

The mark comes out whole: 291 faces across all seven characters, from x = -0.207 to x = 0.163,
against 194 and a truncated **KEL202** before.

## Why not fit the housing better

An ellipse, or a radius sampled by angle, would have carried the relief test further round the
unit. It would also have been a second model of a shape the repository already has exactly, tuned
until the letters came out — and it would have to be re-tuned against the next CAD drop. A box and
"does this piece fit inside it" needs no model of the housing at all.

## What still fails loudly

A re-bake that moved the housing, or a CAD drop that welds the lettering into the shell, leaves no
piece fitting the box and paints nothing. `Viewport.test.ts` holds what the client can see rather
than the numbers: the painted mark spans the full width of the moulding, reaches both ends, and has
no letter-sized hole in it. A missing character fails that test rather than shipping.
