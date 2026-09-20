import { partRegistry, type PartRegistry } from "@/domain/part-registry";
import { addPart } from "@/domain/design-state";
import { TERMINAL_HEIGHT_CELLS, terminalCells, terminalSeatCell } from "@/domain/terminal";
import { computeTopology } from "@/domain/topology";
import type { BlowerPart, DesignState, Ghost, Part, TerminalPart, Vec3 } from "@/types";
import { cellKey, vEq, vNeg } from "@/domain/vec3";

/**
 * The two things that place freely: the endpoints a valid system needs at each
 * end (ADR-0019). Both go down anywhere legal and snap to an open port under
 * the cursor.
 */
export type FreePlacementType = "blower" | "terminal";

/**
 * Every tool that remembers which way it was last turned.
 *
 * A superset of the tools that place freely, because the blower-and-terminal
 * pair turns on the same ring without placing as a single part: it is two free
 * placements, and it keeps its own slot so that turning the pair does not also
 * turn the plain blower tool. See blower-terminal.ts.
 */
export type OrientationMemoryKey = FreePlacementType | "blowerTerminal";

export type FreePlacementMemory = Record<OrientationMemoryKey, Vec3>;

/** The two ghost shapes free placement can produce, and no others. */
export type FreePlacementGhost = Extract<Ghost, { type: "blower" | "terminal" }>;

/** How many times `R` has been pressed since the tool was armed. */
export type FreePlacementRotation = number;

export const DEFAULT_FREE_PLACEMENT_ROTATION: FreePlacementRotation = 0;

/** Straight up. */
export const UP: Vec3 = [0, 1, 0];

/**
 * Every orientation `R` cycles through, in order.
 *
 * Up first, because that is where a part starts, then the four horizontal
 * headings. Down is deliberately absent: the client's rule is that "for this
 * version of the app, the hole will never face down".
 *
 * This replaced a pair of independent counters — `R` turning within the four
 * horizontal headings and shift-`R` toggling up/down — under which a blower
 * that had been turned sideways could never be pointed back up.
 */
export const FREE_PLACEMENT_ORIENTATIONS: Vec3[] = [
  UP,
  [1, 0, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, 0, -1]
];

/**
 * Which way a blower or terminal faces before anyone rotates it.
 *
 * Vertical, because a tube system is mostly risers: a blower sits on the floor
 * blowing up and a terminal takes its delivery from above far more often than
 * either points sideways. R still cycles the four horizontal headings, and
 * `resolveFreePlacementOrientation` already handles a base that is not one of
 * them — the first press lands on +X.
 *
 * This is a placement default, not a spec fact. Nothing in ADR-0001 constrains
 * which way a port may face.
 */
export const DEFAULT_FREE_PLACEMENT_MEMORY: FreePlacementMemory = {
  blower: UP,
  terminal: UP,
  blowerTerminal: UP
};

export const FREE_PLACEMENT_MESSAGES = {
  occupied: "That cell is already occupied.",
  outOfBounds: "Place inside the build area.",
  obstacle: "Place on an open grid cell, not an obstacle.",
  // A terminal stands 2 ft tall, so the cell above the cursor has to be free —
  // and out at the top of the build area there is no cell above it at all.
  // Said separately because "that cell is already occupied" would point at the
  // wrong square: the one under the cursor is free.
  terminalHeadroom: `A terminal stands ${TERMINAL_HEIGHT_CELLS}ft tall — there is no room above that cell.`,
  // And once R has turned it onto its side the second foot is beside the
  // cursor rather than above it, so the message has to point somewhere else.
  // Naming the direction is what stops it reading as a repeat of the last one.
  terminalClearance: `A terminal turned on its side is ${TERMINAL_HEIGHT_CELLS}ft long — there is no room beside that cell.`
} as const;

export type PlaceFreePartResult =
  | { ok: true; design: DesignState; part: BlowerPart | TerminalPart }
  | { ok: false; message: string };

