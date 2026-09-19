# ADR-0030: The terminal and pedestal blower take their real numbers, and the bend stays at 3 ft

- **Status:** Accepted; the bend's number arrived on 2026-09-17, see [ADR-0037](0037-the-bend-takes-the-clients-number-on-his-say-so.md), the power box decision is superseded by [ADR-0038](0038-the-control-box-is-a-parts-list-line-with-no-model.md), where the client asks for it by name, and the pedestal blower it numbered was junked by the client in [ADR-0043](0043-the-client-junks-the-pedestal-blower.md) — `A444200` is unaffected, having always been the plain blower's number too
- **Date:** 2026-09-14

[ADR-0029](0029-real-part-numbers-arrive-in-part.md) put three of the seven KTS part numbers from
the 2026-09-10 drop into `parts.json` and held the rest behind two questions to the client. Both
were answered on the board on 2026-09-14:

> Ignore "A444942 — 4 Inch Terminal Assy w 3 Inch Insert". A444940 is the model to use for the
> terminal. Use the same model and part for blower no matter if it's elevated, wall mounted or on
> the floor. The only models we need from the drop are for the terminal and blower.

> Ignore the 4ft bend radius. Keep the 3ft bend radius we already have. Ignore the tubes in the
> step files entirely.

## Decision

**The terminal is `A444940`.** It replaces the invented `TM-2020-S`. `A444942`, the assembly with a
3 in insert, is not the part a PTSBLite parts list orders.

**A blower is `A444200` however it is mounted.** The pedestal variant in the Build drawer keeps its
own catalog entry, because that entry is what the palette button and the active-tool bar read, but
its `partNo` is now the plain blower's rather than the invented `BL-2020-P`. That makes the two
entries one KTS part, so `bomRows` lists them on one row: a design with a floor blower and a
pedestal blower orders two of `A444200`, not one each of two numbers. The pedestal count survives
as a note on that row ("1 on a pedestal"), the way the tube row notes its on-site cuts, so the
installer still knows a mount is needed. ADR-0020's rule is unchanged: the mast is drawn, not
counted, and nothing about it reaches the BOM.

**The bend stays at 3 ft, with its placeholder number.** The client kept the radius the app was
built on, so ADR-0001 holds and no geometry moves. `ALP08404` is a 4 ft radius part and does not go
on the list. No number for a 3 ft radius 90° bend was supplied, so `BN-90-3R` remains, and it is now
the only invented number `parts.json` carries.

**`AEA51032` stays out.** The power box was the third question; the answer names the terminal and
the blower as the only parts wanted from the drop. PTSBLite still models no power box.

**The STEP geometry is still not used.** "The only models we need from the drop" reads as an answer
to the question asked, which was about numbers on a parts list; the client was explicit in
[ADR-0026](0026-parts-are-modelled-from-marketing-media.md) that the media-based shapes are the
final Lite appearance, and "ignore the tubes in the step files entirely" points the same way. If
the client meant the STEP shapes to replace the current models, that is a separate request and a
separate decision.

## Consequences

The catalog is real for everything except the bend, so `CONTEXT.md`, `AGENTS.md` and
`docs/baked-in-assumptions.md` name that one entry rather than a set. ADR-0013's residual scope,
"the entries that remain invented", is now a single line, and the open question it and ADR-0029
carried about the radius is closed: 3 ft is the client's answer as well as the spec's.

The BOM has one row fewer. Nothing else reads `blowerPedestal` from the BOM; the palette, the
active-tool bar and the placement tools still do, and are unchanged.

## When to revisit

When KTS supplies a part number for the 3 ft radius 90° bend: a one-line `parts.json` edit, at
which point ADR-0013 is superseded outright.
