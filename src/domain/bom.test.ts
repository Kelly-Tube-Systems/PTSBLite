import { describe, expect, it } from "vitest";
import { designFromScene, emptyDesign } from "@/domain/design-state";
import { bomRows, partLength, totalPathLength, tubeFeet } from "@/domain/parts";
import { splitSleeveCount } from "@/domain/split-sleeve";
import type { DesignState, Part } from "@/types";

function designWith(parts: Part[]): DesignState {
  return designFromScene({ parts, obstacles: [] });
}

const sampleParts: Part[] = [
  { id: "b1", type: "blower", cell: [0, 0, 0], dir: [1, 0, 0] },
  { id: "t1", type: "terminal", cell: [1, 0, 0], axis: [1, 0, 0] },
  { id: "t2", type: "terminal", cell: [30, 0, 0], axis: [1, 0, 0] },
  // The run starts a foot past the terminal at [1, 0, 0]: it lies along X, so
  // [2, 0, 0] is its second foot (ADR-0027). Every length is unchanged.
  { id: "st1", type: "tube", from: [3, 0.5, 0], to: [9, 0.5, 0] },
  { id: "st2", type: "tube", from: [9, 0.5, 0], to: [15, 0.5, 0] },
  { id: "st3", type: "tube", from: [15, 0.5, 0], to: [18, 0.5, 0] },
  {
    id: "bn1",
    type: "bend",
    entry: [18, 0.5, 0],
    exit: [21, 0.5, 3],
    center: [21, 0.5, 0],
    inDir: [1, 0, 0],
    outDir: [0, 0, 1],
    radius: 3
  }
];

describe("BOM derivation", () => {
  it("partLength is zero for endpoint parts", () => {
    expect(partLength(sampleParts[0])).toBe(0);
    expect(partLength(sampleParts[1])).toBe(0);
  });

  it("partLength measures straight tubes by euclidean distance", () => {
    expect(partLength(sampleParts[3])).toBeCloseTo(6, 5);
    expect(partLength(sampleParts[5])).toBeCloseTo(3, 5);
  });

  it("partLength measures bends by quarter-circumference at the bend radius", () => {
    expect(partLength(sampleParts[6])).toBeCloseTo((Math.PI * 3) / 2, 5);
  });

  it("totalPathLength sums tube length and bend arc length", () => {
    const len = totalPathLength(sampleParts);
    expect(len).toBeCloseTo(6 + 6 + 3 + (Math.PI * 3) / 2, 5);
  });

  it("totalPathLength accepts a DesignState", () => {
    expect(totalPathLength(designWith(sampleParts))).toBeCloseTo(totalPathLength(sampleParts), 5);
  });

  it("tubeFeet counts only straight tube length", () => {
    expect(tubeFeet(sampleParts)).toBeCloseTo(15, 5);
  });

  it("bomRows aggregates parts into catalog rows", () => {
    const rows = bomRows(designWith(sampleParts));
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.blower.qty).toBe(1);
    expect(byKey.terminal.qty).toBe(2);
    expect(byKey.bend90.qty).toBe(1);
    expect(byKey.tube6.qty).toBe(Math.ceil(15 / 6));
    expect(byKey.tube6.note).toMatch(/15\.0ft total/);
    expect(byKey.tube6.note).toMatch(/1 cut on-site/);
    expect(byKey.blower.partNo).toBe("A444200");
    expect(byKey.terminal.partNo).toBe("A444940");
    // The client corrected the tube number after the parts folder shipped one
    // that was wrong (ADR-0036), so the BOM asserts it rather than trusting the file.
    expect(byKey.tube6.partNo).toBe("ALP78435");
    // The bend's number is the client's own, and he is not certain of it
    // (ADR-0037): it differs from the folder's 4 ft bend by one digit, so the
    // BOM names the number it prints rather than leaving it to the catalog file.
    expect(byKey.bend90.partNo).toBe("ALP08401");
  });

  it("bomRows counts a pedestal blower on the blower row, noting the pedestal", () => {
    // One KTS part however it is mounted (ADR-0030): a parts list handed to
    // KTS orders two of A444200, not one of each of two numbers.
    const parts: Part[] = [
      { id: "b1", type: "blower", cell: [0, 0, 0], dir: [1, 0, 0] },
      { id: "b2", type: "blower", cell: [5, 2, 0], dir: [1, 0, 0], pedestalFeet: 2 }
    ];
    const byKey = Object.fromEntries(bomRows(designWith(parts)).map((r) => [r.key, r]));
    expect(byKey.blower.qty).toBe(2);
    expect(byKey.blower.note).toBe("1 on a pedestal");
    expect(byKey.blowerPedestal).toBeUndefined();
  });

  it("bomRows leaves the blower row unannotated when nothing is on a pedestal", () => {
    const byKey = Object.fromEntries(bomRows(designWith(sampleParts)).map((r) => [r.key, r]));
    expect(byKey.blower.note).toBeUndefined();
  });

  it("bomRows counts the split sleeves the joins imply", () => {
    // The sample run is a chain of mated parts, so a sleeve falls on each join.
    // split-sleeve.test.ts covers where they land; this is the row existing.
    const byKey = Object.fromEntries(bomRows(designWith(sampleParts)).map((r) => [r.key, r]));
    expect(byKey.splitSleeve.qty).toBe(splitSleeveCount(sampleParts));
    expect(byKey.splitSleeve.qty).toBeGreaterThan(0);
    expect(byKey.splitSleeve.name).toBe("Split Sleeve");
  });

  it("bomRows yields zero quantities for an empty design", () => {
    const rows = bomRows(emptyDesign());
    expect(rows.every((r) => r.qty === 0)).toBe(true);
    expect(rows.map((r) => r.key).sort()).toEqual([
      "bend90",
      "blower",
      "splitSleeve",
      "terminal",
      "tube6"
    ]);
  });
});
