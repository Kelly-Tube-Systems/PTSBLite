# ADR-0039: The bake corrects one CAD colour by where the face sits

- **Status:** Accepted
- **Date:** 2026-09-17

[ADR-0033](0033-the-blower-and-terminal-come-from-kts-cad.md) took the blower and terminal from
Kelly Tube Systems' STEP files and decided that the CAD owns the shape while the app owns the
palette: each face is classified body, trim, door or glass from the colour the CAD gave it, and
drawn in the viewport's colour for that role.

That classification is right for every face but one. `KEL2020` is moulded into the terminal's
housing as a separate solid per character, and the STEP finishes one of them — the first `0` of
`2020` — in the same dark colour as the latch and the collars. It therefore came out as *trim*:
opaque near-black, at the size of a letter, on a housing the app draws see-through so the carrier
barrel reads through it. It did not read as a letter. The client saw it as damage:

> there's also a weird black circle that looks like an artifact

He is right that it is not on the unit. The other six characters are in the housing's own material,
so the mark reads as moulding; the seventh was a blot above the KEL2020 decal (ADR-0034) that
nothing on the real terminal has.

## The correction is a box in the part's frame, not another colour rule

`roleOf` decides from colour alone, and by colour this character is indistinguishable from the
latch. The only thing that separates them is where they sit, so `tools/bake-kel2020-parts.mjs`
carries `ROLE_CORRECTIONS`: a box in the part's own frame, in feet, and the role every mesh that
fits inside it is drawn in whatever the CAD says. The terminal has one, around the moulded
lettering across the front of the housing.

Two properties make this safe rather than a magic number:

- **Only a mesh that fits entirely inside the box is corrected.** The housing and the full-height
  trim rail both run straight through it and are left alone; what fits is a character.
- **The box is measured off the geometry the app ships**, not guessed from the STEP, which is not
  in the repository.

It is applied in the bake rather than by hand in `src/data/kel2020-geometry.ts`, so a re-bake when
KTS ships new CAD reproduces it instead of quietly bringing the blot back.

## Why not drop the character instead

Deleting it would leave `KEL202_` moulded into the housing. The character is really there on the
unit; only its colour was wrong.

## The committed geometry was corrected in place

The STEP files are a client drop and are not in the repository, so the bake could not be re-run to
regenerate the data for this change. The affected faces were the last 40 triangles of the terminal's
trim group and the body group begins immediately after them, so moving them across is a change to
three numbers in the group table and nothing else: the triangles, the vertices and the buffers are
untouched. A re-bake will lay the same faces out slightly differently — the characters' vertices
will sit in the body role's block rather than the trim role's — and draw exactly the same picture.

`baked-geometry.test.ts` holds the outcome rather than the numbers: no triangle drawn in the dark
hardware material has its centre inside the lettering box, and the lettering is still drawn. That
assertion survives a re-bake, and it is what would fail if a future CAD drop reintroduced the blot.
