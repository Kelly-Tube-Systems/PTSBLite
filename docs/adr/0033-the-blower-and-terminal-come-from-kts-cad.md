# ADR-0033: The blower and terminal come from Kelly Tube Systems' CAD

- **Status:** Accepted
- **Date:** 2026-09-15

[ADR-0026](0026-parts-are-modelled-from-marketing-media.md) settled that the blower and terminal
would be drawn by eye from the photographs at
[kellytubesystems.com/kel2020](https://kellytubesystems.com/kel2020/), because that was all Kelly
Tube Systems had given us and the client said *"pretty but approximate is totally fine as the final
build"*.

That stopped being the best available shape on 2026-09-10, when KTS sent real CAD. The client asked
on 2026-09-15: *"Can you use the STEP files to create \*exact\* models in PTSBLite? for the 4"
KEL2020 terminal and the KEL2020 Blower"*. Asked whether that meant the parts should also take their
real dimensions, he answered **"Real shape, app size."**

So the two units are now the CAD, and ADR-0026 is superseded for them. It still stands for split
sleeves, for the palette, and for the principle underneath all of it: the *app* owns how much space
a part occupies, and the media — now the geometry — owns what it looks like inside that space.

## What is taken from the STEP files

Two files from the 2026-09-10 drop: `A444200 4 Inch Blower Assy for KEL2020 3D.step` and
`A444940 3D 4 Inch Terminal.Body Fabrication For KEL2020 Assy DC.step`. Both are AP214 B-rep, a few
thousand faces each, and neither is a mesh — turning them into triangles needs a CAD kernel.

**Three things are dropped, and each is a judgement worth recording.**

- **The blower's power cord and plug.** The assembly models them trailing thirty feet from the unit.
  The app has no cord, and a part is scaled to fill its cell, so keeping the cord would leave the
  blower itself a third of a cell wide. Everything whose centre falls outside the body's own
  footprint goes.
- **The terminal's DC supply.** A second box standing clear of the unit in the same file. Only the
  group of parts touching the carrier barrel is kept.
- **Fasteners under 0.8 inches.** One 3/4 inch screw costs more triangles than the barrel it holds
  and is never more than a pixel or two across.

Tubes and bends are untouched, as the client asked again on 2026-09-14: *"ignore the tubes in the
step files entirely"*.

## Real shape, app size

The unit's own proportions are kept exactly; only the overall scale changes, and it changes
uniformly. Nothing about the space a part occupies moves: 1 cell is still 1 ft
([ADR-0001](0001-engineering-constraints-are-authoritative.md)), a terminal is still 2 ft
([ADR-0021](0021-a-terminal-is-two-feet-tall.md)), a blower still fills one cell, and a terminal
still turns with its ports ([ADR-0027](0027-a-terminal-turns-with-its-ports.md)).

- The **blower** is 11.56 in tall over a 6.1 in drum. Scaled to the foot it occupies that is a
  factor of 1.04 — very nearly true size, because the real unit really is about a foot tall. It
  therefore looks considerably slimmer than the drum it replaces. That slimness is the hardware.
- The **terminal** is 20.75 in end to end over a 6.2 in body. The app puts 1.9 ft between a
  terminal's two ports, so it is stretched by a factor of 1.10 to meet the tubes where they already
  leave it.

One consequence to be aware of rather than to fix here: the viewport draws tube at `TUBE_R`, a
5¼ in diameter, while the real ports are 4 in. A tube is now visibly fatter than the port it enters.
Whether the drawn tube should thin to its real size is the client's call, and it is on the board.

## The palette stays the app's

The STEP files carry per-face colours — a white fabrication, grey and black fittings, a yellow ring.
Those are read as *roles*, not as colours: a face is classified as body, trim, door or glass, and
the viewport draws each role in the palette ADR-0026 chose. That palette exists because the real
hardware is near-black and the viewport's ground is near-black too, and none of that has changed.

The green power light, send button and wordmark the old models carried are gone. They were drawn by
eye, the CAD does not place them where the app did, and the real markings are now in the geometry.
The accent ring at a blower's port stays: it says which way the unit faces, which is the viewport's
job and not the hardware's.

## Baked at authoring time, not loaded at runtime

`tools/bake-kel2020-parts.mjs` reads the STEP files and writes `src/data/kel2020-geometry.ts`. The
app ships that file and never sees a STEP file or a CAD kernel.

- **The STEP files are not in the repository.** They are a 10 MB client drop, they are not ours to
  redistribute, and the shapes change about never.
- **The importer is not a dependency.** `occt-import-js` is 12 MB of LGPL WebAssembly. Carrying it
  in `devDependencies` would put it in every CI run and every clone to serve a script run perhaps
  once a year, so the script asks for it to be installed for the run and removed afterwards, and
  says so when it is missing.
- **The geometry is quantised**: positions to 16 bits across each part's own box, normals to a byte
  per axis, and the meshes are decimated by vertex clustering to about 3,700 and 6,800 triangles.
  That is 216 KB of source, against roughly 900 KB for the same geometry as plain floating point.
  The error this introduces is a fiftieth of an inch at part scale.

The alternative — fetching a binary asset at runtime — was rejected because every mesh builder in
the renderer is synchronous, the ghost rebuilds on each cell the cursor crosses, and a loading state
for the two parts the app is about would be a poor trade for 200 KB.
