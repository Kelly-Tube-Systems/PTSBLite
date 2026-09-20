import { useState } from "react";

/**
 * The state behind `.ready-pulse`: whether a control that has just become
 * usable is still asking to be noticed.
 *
 * ADR-0043 made the pulse a three-beat tell fired by the transition, on the
 * grounds that nothing should be left blinking at someone who has already seen
 * it. The client watched testers miss it anyway — three seconds is only three
 * seconds — and asked for the pulse to run until the control is actually used.
 * So the tell is no longer a moment; it is "this is waiting for you", and what
 * ends it is the press.
 *
 * `ready` is whatever already decides the control is usable, so a control that
 * goes back to being unusable stops pulsing without anyone saying so, and is
 * armed again the next time it comes good. That re-arming is the same rule
 * ADR-0043 had: the design going valid afresh pulses Finalize afresh, however
 * many times it has already been pressed.
 */
export function useReadyPulse(ready: boolean): { pulsing: boolean; dismiss: () => void } {
  const [used, setUsed] = useState(false);
  const [wasReady, setWasReady] = useState(ready);

  // Becoming unusable is what re-arms the tell, and this is React's own way of
  // adjusting state when a prop changes: compare against the last render and
  // fix it up during this one, rather than in an effect that would render the
  // stale answer first and then correct it.
  if (wasReady !== ready) {
    setWasReady(ready);
    if (!ready) setUsed(false);
  }

  return {
    pulsing: ready && !used,
    dismiss: () => setUsed(true)
  };
}
