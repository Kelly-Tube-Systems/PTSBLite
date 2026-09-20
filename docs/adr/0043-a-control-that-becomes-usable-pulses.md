# ADR-0043: A control that becomes usable says so the same way everywhere

- **Status:** Accepted, amended
- **Date:** 2026-09-19
- **Amended:** 2026-09-20 — the pulse runs until the control is pressed rather than for three
  beats. See the amendment below.

Multi-user testing turned up one consistent complaint: people do not understand the obstacle tool.
Asked where testers actually lost the thread, the client narrowed it to the end of the sequence —

> Most issue is with (4), they don't understand that there is a "place" button and a "height"
> toggle.

— and then proposed a fix that is larger than the obstacle tool:

> A simple solution would be to have the box containing the place/height controls flash/glow after
> a successful 1-storey placement (either via 2 clicks or click and drag once we add it) but that
> may not be the best solution. On the other hand, it was made "each" of these flash/Glow
> (Autobuild when valid, finalize when valid, and this proposed obstacle box when valid) it will
> start to become intuitive/reenforced via consistent UI experience.

That last sentence is the decision, not the glow itself. The argument is that a tell only teaches
if it is the same tell every time.

## Decision

**Three controls share one class, `.ready-pulse`, and it means exactly one thing: this became
usable just now.** The three are Auto-Build once there are ports to route, Finalize once the checks
pass, and the obstacle height/Place strip once a footprint is drawn. The class is defined once in
`src/styles/app.css` beside `.topbtn`, for the reason recorded there: shared appearance that lives
inside one component ends up applied by accident.

**Applying the class is the trigger.** A CSS animation starts when its element gains the class, so
the render that turns a control on is the render that pulses it; nothing watches for the
transition, and nothing has to be told to stop. Auto-Build and Finalize gain and lose it with the
state that already decides their colour, so the two cannot disagree. The obstacle strip carries it
unconditionally, because that strip is only rendered once the draft has a footprint — appearing at
all is its transition.

**The pulse is an outline, not a shadow.** Two of the three already cast a box-shadow, and
animating that property would blink their shadow off and back on around the pulse. An outline also
costs no layout.

**The obstacle strip now wears the accent at rest, too.** It was outlined in the plain panel line,
which said nothing about being live; Auto-Build and Finalize say "usable" in green, and the strip
is on screen only when there is something to do with it.

## Consequences

- **A fourth control that becomes usable should pulse.** That is what makes the convention worth
  having; a new one that invents its own attention effect is the thing this ADR exists to prevent.
- **The pulse is not a validity indicator.** It fires on the transition and then stops. Whether a
  design is valid is still the status bar's label, its dot, and Finalize's colour.
- **Reduced motion drops the movement and keeps the colour.** The pulse is an attention-getter, and
  for some readers that is the problem rather than the fix.
- **Repeated transitions pulse repeatedly.** A design that goes valid, breaks, and goes valid again
  pulses Finalize each time. That is the intended reading — it is the moment, not the state.

## Amendment, 2026-09-20

The client tried it and asked for one thing back:

> Make the flash/glow for each of the 3 box/buttons flash until it is pressed. Also, make the
> finalize flash/glow every time a valid system = true.

**The pulse now runs until the control is pressed.** The animation is `infinite` rather than three
beats, and what stops it is the press — `useReadyPulse` in `src/components/ready-pulse.ts` holds
that one bit of state for all three controls, so the rule cannot drift between them.

This reverses the reasoning in "Applying the class is the trigger" only in part. Applying the class
still starts the pulse and no effect watches for the transition; what is new is that taking the
class off is now an event (the press) as well as a state change (the control ceasing to be usable).
The consequence below that said the pulse "fires on the transition and then stops" no longer holds:
it fires on the transition and waits.

The second sentence of the client's message is the re-arming rule, and it is the one this ADR
already had — a design that goes valid, breaks and goes valid again pulses Finalize each time, a
press ago or not. It survives because `useReadyPulse` forgets the press when the control stops
being usable, rather than on a timer. Auto-Build hangs its pulse on having something to route and
not on the button's own enabled state, so the moment spent routing is not read as the button going
away and coming back at the person who just pressed it.

**A control that is usable and has not been pressed now pulses indefinitely.** That is the point,
and it is also the cost: this is motion on screen for as long as the user ignores it. Reduced
motion still drops the movement entirely.

## What this does not answer

Whether the pulse actually fixes what testers were hitting is the client's to judge at
https://ptsblite.pages.dev. The other change he asked for in the same message — drawing an obstacle
by dragging corner to corner, rather than only by two clicks — is tracked separately and does not
depend on this one. He explicitly turned down the third option on the table, an on-screen "click
two opposite corners" hint: "I don't like the solution to 1 so let's ignore it."
