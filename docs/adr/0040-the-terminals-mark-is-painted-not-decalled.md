# ADR-0040: The terminal's KEL2020 mark is the moulding, painted

- **Status:** Accepted
- **Date:** 2026-09-17
- **Amended:** 2026-09-18 — the predicate below painted six characters out of seven, and is replaced
  by [ADR-0041](0041-the-terminals-mark-is-picked-by-its-panel.md), in turn replaced by
  [ADR-0042](0042-the-marks-characters-are-found-as-pieces.md). The decision to paint the
  moulding rather than lay a decal over it stands.

[ADR-0034](0034-the-units-carry-the-kel2020-wordmark.md) put the KEL2020 wordmark back on the blower
and the terminal as a decal — a strip of cylinder carrying the client's artwork — on the reasoning
that "the STEP files carry the shape of the two units and nothing printed on them, so the CAD models
arrived blank".

That is true of the blower. It is not true of the terminal: `KEL2020` is moulded into its housing,
one solid per character, as [ADR-0039](0039-the-bake-corrects-one-cad-colour.md) found while taking
the blot off one of them. So the decal was a second mark laid over the unit's own, which is what the
client saw on 2026-09-17:

> the terminal in the builder shows two (2) "KEL2020" logos, one looks built in to the plastic
> molding, the other looks like a logo file sitting in front of it

Asked which to keep, he asked for neither on its own:

> Combine the two, if possible. The location of the Gray logo is true to life, but it is really a
> sticker that is in color, similar to the second logo that is appearing now. So basically, just to
> make the true to Life logo full color

## Decision

The terminal drops its decal, and the mark the CAD already carries is painted in `VP.signal`, the
green the blower's decal is tinted with. The unit wears one mark, where the real one is, in the
colour of the sticker it is.

The blower keeps its decal: its CAD really is blank, and `kel2020-decal.ts` stays for it.

## Painting faces the bake merged into the housing

The moulded mark is the housing's own plastic, so it bakes as `body` along with the whole shell
(ADR-0039 is what puts its dark character there too), and the renderer can style a role but not a
piece inside one. Re-baking with the mark as a role of its own is not available: the data file is
generated and the STEP files are a client drop that is not in the repository.

So `BakedSplit` in `baked-geometry.ts` lifts the faces a predicate picks out of one role into
another, rewriting the index buffer once per part — positions and normals are untouched and stay
shared, so the ghost still rebuilds cheaply on every cell the cursor crosses. The predicate lives
with the terminal's mesh, and every number in it is measured off the baked geometry: the housing is
a cylinder of radius 0.2119 ft about an axis 0.025 ft off the unit's own, and the mark stands
between 0.0006 ft and 0.01 ft proud of it, between y = 0.778 and y = 0.859, within 45° of the front.

This is the same move ADR-0039 made in the bake — name a face by where it sits, because colour
cannot tell it apart — one step further down, in the renderer, because what the mark needs is a
material rather than a different role in the data. A shape test also fails in the right direction:
the mark stops being painted, loudly, rather than quietly painting the wrong thing, if KTS ships a
housing of another size. `Viewport.test.ts` holds the painted faces to the mark's measured extent so
a re-bake that moved the housing cannot pass unnoticed.

## What is still visible through the housing

The housing is drawn see-through at the client's request (ADR-0033, and the "Terminal door:
see-through, or at least lighter" card), and the CAD moulds an emblem into the **back** of it as
well. That emblem still shows faintly through the barrel, unpainted, because it is the far side of
the unit rather than a second mark on the front. Painting it would put a green smudge behind the
carrier tube; leaving it is what seeing through a transparent unit looks like.

## The Build drawer thumbnail is unchanged

`PartThumbnail.tsx` still draws the terminal's mark as a green bar about ten pixels wide, for the
reason ADR-0034 gave: real glyphs at that size rasterise to mush.
