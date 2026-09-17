# ADR-0037: The bend takes the client's number, unconfirmed

- **Status:** Accepted
- **Date:** 2026-09-17

[ADR-0029](0029-real-part-numbers-arrive-in-part.md) held the bend back from the 2026-09-10 parts
folder because the bend in it, `ALP08404`, is a **4 ft** centreline radius part and the app draws a
**3 ft** radius. [ADR-0030](0030-the-terminal-and-pedestal-blower-take-their-real-numbers.md) asked
the client which figure was right; he kept 3 ft, so the number stayed off the list and the bend kept
`BN-90-3R`, invented for the build.

On 2026-09-17 the client listed his catalog on the board and gave `ALP08401` for the bend — the
folder's number bar the last digit ([ADR-0036](0036-the-client-corrects-the-tube-part-number.md)).
He was asked whether `ALP08401` is the 3 ft radius bend or a slip for the 4 ft `ALP08404`, because
printing a 4 ft number on a parts list generated from 3 ft geometry would have someone order bends
that do not fit their layout. He answered:

> great questions but unfortunately I don't know for now, but ship it with what I specified and we
> can change it later.

## Decision

**The bend prints `ALP08401`.** The client owns his catalog and has instructed us to print it in
the knowledge that it is unverified. That retires `BN-90-3R`: no part number in `src/data/parts.json`
is invented any more.

**The radius does not move.** The app still draws a 3 ft radius bend, as
[ADR-0001](0001-engineering-constraints-are-authoritative.md) and ADR-0030 require. `ALP08401` is
printed as the number the client gave for the bend in his system, not as evidence about its
geometry; if it turns out to describe `ALP08404`'s 4 ft part, that reopens the radius question
rather than settling it.

**The uncertainty is recorded rather than resolved.** "I don't know for now" is not a confirmation,
so `docs/baked-in-assumptions.md` carries the number as unconfirmed and this ADR is where the
resemblance to `ALP08404` is written down. Nothing in the app marks it, because nothing in the app
could mark it honestly: the client is the authority on the catalog and he has told us to print it.

## Consequences

**ADR-0013 is spent.** It governed "the entries that remain invented", and there are none; it is
superseded here rather than in part. Its reasoning survives in changed form.

**The hazard it named has changed shape, not disappeared.** ADR-0013 warned that an invented number
looks exactly as authoritative as a real one on a document a customer can download. The catalog no
longer publishes a number that identifies nothing — it publishes one that may identify the wrong
part, which a reader can tell apart from a confirmed number even less easily. The mitigation is the
same and still only documentary: the ADRs say which numbers were verified and which were taken on
the client's word.

**The BOM asserts the bend number in a test**, as ADR-0036 made it assert the tube's. Two of the
five numbers on a customer-facing parts list have now been wrong at some point, and neither was
caught by a test of the catalog file.

## When to revisit

When the client confirms what `ALP08401` describes — the card is
https://trello.com/c/KRcyIeAp, and he has said the number can change. If the answer is that it is
the 4 ft `ALP08404` part after all, the bend radius question reopens with it (ADR-0030), and that is
a geometry decision before it is a catalog one.
