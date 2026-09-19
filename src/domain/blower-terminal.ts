import {
  placeFreePart,
  resolveFreePlacementOrientation,
  validateFreePlacementCell,
  type FreePlacementMemory,
  type FreePlacementRotation
} from "@/domain/free-placement";
import { terminalBodyDir, terminalCells } from "@/domain/terminal";
import type { DesignState, Vec3 } from "@/types";
import { vAdd, vEq, vScale } from "@/domain/vec3";

/**
 * The blower and terminal placed together, in one click.
 *
 * Nothing new is modelled here. The client asked for "the existing terminal and
 * blower in its most common use case: together", so this lays down the two
 * parts the catalog already stocks, in the arrangement the app already snaps
 * them into, and then has nothing further to say about them: once down they are
 * an ordinary blower and an ordinary terminal, each with its own id, its own
 * grid cells and its own BOM line. There is no third part number, no third
 * `Part` type, and no record that the two arrived together — erasing one leaves
 * the other exactly where a separately placed one would be.
 */

export const BLOWER_TERMINAL_MESSAGES = {
  // The blower's own cell is free — it is the two in front of it that are not —
  // so none of the free-placement messages points at the right square.
  seatBlocked: "The terminal that comes with it has nowhere to sit in front of the blower."
} as const;

/**
 * Where the terminal sits: its body fills the two cells in front of the
 * blower's port, running away from the unit along the blower's own direction.
 *
 * Which of those two cells the terminal is *stored* in depends on the way it is
 * turned, and that is the whole reason the seat is computed rather than assumed
 * to be the port cell. A terminal's body runs along `terminalBodyDir`, which
 * normalizes an axis to its positive direction (terminal.ts), so a terminal on
 * a blower facing +X is stored in the nearer of the two cells and one on a
 * blower facing -X in the further — the same two cells either way, entered from
 * opposite ends. Storing it in the port cell regardless would put its second
 * foot back inside the blower for the two negative headings.
 */
export function blowerTerminalSeatCell(blowerCell: Vec3, dir: Vec3): Vec3 {
  const body = terminalBodyDir(dir);
  return vAdd(blowerCell, vEq(body, dir) ? dir : vScale(dir, 2));
}

/** Every cell the pair claims: the blower's, and the terminal's two. */
export function blowerTerminalFootprint(blowerCell: Vec3, dir: Vec3): Vec3[] {
  return [blowerCell, ...terminalCells(blowerTerminalSeatCell(blowerCell, dir), dir)];
}

/**
 * Which way the pair faces before anyone turns it, and after each `R`.
 *
 * Unlike a lone blower or terminal this does not snap to an open port, because
 * there is nothing to snap by: a blower has exactly one port and the terminal
 * that comes with it is already on it, so the pair arrives with its blower end
 * closed. Its free end is the far end of the terminal, three cells from the
 * cursor, and swinging the whole unit round to bring that end to a port would
 * leave the pair somewhere other than where it was clicked. So the pair is
 * aimed by hand and Auto-Build connects it to the rest, which is how a design
 * with an endpoint at each end gets built anyway.
 *
 * It steps the same ring a blower does, out of the pair's own slot in the
 * orientation memory, so turning the pair does not also turn the blower tool.
 */
export function blowerTerminalOrientation(
  memory: FreePlacementMemory,
  rotationSteps: FreePlacementRotation
): Vec3 {
  return resolveFreePlacementOrientation(memory.blowerTerminal, rotationSteps);
}

/**
 * Whether the pair would go down here, and what to say when it would not.
 *
 * The blower's own cell is reported in the free placement tool's words, since
 * it is the square under the cursor and those messages name it correctly. The
 * terminal's two cells get their own message: they are in front of the cursor
 * rather than under it, and a visitor reading "that cell is already occupied"
 * would look at the wrong square.
 */
export function validateBlowerTerminalFootprint(
  design: DesignState,
  cell: Vec3,
  orientation: Vec3
): { ok: true } | { ok: false; message: string } {
  const ownCell = validateFreePlacementCell(design, cell);
  if (!ownCell.ok) return ownCell;
  for (const seatCell of terminalCells(blowerTerminalSeatCell(cell, orientation), orientation)) {
    if (!validateFreePlacementCell(design, seatCell).ok) {
      return { ok: false, message: BLOWER_TERMINAL_MESSAGES.seatBlocked };
    }
  }
  return { ok: true };
}

export type PlaceBlowerWithTerminalResult =
  { ok: true; design: DesignState } | { ok: false; message: string };

/**
 * Put both parts down, or neither.
 *
 * Each half goes through `placeFreePart`, so the pair inherits every rule a
 * separately placed blower or terminal obeys and the grid stays in step with
 * the parts list without this module knowing how either is registered. The
 * footprint is checked as a whole first, so a refusal names the right square
 * and the caller never sees a design with only the blower in it.
 */
export function placeBlowerWithTerminal(
  design: DesignState,
  {
    blowerId,
    terminalId,
    cell,
    orientation
  }: { blowerId: string; terminalId: string; cell: Vec3; orientation: Vec3 }
): PlaceBlowerWithTerminalResult {
  const fits = validateBlowerTerminalFootprint(design, cell, orientation);
  if (!fits.ok) return fits;
  const blower = placeFreePart(design, { id: blowerId, type: "blower", cell, orientation });
  if (!blower.ok) return blower;
  const terminal = placeFreePart(blower.design, {
    id: terminalId,
    type: "terminal",
    cell: blowerTerminalSeatCell(cell, orientation),
    orientation
  });
  if (!terminal.ok) return terminal;
  return { ok: true, design: terminal.design };
}
