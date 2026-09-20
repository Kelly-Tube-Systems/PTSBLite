# ADR-0047: The active tool reads out in the footer rail

- **Status:** Accepted
- **Date:** 2026-09-20
- **Card:** [Tool pill: put its information in the empty space on the footer rail](https://trello.com/c/M5RYJLHW)
- **Supersedes the layout in:** [Tool pill: the Quick Start Guide covers it on a narrower window](https://trello.com/c/U5EBg7gR)

Since the first viewport the armed tool was named in a pill floating along the bottom of the
viewport, centred between the Quick Start Guide and the controls legend. The client reported twice
that the two corner boxes covered its ends on his window. The second fix sized the three panels
against each other so the pill kept clear of both at any width. He tried it and asked for something
else:

> Eh, I don't like it. Let's rethink this.
>
> Can we put the info pf the tool pill into the blank space on the footer rail? It's unused as far
> as I can tell, this will solve the overlapping menu issue and declutter the UI some.

## The rule

**The armed tool reads out in the footer rail, not over the viewport.** The rail already carries
the design's own numbers — `LENGTH`, `PARTS` — so the tool is written the same way: a `TOOL`
readout naming it and its catalog part number, and an `EL` readout giving the placement height and
its floor. They sit between the design's numbers and Finalize, centred in whatever the rail has
spare, and both are absent under the cursor tool, which places nothing.

**Nothing floats over the bottom of the viewport.** What is left there is two boxes in two corners.

## What follows

- **The overlap cannot come back.** The rail is a row of its own below the viewport, so no panel
  positioned in the viewport can reach it, at any window width. The clearance that has to be proved
  is now a text-measurement one — that the readout fits between `PARTS` and Finalize at the app's
  1200px minimum — and the smoke suite measures it in a real browser, on the longest label any tool
  has (the bend's name and number).
- **The keys live in the legend.** The pill carried `[` / `]`, `R` and `Esc` alongside the tool's
  name. The first two were already rows in the controls legend, gated by the same two predicates,
  so the rail would only have duplicated them — and decluttering was half of what was asked for.
  `Esc` was in the pill alone, so it became a legend row, offered whenever a tool is armed. The
  rail says what the tool is and where it will place; the legend says what the keyboard does.
- **The pair still shows two names and no numbers.** [ADR-0045](0045-the-blower-and-terminal-pair-is-a-placement-not-a-part.md)
  left the numbers off that one label because the pill was already long enough to be covered. The
  covering is gone but the reason survives it: the rail is shared with the design's numbers and
  Finalize, and two part numbers there are glanced at rather than read. They are on the Build
  drawer tile and on the two BOM lines.
- **The labels moved house, not owner.** `ActiveToolBar.tsx` is gone; what it knew — that names and
  numbers come from the catalog rather than being restated (ADR-0001) — is `active-tool.ts`, which
  the rail reads. `docs/baked-in-assumptions.md` calls that readout by its new name.

The client asked for this one twice in two different directions, which is worth saying plainly: the
first answer made the floating box behave, and he still did not want a floating box. A panel that
has to be held clear of two others is a panel in the wrong place.
