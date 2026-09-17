# ADR-0037: The bend takes the client's number on his say-so

- **Status:** Accepted
- **Date:** 2026-09-17

The 90° bend is the last entry in `src/data/parts.json` carrying a number nobody can order:
`BN-90-3R`, made up during the build. [ADR-0029](0029-real-part-numbers-arrive-in-part.md) held it
back when the KTS parts folder arrived, because the folder's bend, `ALP08404`, is a **4 ft**
centreline radius part — its STEP file declares `TOROIDAL_SURFACE(..., 1219.2, 50.8)`, a major
radius of exactly 48 in — and the app draws a 3 ft radius bend.
[ADR-0030](0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md) kept the 3 ft radius at
the client's own instruction, so the mismatch stayed and so did the placeholder. ADR-0030 named what
would end it: "when KTS supplies a part number for the 3 ft radius 90° bend: a one-line `parts.json`
edit".

On 2026-09-17 the client listed the catalog on the board and gave the bend as `ALP08401` — one digit
from the folder's `ALP08404`. [ADR-0036](0036-the-client-corrects-the-tube-part-number.md) took his
correction for the tube the same day and deliberately left the bend alone, because a wrong bend
number is the one that costs a delivery. The question went to him instead: is `ALP08401` the 3 ft
radius bend? His answer, an hour later:

> great questions but unfortunately I don't know for now, but ship it with what I specified and we
> can change it later.

## Decision

**The bend is `ALP08401`.** Not because the radius question is answered — it is not — but because
the client, who owns the catalog and carries the consequence, was shown the risk in plain terms and
chose to ship. That is the same authority ADR-0036 rested on, exercised with less certainty behind
it, and it is his to exercise.

**The geometry does not move.** The 3 ft radius is an authoritative constraint under
[ADR-0001](0001-engineering-constraints-are-authoritative.md), confirmed by the client on
2026-09-14, and nothing here reopens it: `arcLength` is untouched, every footprint is identical, and
no saved design changes. Only the string in `partNo` is different.

**The uncertainty is recorded rather than resolved.** `docs/baked-in-assumptions.md` now states in
as many words that the bend's number rests on the client's word alone, that the parts list may
therefore name a 4 ft bend beside a drawing of a 3 ft one, and that the app cannot tell. An
assumption the client has knowingly accepted still belongs in the file that says what the model
cannot express — that is what makes it reversible on purpose rather than by accident.

## Consequences

**[ADR-0013](0013-lite-publishes-placeholder-part-numbers.md) is superseded outright**, exactly as
ADR-0030 predicted. PTSBLite publishes no invented part number at all now. The risk ADR-0013 was
written to record — a plausible-looking fiction on a PDF a stranger downloads and forwards to a
supplier — is gone, and the disclaimer notice it kept on the table is no longer worth considering
for that reason. Issue #94 is closed by this.

**A different risk replaces it, and it is smaller but not zero.** A wrong-but-real number fails
differently from an invented one: `BN-90-3R` matches nothing and stops an order, while `ALP08401`
may match a part that does not fit the drawing beside it. What makes that acceptable here is not
the size of the risk but who chose it, with what in front of them.

**`CONTEXT.md` and `docs/baked-in-assumptions.md` stop naming an exception.** Both have carried a
row or a paragraph singling the bend out since ADR-0029 made the catalog mixed; the mixed-catalog
hazard those warnings existed for is over. What they carry instead is the weaker claim behind the
bend's number, which is a different warning with a different remedy.

**The BOM asserts the bend number**, alongside the blower, terminal and tube ADR-0036 pinned there.
A customer-facing parts list should not be able to change its numbers through an unreviewed catalog
edit.

## When to revisit

When the client can say which radius `ALP08401` describes, or supplies its KTS catalog name — a name
would settle it the way "4 O.D. 48R 90º Alum. Bend" settled `ALP08404`. If it turns out to be the
4 ft part, the choice is a corrected number or a reopened radius, and the second of those is not a
one-line edit: it moves the 7-cell footprint, Auto-Build's routing, bend spacing and every design
already saved.
