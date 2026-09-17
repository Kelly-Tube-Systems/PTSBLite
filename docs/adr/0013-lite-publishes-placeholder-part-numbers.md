# ADR-0013: PTSBLite publishes placeholder part numbers

- **Status:** Superseded outright by [ADR-0037](0037-the-bend-takes-the-clients-number-over-the-folders.md)
- **Date:** 2026-08-03

Real numbers arrived in three instalments — the blower, tube and split sleeve on 2026-09-10
([ADR-0029](0029-real-part-numbers-arrive-in-part.md)), the terminal and pedestal blower on
2026-09-14 ([ADR-0030](0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md)), and the
bend on 2026-09-17 (ADR-0037). Nothing in `parts.json` is invented now, so this ADR governs no
entry and is kept for the record.

## Context

`src/data/parts.json` ships invented names and part numbers. `CONTEXT.md` has always said so, and
`BL-2020-A`, `TM-2020-S`, `ST-06-4OD` and `BN-90-3R` look exactly as authoritative as real ones
would. Replacing them is issue #94, still open.

PTSBLite is public, and its BOM export is a PDF a visitor downloads and keeps, potentially
forwarding it to a supplier or back to Kelly Tube Systems. A plausible-looking invented number is
worse than an obviously missing one because the audience has no reason to know it is a placeholder.

Three options were put to the owner: wait for the real catalog before launching; ship a visible
notice on the BOM PDF saying the numbers are provisional and not for ordering; or publish the
placeholders deliberately.

## Decision

**Publish the placeholders for now.** The owner's call, made explicitly.

No notice is added to the PDF. Adding one was offered and not taken.

## Consequences

A bill of materials downloaded from PTSBLite today contains part numbers that identify
nothing. Anyone acting on one — ordering against it, or pricing it — is acting on invented data,
and nothing in the document says so.

This is the one place in the codebase where invented data reaches a visitor-facing artifact by
decision rather than by accident. It is recorded here to keep the exception visible rather than
tacit.

The catalog loader still refuses an entry carrying a `unitPrice`. Prices are not part of this
decision and remain absent entirely — see
[ADR-0011](0011-lite-has-no-commercial-data-path.md).

## When to revisit

When issue #94 delivers the real catalog. At that point this ADR is superseded rather than amended:
`parts.json` is replaced, `CONTEXT.md`'s "Placeholder" row for part numbers becomes obsolete, and
the risk this records disappears.

That happened piecemeal rather than whole, across ADR-0029, ADR-0030 and finally
[ADR-0037](0037-the-bend-takes-the-clients-number-over-the-folders.md) on 2026-09-17. With the bend
numbered, `parts.json` carries no invented entry, `CONTEXT.md`'s row names no exception, and the
risk recorded here is gone as written.

What replaced it is narrower and lives in ADR-0037: two of the numbers are the client's word
against a parts folder that says otherwise, so a BOM can now carry a real number for the wrong
part. The notice on the PDF stays available as the cheap middle option if that ever needs saying
out loud — it is roughly one line of `bom-pdf.ts` — but it is not this ADR's decision to make any
more.
