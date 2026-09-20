import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBar } from "@/components/StatusBar";
import { designFromScene, emptyDesign } from "@/domain/design-state";
import { partRegistry } from "@/domain/part-registry";
import type { Part, ToolId, Warning } from "@/types";

const blower: Part = { id: "b", type: "blower", cell: [0, 0, 0], dir: [1, 0, 0] };

const failing: Warning = {
  id: "w",
  level: "error",
  title: "Needs a blower at each end",
  detail: "One end of the run has no blower."
};

type BarProps = {
  parts?: Part[];
  warnings?: Warning[];
  tool?: ToolId;
  elevation?: number;
  floor?: 1 | 2 | null;
};

function bar({
  parts = [],
  warnings = [],
  tool = "cursor",
  elevation = 0,
  floor = null
}: BarProps) {
  return (
    <StatusBar
      design={parts.length ? designFromScene({ parts, obstacles: [] }) : emptyDesign()}
      warnings={warnings}
      expanded={false}
      onToggle={() => {}}
      onFinalize={() => {}}
      tool={tool}
      elevation={elevation}
      floor={floor}
    />
  );
}

const finalizeButton = () => screen.getByRole("button", { name: /Finalize/ });

function statusBar(props: BarProps) {
  render(bar(props));
  return finalizeButton();
}

/** What the rail says the armed tool is, or null when it says nothing. */
function toolReadout() {
  return document.querySelector('[data-meta="tool"] .status-bar__meta-value')?.textContent ?? null;
}

/** The elevation the rail reads out, floor and all, or null when there is none. */
function elevationReadout() {
  const meta = document.querySelector('[data-meta="elevation"]');
  return meta ? meta.textContent : null;
}

/**
 * The client tried the tool pill sharing the bottom of the viewport with the
 * two corner panels and asked for it to go into the rail instead
 * (ADR-0048): "Can we put the info pf the tool pill into the blank space on
 * the footer rail?". So the rail is where the armed tool is named.
 */
describe("the active tool readout", () => {
  it("names the armed tool and its catalog part number", () => {
    render(bar({ tool: "blower" }));
    const { name, partNo } = partRegistry.get("blower");
    expect(toolReadout()).toBe(`${name} · ${partNo}`);
  });

  it("says nothing about a tool while the cursor is armed, which places nothing", () => {
    render(bar({ tool: "cursor" }));
    expect(toolReadout()).toBeNull();
    expect(elevationReadout()).toBeNull();
  });

  it("reads out the placement elevation and its floor", () => {
    render(bar({ tool: "tube", elevation: 12, floor: 2 }));
    expect(elevationReadout()).toContain("12 ft");
    expect(elevationReadout()).toContain("Floor 2");
  });

  it("leaves the floor off a single-floor design, which has only the one", () => {
    render(bar({ tool: "tube", elevation: 3, floor: null }));
    expect(elevationReadout()).toContain("3 ft");
    expect(elevationReadout()).not.toContain("Floor");
  });

  it("offers no elevation for a tool that puts nothing at a height", () => {
    render(bar({ tool: "erase" }));
    expect(toolReadout()).toBe("Erase");
    expect(elevationReadout()).toBeNull();
  });
});

/**
 * The client asked for Finalize to turn green on a valid system, the way
 * Auto-Build does. Green is a stylesheet matter happy-dom cannot see; what it
 * can hold still is that the button reports the same state as the label beside
 * it, which is what the colour hangs off.
 */
describe("the Finalize button", () => {
  it("reads as passing once a design has parts and no warnings", () => {
    expect(statusBar({ parts: [blower] }).dataset.state).toBe("ok");
  });

  it("does not read as passing while a check is failing", () => {
    expect(statusBar({ parts: [blower], warnings: [failing] }).dataset.state).not.toBe("ok");
  });

  it("does not read as passing on an empty design that has nothing to check", () => {
    expect(statusBar({}).dataset.state).not.toBe("ok");
  });

  it("stays clickable whatever the state, so the issue list is always reachable", () => {
    expect(statusBar({}).hasAttribute("disabled")).toBe(false);
  });

  // The pulse itself is an animation happy-dom will not run. What matters here
  // is that it is carried by the same state as the colour, so the button cannot
  // end up green without having said so, or keep pulsing at a design that has
  // since broken.
  it("carries the shared ready tell once the checks pass", () => {
    expect(statusBar({ parts: [blower] }).classList.contains("ready-pulse")).toBe(true);
  });

  it("does not carry the ready tell while there is nothing to finalize", () => {
    expect(statusBar({}).classList.contains("ready-pulse")).toBe(false);
  });

  // The client asked for the pulse to last until the button is pressed rather
  // than for three beats (ADR-0043, amended). Pressing it is the whole of what
  // stops it.
  it("drops the ready tell once it has been pressed", () => {
    const button = statusBar({ parts: [blower] });
    fireEvent.click(button);
    expect(button.classList.contains("ready-pulse")).toBe(false);
    expect(button.dataset.state).toBe("ok");
  });

  it("tells again the next time the checks pass, however many times it has been pressed", () => {
    const view = render(bar({ parts: [blower] }));
    fireEvent.click(finalizeButton());
    expect(finalizeButton().classList.contains("ready-pulse")).toBe(false);

    view.rerender(bar({ parts: [blower], warnings: [failing] }));
    expect(finalizeButton().classList.contains("ready-pulse")).toBe(false);

    view.rerender(bar({ parts: [blower] }));
    expect(finalizeButton().classList.contains("ready-pulse")).toBe(true);
  });
});
