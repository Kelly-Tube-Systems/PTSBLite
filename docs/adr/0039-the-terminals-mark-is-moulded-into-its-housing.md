# ADR-0039: The terminal's KEL2020 mark is moulded into its housing, and gets painted

- **Status:** Accepted
- **Date:** 2026-09-17

[ADR-0034](0034-the-units-carry-the-kel2020-wordmark.md) put the KEL2020 wordmark back on the blower
and the terminal as a decal — a strip of cylinder carrying the client's artwork — on the reasoning
that "the STEP files carry the shape of the two units and nothing printed on them, so the CAD models
arrived blank".

That is true of the blower. It is not true of the terminal. Its housing carries the mark moulded
into the plastic, and the decal was laid over the top of it, which is what the client saw on
2026-09-17:

> the terminal in the builder shows two (2) "KEL2020" logos, one looks built in to the plastic
> molding, the other looks like a logo file sitting in front of it

Asked which to keep, he said neither on its own:

> Combine the two, if possible. The location of the Gray logo is true to life, but it is really a
> sticker that is in color, similar to the second logo that is appearing now. So basically, just to
> make the true to Life logo full color

## Decision

The terminal drops its decal. The mark the CAD already carries is painted in `VP.signal`, the green
the blower's decal is tinted with, so the unit wears one mark, where the real one is, in the colour
of the sticker it is.

The blower keeps its decal: its CAD really is blank, and `kel2020-decal.ts` stays for it.

## Painting geometry the bake could not name

The bake classifies a face by the colour the CAD gives it (ADR-0033): body, trim, door or glass.
The mark is the housing's own plastic, so it bakes as `body` — except for the first zero of 2020,
which the CAD draws as a dark solid and which therefore bakes as `trim`, alongside the hinges. That
zero is the second thing the client reported the same day, "a weird black circle that looks like an
artifact": a glyph of the mark, not an artefact, and painting the mark takes it with the rest.

Re-baking with hand-edited roles was not an option — `src/data/kel2020-geometry.ts` is generated and
the STEP files are a client drop that is not in the repository — so the faces are named by **where
they sit on the part** rather than by which bake produced them. `BakedSplit` in `baked-geometry.ts`
lifts the faces a predicate picks out of one or more roles into another, rewriting the index buffer
once per part. The predicate lives with the terminal's mesh, and every number in it is measured off
the baked geometry: the housing is a cylinder of radius 0.2119 ft about an axis 0.025 ft off the
unit's own, and the mark stands between 0.0006 ft and 0.01 ft proud of it, between y = 0.778 and
y = 0.859, within 45° of the front.

A shape test rather than a colour test is the point: it survives a re-tessellation, and it fails
loudly — the mark stops being painted — rather than quietly painting the wrong thing, if KTS ships
a housing of a different size. `Viewport.test.ts` holds it to the mark's measured extent so a
re-bake that moved the housing cannot pass unnoticed.

## What is still visible through the housing

The housing is drawn see-through at the client's request (ADR-0033 and the "Terminal door:
see-through, or at least lighter" card), and the CAD moulds an emblem into the **back** of it as
well. That emblem still shows faintly through the barrel, unpainted, because it is the far side of
the unit rather than a second mark on the front. Painting it would put a green smudge behind the
carrier tube; leaving it is what seeing through a transparent unit looks like.

## The Build drawer thumbnail is unchanged

`PartThumbnail.tsx` still draws the terminal's mark as a green bar about ten pixels wide, for the
reason ADR-0034 gave: real glyphs at that size rasterise to mush.
