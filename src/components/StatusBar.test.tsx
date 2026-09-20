import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBar } from "@/components/StatusBar";
import { designFromScene, emptyDesign } from "@/domain/design-state";
import type { Part, Warning } from "@/types";

const blower: Part = { id: "b", type: "blower", cell: [0, 0, 0], dir: [1, 0, 0] };

const failing: Warning = {
  id: "w",
  level: "error",
  title: "Needs a blower at each end",
  detail: "One end of the run has no blower."
};

function bar({ parts = [], warnings = [] }: { parts?: Part[]; warnings?: Warning[] }) {
  return (
    <StatusBar
      design={parts.length ? designFromScene({ parts, obstacles: [] }) : emptyDesign()}
      warnings={warnings}
      expanded={false}
      onToggle={() => {}}
      onFinalize={() => {}}
    />
  );
}

const finalizeButton = () => screen.getByRole("button", { name: /Finalize/ });

function statusBar(props: { parts?: Part[]; warnings?: Warning[] }) {
  render(bar(props));
  return finalizeButton();
}

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
