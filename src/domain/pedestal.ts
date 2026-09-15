import { floorAtElevation, floorBaseElevation } from "@/domain/floors";
import { cellCenter } from "@/domain/vec3";
import type { BlowerPart, DesignState, Part, Vec3 } from "@/types";

/**
 * The mast under a blower with a pedestal.
 *
 * The client's request: a blower that, raised off the floor with `[` and `]`,
 * grows straight tubing under it down to what it stands on — "elevate it 2 ft
 * and 2 ft of tube appears under it, meeting the floor". What it stands on is
 * the storey's floor, or the top of an impenetrable obstacle beneath it
 * (ADR-0032).
 *
 * It is the first geometry in the model that is **drawn but not counted**. The
 * mast is how the blower is mounted, not part of the run air travels through,
 * so it appears in no BOM row of its own, adds nothing to the centerline, and
 * does not count against the 300 ft cap. That is why it is a property of the
 * blower rather than an ordinary `TubePart` carrying a flag: as a tube, every
 * length, BOM and validation query in the codebase would have to remember to
 * exclude it, and the first one to forget would silently overstate a system.
 * See ADR-0020.
 *
 * `pedestalFeet` is stored on the part rather than derived from the design,
 * which keeps `partCells` a pure function of the part — the property
 * reconstruction, erasing and the floor shadows all rely on. Its presence is
 * what marks the pedestal variant: zero is a legal height, for a pedestal
 * blower sitting on the floor, so a falsy check would misread it as a plain
 * blower.
 */

/** Whether this part is a blower placed with a pedestal under it. */
export function hasPedestal(part: Part): part is BlowerPart & { pedestalFeet: number } {
  return part.type === "blower" && typeof part.pedestalFeet === "number";
}

/**
 * What a mast at `cell` stands on: the top surface of the highest impenetrable
 * obstacle under it, or the floor of its storey when nothing is under it.
 *
 * A pedestal originally reached the storey's floor and nothing else (ADR-0020),
 * which left the pedestal tool unusable over the one thing an obstacle is most
 * often built to be: a shelf. A plain blower steps onto it, and a pedestal
 * blower was refused for the cells the shelf claims. The client asked for the
 * step-up to work for both, and a mast that stands on the shelf is what makes
 * that legal — driving one through the shelf to the floor is not (ADR-0032).
 *
 * Penetrable obstacles hold nothing up. They claim no grid cells and exist to
 * be built through (ADR-0016), so a mast passes them as a tube does.
 */
export function pedestalBaseElevation(design: DesignState, cell: Vec3): number {
  const [x, y, z] = cell;
  let base = floorBaseElevation(design.metadata, floorAtElevation(design.metadata, y));
  for (const obstacle of design.obstacles) {
    if (obstacle.penetrable) continue;
    if (x < obstacle.min[0] || x > obstacle.max[0]) continue;
    if (z < obstacle.min[2] || z > obstacle.max[2]) continue;
    // Strictly below: a volume reaching the blower's own cell is not something
    // to stand on, and that placement is refused for the cell itself anyway.
    if (obstacle.max[1] >= y) continue;
    base = Math.max(base, obstacle.max[1] + 1);
  }
  return base;
}

/**
 * How tall the mast is for a blower placed at `cell`: the gap between it and
 * the surface it stands on. Zero when it sits on that surface, which is a
 * pedestal blower that simply has no tube under it yet.
 */
export function pedestalHeightAt(design: DesignState, cell: Vec3): number {
  return Math.max(0, cell[1] - pedestalBaseElevation(design, cell));
}

/**
 * The cells the mast occupies: the column directly under the blower, from the
 * surface it stands on up to the cell below it. Empty when the blower stands
 * on that surface.
 *
 * The mast claims grid cells like any other part. It is a physical column of
 * tube, and leaving it out of the grid would let Auto-Build route a run
 * straight through it — visibly wrong, and exactly the split between `parts`
 * and `grid` that CONTEXT.md names as the invariant that matters most.
 */
export function pedestalCells(cell: Vec3, feet: number): Vec3[] {
  const cells: Vec3[] = [];
  for (let i = 1; i <= feet; i++) cells.push([cell[0], cell[1] - i, cell[2]]);
  return cells;
}

/**
 * Where the mast is drawn: from the blower's cell centre down `feet` to what it
 * stands on. Null when there is no mast, so a caller renders nothing rather
 * than a zero-length cylinder.
 */
export function pedestalSpan(cell: Vec3, feet: number): { from: Vec3; to: Vec3 } | null {
  if (feet <= 0) return null;
  const top = cellCenter(cell);
  return { from: [top[0], top[1] - feet, top[2]], to: top };
}
