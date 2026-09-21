# ADR-0050: The terminal's mark is the artwork, on the moulding's own cylinder

- **Status:** Accepted
- **Date:** 2026-09-21
- **Supersedes:** the decision in
  [ADR-0040](0040-the-terminals-mark-is-painted-not-decalled.md) to paint the moulding rather than
  lay a decal over it. The predicate
  [ADR-0042](0042-the-marks-characters-are-found-as-pieces.md) settled on is kept, with a different
  job.

[ADR-0034](0034-the-units-carry-the-kel2020-wordmark.md) put the KEL2020 wordmark on the blower and
the terminal as a decal: a strip of cylinder carrying the client's own artwork, rasterised from path
data and cut out by alpha. [ADR-0040](0040-the-terminals-mark-is-painted-not-decalled.md) took it
off the terminal again, because that unit's CAD moulds `KEL2020` into its housing and the decal was
a second mark laid over the first. The moulding was painted green instead, and three rules in turn
have picked out the faces to paint: relief against the housing's shell
([ADR-0040](0040-the-terminals-mark-is-painted-not-decalled.md)), a window round the lettering
([ADR-0041](0041-the-terminals-mark-is-picked-by-its-panel.md)), and connected pieces inside the
strokes' band ([ADR-0042](0042-the-marks-characters-are-found-as-pieces.md)).

The third rule does find the whole mark. The mark still does not read. The client, 2026-09-21, with
a screenshot of the two units one above the other:

> Decal on Terminal doesn't look as good as the decal on the blower

and it does not, for reasons no predicate can fix. The moulding is a tessellation of a relief, not
a drawing: its characters are open shells, they sit at slightly different heights, and the lettering
is a twelfth stockier than the artwork. Painting those faces green makes them green; it does not
make them the wordmark.

## Decision

The terminal wears the same decal the blower does — same artwork, same texture, same material, same
green — and the moulding is cut out of the drawing so the decal has a clean panel to sit on.

The decal goes exactly where the moulding was, which is the point: ADR-0040 is right that the CAD
knows where the real unit's sticker is, and wrong that the CAD is the best drawing of it. The
moulding stops being the mark and becomes the measurement.

## The panel is a cylinder after all

A circle least-squares fitted to the moulded lettering's own vertices, in the plane across the unit,
sits at `x = -0.0228`, `z = 0.0224` — the housing's axis, not the unit's — with a radius of
0.1944 ft and a radial residual of ±0.0015 ft. That residual *is* the relief: the strokes stand
0.003 ft off a base at 0.1929 ft, and the base is the panel. So the surface the sticker goes on is a
cylinder to within a thousandth of a foot, and a decal wrapped on it hugs it better than the
blower's does its drum.

[ADR-0041](0041-the-terminals-mark-is-picked-by-its-panel.md) concluded the opposite — "no cylinder
or ellipse separates 0.003 ft of lettering from 0.016 ft of drift" — and was measuring the wrong
circle. Its reference was the housing's own shell, radius 0.2119 ft about an axis 0.025 ft off the
unit's, and the panel is a different cylinder: smaller, and on a different axis again. Fitted to
itself rather than to the shell, the panel is as round as anything else on the unit. That mistake
cost the last `0` of 2020 and started this run of three predicates.

The lettering spans 145.3° of that circle, centred within a degree of the front, and 0.0819 ft of
height centred at `y = 0.8178`. `TERMINAL_WORDMARK` takes the width from the arc and lets the height
follow the artwork's proportions rather than the moulding's: the artwork is the mark Kelly Tube
Systems supplied, and the moulding is only evidence of where it goes.

## The cut is the old predicate, doing less

`BakedSplit` moved faces from one role into another. Nothing needs that now, so it is `BakedCut`:
same `from`, same `pick`, no `to`, and the faces it picks are simply not drawn. The `mark` role goes
with it. The rule inside `TERMINAL_MOULDED_MARK` is unchanged — connected pieces of the housing
lying wholly inside the strokes' height band on the front of the unit — because it still has to find
the whole mark. It has only swapped one failure mode for another of the same size: what it misses
used to be a character left grey, and is now grey relief beside a green sticker.

Cutting the lettering leaves no hole. It is moulded *onto* the panel as solids of its own, and the
panel runs `y = 0.75` to `0.91` unbroken underneath — which is the same fact ADR-0042 relied on to
find the pieces in the first place.

## What the tests hold

The two assertions ADR-0042 left carry over, because the cut has to find exactly what the paint had
to find: the faces it takes span all seven characters and stay inside the strokes' band, and no face
moulded onto the front of the housing within that band is still drawn. Neither can be quieted by
loosening the other.

Two more hold the decal to the moulding, which is new and is where this change can go wrong:

- every corner of the moulding lies between the decal's radius and 0.004 ft above it, which is only
  true if the panel is the cylinder the decal is wrapped on;
- nothing the terminal still draws reaches the decal's surface anywhere inside its footprint —
  sampled across each triangle rather than at its corners, because the housing's facets are coarse
  next to a mark an inch tall and the panel behind the sticker is spanned by triangles whose corners
  all lie outside it.

A decal that sank into the panel would be clipped by it, which is the raggedness this change is
fixing rather than a new way to cause it.

## What is still visible through the housing

Unchanged from [ADR-0040](0040-the-terminals-mark-is-painted-not-decalled.md): the emblem moulded
into the **back** of the housing is untouched and still shows faintly through the see-through
barrel, because it is the far side of a transparent unit rather than a second mark on the front.
The decal itself reads faintly and mirrored from behind, as the painted moulding did.

## The Build drawer thumbnail is unchanged

`PartThumbnail.tsx` still draws the terminal's mark as a green bar about ten pixels wide, for the
reason [ADR-0034](0034-the-units-carry-the-kel2020-wordmark.md) gave: real glyphs at that size
rasterise to mush.
