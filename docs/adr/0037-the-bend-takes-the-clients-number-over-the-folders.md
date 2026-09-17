# ADR-0037: The bend takes the client's number over the folder's

- **Status:** Accepted; supersedes [ADR-0013](0013-lite-publishes-placeholder-part-numbers.md) outright
- **Date:** 2026-09-17

## Context

The bend has carried an invented number, `BN-90-3R`, since the catalog was written. It is the last
one: [ADR-0029](0029-real-part-numbers-arrive-in-part.md) and
[ADR-0030](0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md) put real numbers on the
blower, terminal and split sleeve, and [ADR-0036](0036-the-client-corrects-the-tube-part-number.md)
settled the tube.

It was held back for a specific reason. The KTS parts folder of 2026-09-10 contains a bend,
`ALP08404`, whose STEP file declares a 4 ft centreline radius — `TOROIDAL_SURFACE(..., 1219.2, 50.8)`,
a major radius of exactly 48.000 in. The app draws a 3 ft radius bend, and on 2026-09-14 the client
kept it: "Ignore the 4ft bend radius. Keep the 3ft bend radius we already have" (ADR-0030). Printing
a 4 ft part number on a parts list generated from 3 ft geometry would have someone order bends that
do not fit the layout they are holding, so ADR-0029 held the number rather than guess.

On 2026-09-17 the client listed the catalog unprompted and gave a bend number that is not the
folder's:

> The correct part numbers are as follows: bend is ALP08401, straight tube is ALP78435, blower unit
> A444200, terminal A444940, split sleeves ALP64401

`ALP08401` and `ALP08404` differ only in the last digit, which is exactly the shape of a
transcription slip — and the same message corrected the tube number, so the list is a check of our
parts list against the real catalog rather than a re-read of the folder. The client was asked which
number the 3 ft bend actually carries, and answered:

> great questions but unfortunately I don't know for now, but ship it with what I specified and we
> can change it later

## Decision

**The bend prints `ALP08401`.** The client's instruction is explicit and is the later statement.
`BN-90-3R` is retired, and `src/data/parts.json` now carries no invented part number at all.

**The number is the client's word, not a sourced fact.** The folder is a citable source for
`ALP08404` and for its 4 ft radius; nothing sources `ALP08401`. The client said outright that he
does not know today. So this is recorded as an instruction we followed, and the question behind it —
which number KTS stocks for a 3 ft radius bend, and whether such a part exists — stays open.

**The geometry does not move.** The bend's radius is 3 ft, an authoritative spec fact under
[ADR-0001](0001-engineering-constraints-are-authoritative.md) and confirmed by the client in
ADR-0030. `CONTEXT.md` derives the 7-cell staircase in a 4x4 bounding box from it, and the
pathfinder and every placed corner follow. Only the string on the parts list changes.

## Consequences

ADR-0013 is superseded outright, as ADR-0030's "when to revisit" anticipated. PTSBLite no longer
publishes a part number that identifies nothing, and the one place invented data reached a
visitor-facing artifact by decision is closed. The catalog is real throughout, so `CONTEXT.md`,
`AGENTS.md` and `docs/baked-in-assumptions.md` no longer name an exception.

The risk changes shape rather than disappearing. A downloaded BOM now carries five numbers the
client supplied, two of which — this one and the tube's — are his word against a folder that says
something else. `bom.test.ts` asserts both, so a slip back to a folder number fails a test instead
of reaching a released PDF.

If `ALP08401` turns out to describe the 4 ft bend after all, the fix is the same one line, and
nothing a customer has drawn moves: the radius was never derived from the number.

## When to revisit

When KTS confirms the number for a 3 ft radius 90° bend, or says no such part is stocked. The
second answer is the interesting one, because it would put the client's own 3 ft radius and his
catalog in conflict — a question for ADR-0001's process, not a catalog edit.
