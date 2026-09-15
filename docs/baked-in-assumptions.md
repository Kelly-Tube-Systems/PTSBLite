# Baked-in assumptions

What the current model can and cannot express, so an incoming requirement can be sized in an
afternoon rather than a week.

This records the scope of each assumption, not a roadmap. Nothing here is a commitment to change, and
several entries are deliberate and correct.

**Entries are classified, because the categories cost wildly different amounts.** A workflow
limitation is usually days; a schema limitation reaches the serialized format, the grid, the renderer and
the router at once.

| Category | Meaning |
|---|---|
| **Schema** | The data model genuinely cannot represent it. Changing it touches the serialized format and everything downstream |
| **Workflow** | The state could hold it; the UI and validation assume otherwise |
| **Provisional** | A deliberate v1 fence, already documented, expected to be revisited |
| **Absent** | Simply not built |

---

## Schema

**1 cell = 1 ft, integer coordinates.** `Vec3` is a integer triple throughout, and `SparseGrid` keys
on it. Sub-foot placement, metric units, or a different resolution would change every geometry
module, the serialized format, and the renderer's cell-to-world mapping. *Authoritative per
[ADR-0001](adr/0001-engineering-constraints-are-authoritative.md) — this is a spec fact, not a
convenience.*

**Axis-aligned routing only.** Ports face one of six directions; the pathfinder expands along axes.
Diagonal or free-angle runs are not expressible.

**A part's own size is geometry in code, not a catalog field.** A blower is one cell; a terminal is
one cell square and two long ([ADR-0021](adr/0021-a-terminal-is-two-feet-tall.md)), lying along
whichever way it is turned ([ADR-0027](adr/0027-a-terminal-turns-with-its-ports.md)). The catalog's
`cells` is a count the geometry is checked against, not a shape it is built from, and no field
describes a footprint's dimensions — so a third endpoint of some other size means new geometry
alongside `terminal.ts`, not a catalog edit. Nothing is stored on the part either: the size comes
from the type and the second cell from the part's own axis, which is what keeps `partCells` a pure
function of the part and lets a design saved before a size change be re-read against the new one.

**One bend geometry: 90°, 3 ft radius.** A second radius or a 45° bend needs new catalog entries and
new footprint generation. See [ADR-0005](adr/0005-defer-the-bend-geometry-model.md).

**The 3 ft radius is the client's answer, not only the spec's.** The bend KTS shipped on
2026-09-10, `ALP08404`, is a 4 ft centreline radius in its CAD. The client was asked which figure
is right and kept 3 ft ([ADR-0030](adr/0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md)),
so the app has not moved and `ALP08404` is not its bend. What the app still lacks is a part number
for the 3 ft radius bend it does draw.

**One room per design, in a fixed build area.** The build area is always 300 × 300 × 100 ft
([ADR-0017](adr/0017-the-build-area-is-fixed-designs-have-rooms.md)); the welcome screen sizes a
single rectangular room centered in it, with penetrable 1 ft walls that claim no grid cells. A
two-floor room doubles its height and draws a separator slab
([ADR-0015](adr/0015-two-floor-volume-is-derived-not-stored.md)); it is still one box — no
additional rooms, zones, non-rectangular rooms, or per-floor footprints, and no third floor. The
client has asked about a drag-to-place room tool with a penetrable/impenetrable choice (Trello,
"Rooms"); that would make rooms occupants like obstacles, and has deliberately not been started.

**One design per browser profile.** A single design
autosaves to `localStorage` and is offered back on return
([ADR-0012](adr/0012-lite-persists-a-session-not-files.md)). It lives in one browser on one machine
— clearing site data loses it, and a different browser sees nothing. Storage is scoped to the
origin, so moving to a custom domain makes every stored design unreachable. Two tabs overwrite each
other, last write wins.

---

## Workflow

**Exactly two blowers, exactly two terminals.** `DesignState.parts` will hold any number of each —
the counts are enforced by `validation.ts`, not by the schema. Relaxing either is materially cheaper
than it looks. *See Provisional below for the two-terminal fence.*

**Single-direction system.** Assumed by how the topology is walked, not by the data.

**Nothing below Y = 0.** The ground plane is the floor. Basements or below-grade runs would need the
build area to describe a Y origin rather than assuming zero.