function orientationIndex(dir: Vec3): number {
  return FREE_PLACEMENT_ORIENTATIONS.findIndex((candidate) => vEq(candidate, dir));
}

function modulo(n: number, d: number): number {
  return ((n % d) + d) % d;
}

/**
 * Turn an orientation `steps` places around the ring. The ring is closed, so
 * `R` stepping one way reaches every orientation in it.
 *
 * An orientation the ring does not hold — a part snapped to a downward-facing
 * port, say — enters the ring at the top on the first press rather than being
 * stuck, so a rotate key never appears to do nothing.
 */
export function rotateOrientation(base: Vec3, steps: number): Vec3 {
  if (steps === 0) return base;
  const index = orientationIndex(base);
  if (index < 0) return FREE_PLACEMENT_ORIENTATIONS[modulo(steps - 1, LENGTH)];
  return FREE_PLACEMENT_ORIENTATIONS[modulo(index + steps, LENGTH)];
}

const LENGTH = FREE_PLACEMENT_ORIENTATIONS.length;

export function resolveFreePlacementOrientation(base: Vec3, steps: FreePlacementRotation): Vec3 {
  return rotateOrientation(base, steps);
}

/** Where an armed part would be set down: the cell it is stored in, and which
 * way it faces. */
export type FreePlacementSeat = { cell: Vec3; orientation: Vec3 };

/**
 * Both halves of that answer, worked out together so the ghost and the click
 * that follows it cannot disagree.
 *
 * The orientation is where the part would snap, or what it was last turned to,
 * carried `steps` further round the ring. It is worked out here rather than
 * read off the ghost because a refused ghost is null, and a terminal refused
 * for want of room has to be refused in the orientation it was turned to —
 * otherwise the message names the wrong blocked cell.
 *
 * The cell is the one under the cursor, except for a terminal seating on a
 * port. A terminal is 2 ft long and its body always runs the positive way along
 * its axis, so on a port that faces back along an axis — west or north, or
 * straight down — storing it in the port cell runs its second foot back through
 * the part it was seating against. `terminalSeatCell` starts it one further
 * along instead, so the body fills the two cells in front of the port whichever
 * way that port faces. Rotating off the port's heading gives up the seat: it is
 * an ordinary placement at the hovered cell again, in the direction `R` chose.
 */
export function freePlacementSeat(
  design: DesignState,
  type: FreePlacementType,
  cell: Vec3,
  memory: FreePlacementMemory,
  rotationSteps: FreePlacementRotation
): FreePlacementSeat {
  const snapDir = computeTopology(design).openPortsNear(cell)[0]?.dir;
  const base = snapDir ? (type === "terminal" ? snapDir : vNeg(snapDir)) : memory[type];
  const orientation = resolveFreePlacementOrientation(base, rotationSteps);
  const seated = type === "terminal" && snapDir && vEq(orientation, snapDir);
  return { cell: seated ? terminalSeatCell(cell, snapDir) : cell, orientation };
}

export function rememberFreePlacementOrientation(
  memory: FreePlacementMemory,
  type: OrientationMemoryKey,
  orientation: Vec3
): FreePlacementMemory {
  return { ...memory, [type]: orientation };
}

export function validateFreePlacementCell(
  design: DesignState,
  cell: Vec3
): { ok: true } | { ok: false; message: string } {
  if (!design.grid.withinBounds(cell)) {
    return { ok: false, message: FREE_PLACEMENT_MESSAGES.outOfBounds };
  }
  const occupant = design.grid.query(cell);
  if (!occupant) return { ok: true };
  if (design.obstacles.some((o) => o.id === occupant)) {
    return { ok: false, message: FREE_PLACEMENT_MESSAGES.obstacle };
  }
  return { ok: false, message: FREE_PLACEMENT_MESSAGES.occupied };
}

