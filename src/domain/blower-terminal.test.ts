import { describe, expect, it } from "vitest";
import {
  BLOWER_TERMINAL_MESSAGES,
  blowerTerminalFootprint,
  blowerTerminalOrientation,
  blowerTerminalSeatCell,
  placeBlowerWithTerminal
} from "@/domain/blower-terminal";
import { addPart, designFromScene, emptyDesign } from "@/domain/design-state";
import {
  DEFAULT_FREE_PLACEMENT_MEMORY,
  FREE_PLACEMENT_ORIENTATIONS
} from "@/domain/free-placement";
import { bomRows } from "@/domain/parts";
import { BUILD_AREA } from "@/domain/sparse-grid";
import { computeTopology } from "@/domain/topology";
import { expectGridMatchesDesign } from "@/test/design-invariants";
import type { BlowerPart, TerminalPart, Vec3 } from "@/types";
import { cellKey } from "@/domain/vec3";

const CELL: Vec3 = [10, 4, 10];

function place(cell: Vec3, dir: Vec3, design = emptyDesign()) {
  return placeBlowerWithTerminal(design, {
    blowerId: "b1",
    terminalId: "t1",
    cell,
    orientation: dir
  });
}

function placedPair(cell: Vec3, dir: Vec3) {
  const result = place(cell, dir);
  if (!result.ok) throw new Error(`expected a placement, got: ${result.message}`);
  const blower = result.design.parts.find((p) => p.id === "b1") as BlowerPart;
  const terminal = result.design.parts.find((p) => p.id === "t1") as TerminalPart;
  return { design: result.design, blower, terminal };
}

describe("blowerTerminalSeatCell", () => {
  // The two cells in front of the blower, whichever way it faces. Which of them
  // the terminal is stored in flips with the sign of the direction, because a
  // terminal's body always runs the positive way (terminal.ts) — and getting
  // that wrong puts its second foot inside the blower.
  it("fills the two cells in front of the blower in every orientation", () => {
    for (const dir of FREE_PLACEMENT_ORIENTATIONS) {
      const ahead = [1, 2].map((n): Vec3 => [
        CELL[0] + dir[0] * n,
        CELL[1] + dir[1] * n,
        CELL[2] + dir[2] * n
      ]);
      const footprint = blowerTerminalFootprint(CELL, dir);
      expect(footprint.map(cellKey).sort()).toEqual([CELL, ...ahead].map(cellKey).sort());
    }
  });

  it("stores the terminal in the near cell facing up and the far one facing back", () => {
    expect(blowerTerminalSeatCell(CELL, [0, 1, 0])).toEqual([10, 5, 10]);
    expect(blowerTerminalSeatCell(CELL, [1, 0, 0])).toEqual([11, 4, 10]);
    expect(blowerTerminalSeatCell(CELL, [-1, 0, 0])).toEqual([8, 4, 10]);
    expect(blowerTerminalSeatCell(CELL, [0, 0, -1])).toEqual([10, 4, 8]);
  });
});

describe("placeBlowerWithTerminal", () => {
  it("seats the terminal on the blower's port in every orientation", () => {
    for (const dir of FREE_PLACEMENT_ORIENTATIONS) {
      const { design, blower, terminal } = placedPair(CELL, dir);
      expect(blower.dir).toEqual(dir);
      expect(terminal.axis).toEqual(dir);
      // Three ports between them and only one left open: the blower's is mated
      // to the near end of the terminal, which is what "together" means.
      const open = computeTopology(design).openPorts();
      expect(open).toHaveLength(1);
      expect(open[0].partId).toBe("t1");
      expect(open[0].dir).toEqual(dir);
      expectGridMatchesDesign(design);
    }
  });

  it("leaves two ordinary parts behind, not a third kind of part", () => {
    const { blower, terminal } = placedPair(CELL, [0, 1, 0]);
    expect(blower.type).toBe("blower");
    expect(blower.pedestalFeet).toBeUndefined();
    expect(terminal.type).toBe("terminal");
  });

  it("bills the two parts separately, with the blower's control box", () => {
    const { design } = placedPair(CELL, [0, 1, 0]);
    const qty = (key: string) => bomRows(design).find((row) => row.key === key)?.qty;
    expect(qty("blower")).toBe(1);
    expect(qty("terminal")).toBe(1);
    expect(qty("controlBox")).toBe(1);
    // No combined line, and nothing carrying a part number the catalog does not
    // stock: the pair is a way of placing, not a product.
    expect(bomRows(design).map((row) => row.key)).not.toContain("blowerTerminal");
  });

  it("places neither part when the terminal has nowhere to sit", () => {
    // The cell under the cursor is free; the one the terminal needs is not.
    const blocked = addPart(emptyDesign(), {
      id: "other",
      type: "blower",
      cell: [10, 6, 10],
      dir: [0, 1, 0]
    });
    const result = place(CELL, [0, 1, 0], blocked);
    expect(result).toEqual({ ok: false, message: BLOWER_TERMINAL_MESSAGES.seatBlocked });
  });

  it("reports the blower's own cell in the free placement tool's words", () => {
    const occupied = addPart(emptyDesign(), {
      id: "other",
      type: "blower",
      cell: CELL,
      dir: [0, 1, 0]
    });
    const result = place(CELL, [0, 1, 0], occupied);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("That cell is already occupied.");
  });

  it("refuses a pair that would stand out of the build area", () => {
    // One cell below the top: the blower fits, its terminal does not.
    const result = place([0, BUILD_AREA.height - 2, 0], [0, 1, 0]);
    expect(result).toEqual({ ok: false, message: BLOWER_TERMINAL_MESSAGES.seatBlocked });
  });

  it("erases as two parts, each on its own", () => {
    const { design } = placedPair(CELL, [0, 1, 0]);
    const withoutTerminal = designFromScene(
      { parts: design.parts.filter((p) => p.id !== "t1"), obstacles: [] },
      design.metadata
    );
    expect(withoutTerminal.parts.map((p) => p.id)).toEqual(["b1"]);
    expectGridMatchesDesign(withoutTerminal);
  });
});

describe("blowerTerminalOrientation", () => {
  it("starts where a blower starts and steps the same ring", () => {
    expect(blowerTerminalOrientation(DEFAULT_FREE_PLACEMENT_MEMORY, 0)).toEqual(
      FREE_PLACEMENT_ORIENTATIONS[0]
    );
    for (let steps = 1; steps <= FREE_PLACEMENT_ORIENTATIONS.length; steps++) {
      expect(blowerTerminalOrientation(DEFAULT_FREE_PLACEMENT_MEMORY, steps)).toEqual(
        FREE_PLACEMENT_ORIENTATIONS[steps % FREE_PLACEMENT_ORIENTATIONS.length]
      );
    }
  });

  it("reads the pair's own memory, not the blower tool's", () => {
    const memory = { ...DEFAULT_FREE_PLACEMENT_MEMORY, blowerTerminal: [1, 0, 0] as Vec3 };
    expect(blowerTerminalOrientation(memory, 0)).toEqual([1, 0, 0]);
    expect(memory.blower).toEqual(DEFAULT_FREE_PLACEMENT_MEMORY.blower);
  });
});