**An obstacle stands on the floor of its storey and stops at that storey's ceiling.** The obstacle
tool draws a footprint and a height; the base is the active floor, and inside the room the height
is capped at the ceiling. `Obstacle` carries `min` and `max` and would hold a volume floating in
mid-air perfectly well — a hanging duct, a beam under the ceiling, a mezzanine — and the pathfinder
and the renderer treat one no differently. What went was the base stepper the HUD used to carry,
at the client's request: a shelf has a height, not two numbers. Restoring a floating volume is a
control and a clamp, not a model change.

**A blower's pedestal is the only uncounted geometry, and it is a property rather than a part.**
`BlowerPart.pedestalFeet` holds the height of the mast under a blower placed with a pedestal; it is
drawn and it claims grid cells, but it reaches no BOM row, no tube footage and no centerline
([ADR-0020](adr/0020-a-pedestal-is-drawn-but-not-counted.md)). Nothing generalizes from it: there
is no notion of an uncounted part, and a second piece of hardware that "does not count" — a hanger,
a bracket, a wall mount — would be another property on another part rather than a category the
model already has. The mast measures down to whatever the blower stands on — the floor of the
storey, or the top of an impenetrable obstacle beneath it
([ADR-0032](adr/0032-a-pedestal-stands-on-what-is-beneath-it.md)) — and is refused when a part is
in that column. It does not follow a blower that is later re-elevated, because placed parts cannot
be moved at all (see *Selection and move*).

**Split sleeves are derived on every read, and the rule that places them is in code.** Sleeves are
not in `parts` and not in the saved design: `splitSleeves` recomputes them from the joints
([ADR-0022](adr/0022-split-sleeves-are-derived-not-placed.md)). The upside is that they can never
disagree with the run they sit on and that changing the rule re-sleeves every existing design; the
cost is that nothing can hold a sleeve the rule would not produce. Moving one, deleting one, adding
one where an installer would want it, or a design that records the sleeves as they were actually
fitted — all of those need sleeves to become occupants, not a spacing tweak. The client set the
spacing himself and knows it produces a 1 ft gap at the end of an odd run.

**A design's geometry answers are fixed once it is created.** The room, and the multi-floor
and plenum answers, are collected on the welcome screen and cannot be changed afterwards. Changing
one means starting a new design. `DesignMetadata` would hold an edit fine; what was deliberately
removed is the UI and the resize path that dropped parts no longer fitting a shrunken area.

**A design has no name.** No company name, no system name, no title anywhere — the room's
dimensions are the only thing distinguishing one design from another, and the exported BOM is
always `BOM.pdf`. Naming was built and then removed at the client's request; `DesignMetadata`
would hold it fine, so this is a product decision rather than a limitation of the model.

**No revision or version on a design.** `DesignMetadata` carried a `revision` string that printed
on the PDF, but nothing could ever set it, so every export claimed "Revision 0.1". Tracking which
revision a printed BOM belongs to is real work — history, comparison, a way to say what changed —
and a field nobody can edit is not the start of it. Removed rather than left as furniture.

---

## Provisional

**The exactly-two-terminals rule** is a v1 product fence, not a physical truth —
[ADR-0002](adr/0002-two-terminal-limit-is-a-v1-fence.md) says so explicitly. This is the single
largest determinant of how much routing and validation work the client's requirements imply, and
worth asking about early.

---

## Published catalog

**One part number in `src/data/parts.json` is still invented; the rest are real.** KTS delivered
part numbers on 2026-09-10 and answered the questions they raised on 2026-09-14: the blower is
`A444200` whether or not it stands on a pedestal, the terminal `A444940`, the tube `ALP78403` and
the split sleeve `ALP64401`. The bend still carries `BN-90-3R`, made up for the build, because the
number KTS supplied describes a 4 ft radius part and the client kept the 3 ft radius the app draws.
See [ADR-0029](adr/0029-real-part-numbers-arrive-in-part.md) and
[ADR-0030](adr/0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md).

**A mostly real catalog is easier to misread than an invented one.** `BN-90-3R` sits among real
numbers and looks like one, so which line is invented lives in ADR-0030 rather than in a reader's
memory. That number is still **published**: PTSBLite prints it into a BOM PDF that any member of the
public can download and keep, and nothing in the document marks it as identifying nothing. That is
a deliberate decision, recorded in
[ADR-0013](adr/0013-lite-publishes-placeholder-part-numbers.md), and it is the one place invented
data reaches a customer-facing artifact on purpose. Issue #94.

**A pedestal blower is one line on the parts list with the plain blower.** They are one KTS part,
so a design with one of each orders two of `A444200`; the row notes how many stand on a pedestal.
Nothing in the list describes the pedestal itself, because it is mounting rather than a part
([ADR-0020](adr/0020-a-pedestal-is-drawn-but-not-counted.md)).

