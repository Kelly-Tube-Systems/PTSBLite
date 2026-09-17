# ADR-0036: The client corrects the tube part number

- **Status:** Accepted; the bend it held back followed the same day in [ADR-0037](0037-the-bend-takes-the-clients-number-on-his-say-so.md)
- **Date:** 2026-09-17

[ADR-0029](0029-real-part-numbers-arrive-in-part.md) took `ALP78403` for the straight tube from the
KTS parts folder of 2026-09-10, where it is listed as "4 O.D. Alum. Tube". On 2026-09-17 the client
listed the catalog again on the board, unprompted:

> The correct part numbers are as follows: bend is ALP08401, straight tube is ALP78435, blower unit
> A444200, terminal A444940, split sleeves ALP64401, and there is another part number for a part
> that is not shown visually, and that is the external power supply otherwise referred to as control
> box. The part number for that is AEA751032.

Three of those — the blower, the terminal and the split sleeve — are what `parts.json` already
prints, so the list reads as a check of the app's parts list against the real catalog. Two entries
disagree with it, and one is new.

## Decision

**The tube is `ALP78435`.** The client is the authority on their own catalog, and this is a later
and more direct statement than the folder: the folder was a delivery of models, the message is an
answer about numbers. It is also consistent with
[ADR-0030](0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md), where the client said
to "ignore the tubes in the step files entirely" — `ALP78403` was read off exactly those files, so
the one number in `parts.json` sourced from a part the client had already disowned is the one
number they corrected.

ADR-0029's table records what the folder contained and stays as it is; it is a record of a delivery,
not a claim about which number to print. This ADR supersedes the tube row of its decision only.

**The bend and the control box are not changed here.** Both differ from the folder by a single
digit — `ALP08401` against the folder's `ALP08404`, and `AEA751032` against `AEA51032` — and both
are on the board as questions rather than edits. The bend matters most: `ALP08404` is a 4 ft radius
part and the app draws the 3 ft radius the client confirmed in ADR-0030, so printing a real bend
number that turns out to be the 4 ft one would have someone order bends that do not fit the layout
they are holding. That is the same reasoning ADR-0029 used to hold the bend back, and it still
holds until the client confirms which radius `ALP08401` describes.

## Consequences

**A number the app published was wrong, and nothing in the app said it might be.** `ALP78403` sat in
released BOM PDFs looking exactly as authoritative as the numbers around it — the hazard
[ADR-0013](0013-lite-publishes-placeholder-part-numbers.md) names for invented numbers, reached here
by a sourced one instead. Sourcing a number from a vendor file is weaker evidence than it looked:
the folder named a part, not the part this app models.

**The BOM now asserts the tube number in a test.** `bomRows` was checked against the blower and
terminal numbers only. The tube is checked with them, so a catalog edit cannot quietly change what a
customer-facing parts list prints.

**The bend is still the only invented number**, so ADR-0030's count and the single-entry wording in
`CONTEXT.md` and `docs/baked-in-assumptions.md` stand.

## When to revisit

When the client answers the bend question (https://trello.com/c/KRcyIeAp), at which point
ADR-0013 is superseded outright, or the control box question
(https://trello.com/c/xQ9Kk9PE), which would add a part the app does not model.