/**
 * The cells a free-placed part would claim: one for a blower, two end to end
 * for a terminal, along whichever way it is turned (terminal.ts).
 *
 * The catalog's declared `cells` is checked against that rather than assumed,
 * for the reason `assertDeclaredCellCount` gives for bends: the field is load
 * bearing, and a catalog edit that disagreed with the geometry used to pass
 * unnoticed.
 */
export function freePlacementFootprint(
  type: FreePlacementType,
  cell: Vec3,
  orientation: Vec3,
  registry: PartRegistry = partRegistry
): Vec3[] {
  const cells = type === "terminal" ? terminalCells(cell, orientation) : [cell];
  const declared = registry.get(type).cells ?? 1;
  if (cells.length !== declared) {
    throw new Error(
      `Free placement: ${type} occupies ${cells.length} cells but the catalog declares ${declared}`
    );
  }
  return cells;
}

/**
 * Whether the whole footprint is free, naming the part of it that is blocked
 * when the blocked cell is not the one under the cursor: reporting "that cell
 * is already occupied" would point at the wrong square, since the cell being
 * pointed at is the one that is free.
 */
function validateFreePlacementFootprint(
  design: DesignState,
  type: FreePlacementType,
  cell: Vec3,
  orientation: Vec3
): { ok: true } | { ok: false; message: string } {
  const ownCell = validateFreePlacementCell(design, cell);
  if (!ownCell.ok) return ownCell;
  // Through `freePlacementFootprint` rather than `terminalCells` directly, so
  // the catalog's declared `cells` is checked on the path every placement takes
  // (see `assertDeclaredCellCount`).
  const [, second] = freePlacementFootprint(type, cell, orientation);
  if (second && !validateFreePlacementCell(design, second).ok) {
    return {
      ok: false,
      message:
        second[1] === cell[1]
          ? FREE_PLACEMENT_MESSAGES.terminalClearance
          : FREE_PLACEMENT_MESSAGES.terminalHeadroom
    };
  }
  return { ok: true };
}

export function freePlacementGhost({
  type,
  design,
  cell,
  memory,
  rotationSteps
}: {
  type: FreePlacementType;
  design: DesignState;
  cell: Vec3;
  memory: FreePlacementMemory;
  rotationSteps: number;
}): FreePlacementGhost | null {
  // Seat first: a terminal turned on its side claims a different pair of cells
  // from one standing up, and one seating on a port starts a cell further along
  // than the cursor, so which cells have to be free is not known until the
  // ghost knows where it is going and which way it is facing.
  const seat = freePlacementSeat(design, type, cell, memory, rotationSteps);
  if (!validateFreePlacementFootprint(design, type, seat.cell, seat.orientation).ok) return null;
  return type === "terminal"
    ? { type, cell: seat.cell, axis: seat.orientation }
    : { type, cell: seat.cell, dir: seat.orientation };
}

export function placeFreePart(
  design: DesignState,
  {
    id,
    type,
    cell,
    orientation
  }: {
    id: string;
    type: FreePlacementType;
    cell: Vec3;
    orientation: Vec3;
  }
): PlaceFreePartResult {
  const validity = validateFreePlacementFootprint(design, type, cell, orientation);
  if (!validity.ok) return validity;
  const part: Part =
    type === "terminal"
      ? { id, type, cell, axis: orientation }
      : { id, type, cell, dir: orientation };
  return {
    ok: true,
    part,
    design: addPart(design, part)
  };
}

/**
 * The cells the viewport highlights when a blower or terminal is armed: every
 * open port's landing cell.
 *
 * Both endpoint kinds snap the same way, so both light up the same cells.
 * Before anything is placed there are no open ports and nothing lights up,
 * which is correct — the first blower goes down in open space.
 */
export function freePlacementLandingCells(design: DesignState): Vec3[] {
  const seen = new Set<string>();
  const cells: Vec3[] = [];
  for (const port of computeTopology(design).openPorts()) {
    if (!validateFreePlacementCell(design, port.cell).ok) continue;
    const key = cellKey(port.cell);
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push(port.cell);
  }
  return cells;
}