**Part `name` values are ours, not KTS's.** They label the parts palette, the active-tool bar and
the BOM rows. The KTS catalog names are recorded in ADR-0029 and are what to quote when ordering.

**The parts look real, and are not modelled from the CAD.** The blower and terminal are modelled
from the Kel2020 marketing media rather than from CAD, accepted by the client as the final Lite
appearance ([ADR-0026](adr/0026-parts-are-modelled-from-marketing-media.md)). STEP files for both
arrived on 2026-09-10 and do **not** reopen the appearance — ADR-0026 stands, and nothing is
re-modelled from them; the 2026-09-14 answers were read as being about part numbers
([ADR-0030](adr/0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md)).

**The exported PDF carries pictures.** Five rendered views are captured from the live scene and
embedded after the parts list ([ADR-0018](adr/0018-the-exported-bom-carries-rendered-views.md)).
A document is now on the order of a megabyte rather than a few kilobytes, and a browser with no
WebGL exports the parts list alone rather than failing.

**Prices do not exist in this product.** The catalog cannot carry one: `loadPartRegistry` rejects
`unitPrice`, and the BOM model has no price field
([ADR-0011](adr/0011-lite-has-no-commercial-data-path.md)). A requirement that adds money changes
the product's scope and needs an explicit new decision.

**The stock-tube purchasing rule is an open question**, not a decision. `bomRows` currently uses
`ceil(total tube feet / 6)`, which assumes offcuts are not reused. See issue #48.

---

## Absent

**Selection and move.** The `cursor` tool is inert: it selects nothing and does nothing on click.
The only way to change a placed part is to erase it and place another. **This is the gap most likely
to appear in the client's requirements**, and it is substantial — it implies a selection model,
hit-testing beyond the current erase path, move/rotate operations that maintain the grid invariant,
and probably multi-select.

**Copy, duplicate, array, mirror.** No bulk operations of any kind.

**Part labels and an About screen.** Both existed and were removed. Nothing on screen names the
running build, so `appVersion` on a stored design is the only way to identify it.

**The camera has no free framing.** Dragging orbits, right-dragging pans, the wheel zooms, and the
View menu snaps to one of five named angles or back to the opening framing
(`renderer/camera-views.ts`). There is no way to save a view, to frame a selection, or to set a
distance numerically, and the five angles are constants — they are also what the exported PDF is
rendered from, so changing the list changes every document.

**Where a horizontal run belongs is a fixed rule, not a setting.** Auto-Build charges horizontal
feet and bends outside the run band extra during the search (`pathfinder.ts`), and every design has
a band: the plenum, the ceiling of a room 12 ft or lower, or a 12 ft ghost ceiling in a taller one
(ADR-0023) — or, for a system that never touches the building, 12 ft out in the open (ADR-0024),
which also means such a system goes over a building it can clear rather than through it, and a
terminal closer to a wall than a bend can turn in cannot be given that height at all. A
two-floor building has one band, upstairs, wherever its parts stand (ADR-0025), so there is no way
to keep a run downstairs. A route does get two heights along its length, but only the one split the
building makes: the band inside the room's footprint and the lower of the 1st floor's ceiling and
12 ft outside it (ADR-0028). Neither is chooseable, and there is no third.
The weights and the 12 ft are constants; nothing on screen exposes or tunes them, and a
banded route genuinely is longer — the climb's feet count against the 300 ft cap like any others.
The visitor cannot ask for a run at some other height, or for a flat one; more rise than the band
allows is built by hand.

**Any collaboration, cloud, account, or telemetry surface.** Deliberately. PTSBLite is
served as static files with a `connect-src 'none'` policy: nothing it does reaches the network
after load, so there is also no error reporting from production.

**A styled "you have unsaved work" prompt in the browser.** A browser offers only `beforeunload`,
whose message cannot be written or styled. Lite registers it solely while a write to storage has
failed, because autosave means there is otherwise nothing to lose.

---

## How to use this when requirements arrive

A requirement that only touches **Workflow** or **Absent** is ordinary feature work. One that
touches **Schema** needs a design pass and probably a serialized-format version bump. One that contradicts
an **Authoritative** constant (marked above and in `CONTEXT.md`) needs a cited source before
anything is written — that is what ADR-0001 exists to prevent.

When a requirement overturns an entry here, it produces a new ADR *and* an update to this file and
`CONTEXT.md` in the same commit, so the three cannot drift apart.
