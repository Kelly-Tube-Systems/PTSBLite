# ADR-0034: The blower and terminal carry the KEL2020 wordmark

- **Status:** Accepted
- **Date:** 2026-09-15

[ADR-0033](0033-the-blower-and-terminal-come-from-kts-cad.md) replaced the hand-drawn blower and
terminal with Kelly Tube Systems' own CAD, and dropped the green power light, send button and
wordmark the old models carried, on the reasoning that "the real markings are now in the geometry."

They are not. The STEP files carry the shape of the two units and nothing printed on them, so the
CAD models arrived blank. The client sent the wordmark artwork the same day and asked for it back:
*"The terminal and blower models in the app should have this KEL2020 decal on them"*.

So the mark returns, and this time it is the client's own artwork rather than a green rectangle
drawn by eye. That paragraph of ADR-0033 is superseded; everything else in it stands.

## The artwork is path data in the source, not an asset

`src/data/kel2020-wordmark.ts` holds the SVG's seven path strings in the artwork's own 1575 x 366
coordinates. Nothing is fetched, decoded or awaited.

This follows ADR-0033's reasoning for the geometry rather than repeating the argument: every mesh
builder in the renderer is synchronous, and the placement ghost rebuilds its mesh on each cell the
cursor crosses, so there is nowhere to await an image. The artwork is 1.4 KB, against 216 KB for the
geometry, which makes the trade easier here than it was there.

`Path2D` consumes the strings unchanged because SVG path data and the 2D canvas agree on
coordinates, down to y running downward. One canvas is rasterised the first time a part asks for it
and one `CanvasTexture` wraps it for the whole scene.

## The mark is geometry, not a material role

A baked face is classified as body, trim, door or glass and drawn in the palette's colour for that
role (ADR-0033). The wordmark cannot be a sixth role, because the CAD has no faces to give it. It is
its own mesh: a strip of cylinder standing four thousandths of a foot off the surface it names.

A strip of cylinder and not a flat plane because both surfaces are round and the mark is wide enough
to see the curve — 91° of the blower's drum. A tangent plane would lift its ends a tenth of an inch
clear of the unit and read as a label peeling off.

**The radius each mark sits at is measured, not chosen.** The first attempt put the blower's mark at
0.2595 ft, read off a sample of drum vertices, and the drum's own facets stood through it: whole
strokes of the mark were hidden and it rendered as green rubble. The number that matters is the
farthest the surface reaches anywhere under the mark, so both are now measured by casting rays
outward from the part's axis across the patch the mark covers — 0.2649 ft for the blower's drum,
0.213 ft for the terminal's housing, whose axis is also offset 0.025 ft from the unit's own.

The mark is cut out by `alphaTest` rather than blended, which keeps it an opaque object: it sorts
and occludes like the unit it is painted on, and never has to be ordered against the terminal's
clear barrel.

## It is painted on, so it turns with the unit

The mark is centred on each unit's local +Z — the side a blower's port ring and a terminal's door
face — and belongs to the part's own frame. A terminal laid onto its axis (ADR-0027) therefore wears
its mark on its side, reading bottom to top, exactly as a decal on real hardware would. Nothing
re-orients it to face the camera; a height marker is a label and billboards, a wordmark is paint and
does not.

## The palette stays the app's

The glyphs rasterise white and the material tints them with `VP.signal`, so the colour decision
stays in `three-utils.ts` with every other colour the viewport chooses. The artwork's own `#0E9345`
is Kelly Tube Systems' brand green, a shade darker than a viewport on a near-black ground can carry
— which is the same reason ADR-0026 made the blower graphite rather than black.

## The Build drawer thumbnails keep their placeholder

`PartThumbnail.tsx` draws the terminal's wordmark as a green bar about ten pixels wide. The real
glyphs at that size are two pixels tall and would rasterise to mush, so the bar stays. The blower's
thumbnail carries no mark and does not gain one.

## One shared texture, and the disposal rule that follows

`disposeObject` frees a material's `map` along with the material, because label sprites each own a
`CanvasTexture`. The wordmark is the exception: one texture serves every blower and terminal in the
scene, so freeing it with the first part erased would blank the mark on all the rest. Its own module
owns it and never frees it, and `map.userData.shared` is how that ownership is declared to
`disposeMaterial`.

This is the second such exception in that function, after the geometry every `THREE.Sprite` shares.
Both exist for the same reason — a resource that outlives the object holding it — and a third would
be the point to give `disposeObject` a real ownership model rather than a list of special cases.
