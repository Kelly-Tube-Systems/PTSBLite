import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeftRail } from "@/components/LeftRail";
import type { ToolId } from "@/types";

/**
 * The order of the tiles in the Build drawer is the client's instruction and
 * nothing else — it is the order he reaches for the parts in, not the order
 * they were built or the order the catalog lists them. Nothing else on screen
 * would notice it changing, so adding a sixth part must not quietly slide it.
 *
 * Asserted through the tool each tile arms rather than the name it shows: the
 * names come from the catalog (ADR-0001) and would make this a test of copy.
 */
describe("LeftRail build drawer", () => {
  it("offers the parts in the order the client asked for", () => {
    const armed: ToolId[] = [];
    const { container } = render(
      <LeftRail
        tool="cursor"
        onTool={(id) => armed.push(id)}
        partCount={0}
        obstacleCount={0}
        autoBuildPartCount={0}
        onClearParts={vi.fn()}
        onClearObstacles={vi.fn()}
        onClearAutoBuild={vi.fn()}
      />
    );

    for (const card of container.querySelectorAll(".left-rail__parts .part-card")) {
      fireEvent.click(card);
    }

    expect(armed).toEqual(["blowerTerminal", "tube", "bend", "terminal", "blower"]);
  });
});
