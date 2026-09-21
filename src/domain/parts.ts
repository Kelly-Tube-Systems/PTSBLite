import { partRegistry } from "@/domain/part-registry";
import { SPLIT_SLEEVE_KEY, splitSleeveCount } from "@/domain/split-sleeve";
import type { DesignState, Part } from "@/types";

export type { PartCatalogEntry } from "@/domain/part-registry";

/** Whether Auto-Build placed this part. What "Clear Auto-Build" removes. */
export function isAutoBuildPart(p: Part): boolean {
  return (p.type === "tube" || p.type === "bend") && p.source === "auto-build";
}

export function partLength(p: Part): number {
  switch (p.type) {
    case "tube": {
      const dx = p.to[0] - p.from[0];
      const dy = p.to[1] - p.from[1];
      const dz = p.to[2] - p.from[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    case "bend":
      return (Math.PI * (p.radius ?? 3)) / 2;
    case "blower":
    case "terminal":
      return 0;
  }
}

function isDesignState(input: readonly Part[] | DesignState): input is DesignState {
  return !Array.isArray(input);
}

export function totalPathLength(input: readonly Part[] | DesignState): number {
  const parts = isDesignState(input) ? input.parts : input;
  return parts.reduce((a, p) => a + partLength(p), 0);
}

export function tubeFeet(input: readonly Part[] | DesignState): number {
  const parts = isDesignState(input) ? input.parts : input;
  return parts
    .filter((p): p is Extract<Part, { type: "tube" }> => p.type === "tube")
    .reduce((a, p) => a + partLength(p), 0);
}

/** Stock length of a straight tube, in feet (`parts.json`, ADR-0001). */
export const TUBE_STOCK_FEET = 6;

/**
 * One line of the bill of materials: what the design needs, and how many.
 *
 * Deliberately carries no price or other commercial data. See ADR-0011.
 */
export type BomRow = {
  /** Registry key this row counts, e.g. "tube6". */
  key: string;
  name: string;
  partNo: string;
  qty: number;
  /**
   * What to print in the QTY column when the count alone does not say enough.
   * Absent on every row that reads as a plain number. `qty` stays the count
   * either way, so nothing downstream has to parse this back.
   */
  qtyLabel?: string;
  note?: string;
};

/**
 * The bill of materials for a design.
 *
 * A pure function of the parts, and of nothing else. Prices are not part of the
 * product or this model.
 */
export function bomRows(input: readonly Part[] | DesignState): BomRow[] {
  const parts = isDesignState(input) ? input.parts : input;
  const blowers = parts.filter((p) => p.type === "blower").length;
  const terminals = parts.filter((p) => p.type === "terminal").length;
  const bends = parts.filter((p) => p.type === "bend").length;
  const ft = tubeFeet(parts);
  const cuts = parts.filter((p) => p.type === "tube" && partLength(p) < TUBE_STOCK_FEET).length;
  const stock = Math.ceil(ft / TUBE_STOCK_FEET);
  // Sleeves are counted, not placed: where two pieces meet, and every 6 ft
  // along anything longer than one stock length. See split-sleeve.ts.
  const sleeves = splitSleeveCount(parts);

  const row = (key: string, qty: number, note?: string): BomRow => {
    const { name, partNo } = partRegistry.get(key);
    return { key, name, partNo, qty, note };
  };

  return [
    row("blower", blowers),
    // The one row for a part the app never draws: the client asked for a
    // control box against every blower unit, 1:1, and said it is not shown
    // visually (ADR-0038). It sits next to the blower row because that is what
    // its quantity is.
    row("controlBox", blowers, "one per blower unit"),
    row("terminal", terminals),
    // Kelly orders straight tube by the foot, not by the piece, so the quantity
    // carries both: the client asked for "10/(60ft)" to mean ten 6 ft lengths
    // (2026-09-21). The footage here is what the stock adds up to — what you buy
    // — while the note below stays what the run measures.
    {
      ...row(
        "tube6",
        stock,
        cuts ? `${cuts} cut on-site · ${ft.toFixed(1)}ft total` : `${ft.toFixed(1)}ft total`
      ),
      qtyLabel: `${stock}/(${stock * TUBE_STOCK_FEET}ft)`
    },
    row("bend90", bends),
    row(SPLIT_SLEEVE_KEY, sleeves)
  ];
}
