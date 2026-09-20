import { partRegistry } from "@/domain/part-registry";
import type { ToolId } from "@/types";

/**
 * How the armed tool is named in the footer rail.
 *
 * This used to be a pill floating along the bottom of the viewport, where the
 * two corner panels could cover it; the readout now lives in the rail
 * (ADR-0047) and this is what it reads.
 *
 * Part names and numbers come from the catalog rather than being restated
 * here — ADR-0001 requires user-facing copy to interpolate reference data.
 * Obstacles are not parts (see CONTEXT.md) and the two non-placing tools have
 * no catalog entry, so those three keep literal labels.
 */
const TOOL_LABELS: Record<ToolId, string> = {
  cursor: "Select",
  blower: catalogLabel("blower"),
  terminal: catalogLabel("terminal"),
  blowerTerminal: pairLabel("blower", "terminal"),
  tube: catalogLabel("tube6"),
  bend: catalogLabel("bend90"),
  obstacle: "Obstacle volume",
  erase: "Erase"
};

/** "<name> · <part number>", read from the catalog rather than restated here. */
function catalogLabel(registryKey: string): string {
  const { name, partNo } = partRegistry.get(registryKey);
  return `${name} · ${partNo}`;
}

/**
 * Two catalog names for the one tool that places two parts.
 *
 * The part numbers are left off here alone. Every other tool carries its
 * number because it has one; this tool has two, and the readout shares the
 * rail with the design's own numbers and Finalize. They are on the tile in the
 * Build drawer and on the two BOM lines, which is where a number is read
 * rather than glanced at.
 */
function pairLabel(firstKey: string, secondKey: string): string {
  return `${partRegistry.get(firstKey).name} + ${partRegistry.get(secondKey).name}`;
}

export function activeToolLabel(tool: ToolId): string {
  return TOOL_LABELS[tool];
}

/**
 * Whether the tool puts something at a height, and so has an elevation worth
 * reading out. The obstacle tool takes the storey's floor rather than the
 * placement plane, but it still stands somewhere and says where.
 */
export function toolShowsElevation(tool: ToolId): boolean {
  return (
    tool === "blower" ||
    tool === "terminal" ||
    tool === "blowerTerminal" ||
    tool === "tube" ||
    tool === "bend" ||
    tool === "obstacle"
  );
}
