# ADR-0031: The height setting returns to the floor after an endpoint

- **Status:** Accepted
- **Date:** 2026-09-15

The height a part is placed at is set with `[` and `]` and, until now, stayed where it was left: a
blower placed at 3 ft left the next part's ghost at 3 ft too. The client asked for the setting to
"reset back to zero" after placing a part.

The plain version has a cost. A tube only lands on a port when the height setting matches that
port's height, so a reset after every placement turns a run at height into three key presses per
piece. The client was given three options — reset after every placement, reset only after a blower
or terminal, or leave it sticky and junk the request — and chose the middle one: "Height should go
back to 0 ft after placing a blower or a terminal."

## The rule

**Once a blower, pedestal blower or terminal is placed, the height setting goes back to the floor
of the storey it was placed from.** Downstairs, and in a single-floor design, that is 0 ft, as the
client said. Upstairs it is the second floor's own floor: sending the plane to the ground from
there would change the active floor, and the camera with it, which is not what "back to zero"
asked for. The floor selector puts the plane in the same place.

Tubes and bends keep the height they are working at. A refused placement changes nothing.

## What this costs

The first tube after a raised blower needs the setting put back up to the port's height before it
will land. The client accepted that in choosing this option over the sticky setting, so a future
change that makes the setting sticky again to spare those key presses is reversing a decision, not
fixing a bug.

## Where it lives

`attemptPlacement` in `placement-session.ts` returns the session with the elevation moved, the
same way an elevation key moves it, so the hover cell and the ghost drop with the plane and the
viewport re-picks under the pointer on the new plane. `floorBeneath` in `floors.ts` says which
floor that is; the height markers already used the same rule to decide which floor a raised part
casts its shadow on.
