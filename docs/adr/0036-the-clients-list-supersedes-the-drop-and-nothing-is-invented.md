# ADR-0036: The client's own list supersedes the parts drop, and no part number is invented any more

- **Status:** Accepted
- **Date:** 2026-09-17

[ADR-0029](0029-real-part-numbers-arrive-in-part.md) took seven part numbers from the KTS parts
folder of 2026-09-10 and put three of them in `src/data/parts.json`.
[ADR-0030](0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md) added two more once the
client answered, and left the bend on the invented `BN-90-3R` because the only bend number in the
drop, `ALP08404`, describes a 4 ft radius part and the client had just kept the app's 3 ft radius.
ADR-0030 said what would end that: "when KTS supplies a part number for the 3 ft radius 90° bend: a
one-line `parts.json` edit".

On 2026-09-17 the client posted a list to the board, unprompted:

> The correct part numbers are as follows: bend is ALP08401, straight tube is ALP78435, blower unit
> A444200, terminal A444940, split sleeves ALP64401, and there is another part number for a part
> that is not shown visually, and that is the external power supply otherwise referred to as control
> box. The part number for that is AEA751032

Three of those six differ from the numbers the drop carried, each by a digit or two:

| Part | 2026-09-10 drop | 2026-09-17 list |
| --- | --- | --- |
| Straight tube | `ALP78403` | `ALP78435` |
| 90° bend | `ALP08404` | `ALP08401` |
| Power box | `AEA51032` | `AEA751032` |

## Decision

**The client's list is the source for part numbers, over the drop.** He wrote "the correct part
numbers are as follows" about a catalog he owns, which is the cited source
[ADR-0001](0001-engineering-constraints-are-authoritative.md) asks for; the drop is a folder of
files we were handed, and a filename or a STEP header is weaker evidence about what to order than
the client telling us what to order. Where the two disagree, his list wins.

**The tube becomes `ALP78435` and the bend becomes `ALP08401`.** The blower, terminal and split
sleeve were already the numbers he lists, so those lines do not move. This is the one-line edit
ADR-0030 anticipated, and `parts.json` now carries no invented number at all.

**`ALP08401` is read as the 3 ft radius bend, and no geometry moves.** ADR-0029 proved `ALP08404`
is a 4 ft radius part from the STEP file's own `TOROIDAL_SURFACE(..., 1219.2, 50.8)`. We have no
comparable evidence about `ALP08401` — only that the client gave it as the bend number after
deciding, on 2026-09-14, to keep the 3 ft radius the app draws. The coherent reading is that it is
the 3 ft variant of the same family, which is exactly the number ADR-0030 was waiting for. The
alternative reading — that he restated the 4 ft part's number from memory and got a digit wrong —
would mean a parts list that does not match its own drawing, so the question is on the card for him
rather than settled silently here. Either way the 3 ft radius stands: it is an authoritative
constraint under ADR-0001 and he confirmed it three days ago. Only the string in `partNo` changed.

**`AEA751032` is out of scope here.** The control box is a bill-of-materials row the client asked
for in a second card the same day, and it gets its own decision. This ADR records only that his
number for it differs from the drop's `AEA51032`, and that the same rule applies when that card is
built: his list wins.

## Consequences

**[ADR-0013](0013-lite-publishes-placeholder-part-numbers.md) is superseded outright**, as ADR-0030
said it would be. PTSBLite no longer publishes a placeholder part number, so the risk ADR-0013
existed to record — a plausible-looking invented number reaching a supplier on a PDF a stranger
downloaded — is gone rather than reduced, and with it the reason to consider a disclaimer notice on
the BOM PDF. Issue #94 is closed by this.

**`CONTEXT.md` and `docs/baked-in-assumptions.md` no longer name an exception.** Both had carried a
row or a paragraph singling out the bend since ADR-0029 made the catalog mixed. The catalog is
uniform again, which is the state a reader can hold in their head.

**The numbers in ADR-0029's table are now history, not the catalog.** That table records what the
drop contained and stays as written — it is the evidence for the 4 ft reading of `ALP08404`, which
is still the reason the app's bend radius was questioned at all.

## When to revisit

If the client says `ALP08401` was a slip, or supplies a KTS catalog name for it. A name would settle
the radius reading the way "4 O.D. 48R 90º Alum. Bend" settled `ALP08404`'s.
