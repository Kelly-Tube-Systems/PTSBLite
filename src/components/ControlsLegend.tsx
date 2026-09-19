import { useState } from "react";
import { Icons, type IconProps } from "@/components/Icons";
import {
  elevationKeysApply,
  rotationKeysApply,
  type DragDrawPhase
} from "@/domain/placement-session";
import type { ComponentType, ReactNode } from "react";
import type { ToolId } from "@/types";
import "@/components/ControlsLegend.css";

/** What the legend describes: the armed tool, and what a left drag does now. */
type LegendState = { tool: ToolId; dragDraw: DragDrawPhase };

type Control = {
  icon: ComponentType<IconProps>;
  /** What you do. `ReactNode` so the keyboard rows can show real key caps. */
  input: ReactNode;
  action: string;
  /**
   * When this row applies. Absent means always — the legend describes the app,
   * and only a row whose input is dead where the visitor is standing earns
   * being taken away.
   */
  applies?: (state: LegendState) => boolean;
};

/**
 * Every control the viewport has, in the order you meet them: the click that
 * builds, the three camera moves, then the keys that adjust what is about to be
 * placed.
 *
 * The client asked for exactly this list, with two entries — drag to change a
 * part's orientation, and drag to move a placed part — that the app has no
 * bindings for and that would both need the left drag the camera orbit already
 * owns. Those are still with him; this legend describes what is actually here,
 * which is the only thing a legend may do.
 *
 * A "Right click — Erase" row sat under the first one until the client asked
 * for it to go. It was stale as well as unwanted: right-drag pan has the right
 * button, as the Pan row two below it said, and erasing is the Eraser in the
 * Erase drawer followed by a left click. The row outlived the binding.
 */
const CONTROLS: Control[] = [
  { icon: Icons.MouseLeft, input: "Left click", action: "Place" },
  // One input, two rows. The left drag draws the obstacle box while one is
  // part-drawn (ADR-0043) and orbits the rest of the time, including once that
  // box is closed and waiting for Place — so the row follows the drag itself
  // rather than the armed tool. A legend may only say what the app does.
  {
    icon: Icons.Obstacle,
    input: "Left click drag",
    action: "Draw box",
    applies: ({ dragDraw }) => dragDraw !== null
  },
  {
    icon: Icons.Orbit,
    input: "Left click drag",
    action: "Orbit",
    applies: ({ dragDraw }) => dragDraw === null
  },
  { icon: Icons.Pan, input: "Right click drag", action: "Pan" },
  { icon: Icons.Scroll, input: "Scroll", action: "Zoom" },
  {
    icon: Icons.Keys,
    input: <kbd>R</kbd>,
    action: "Rotate",
    applies: ({ tool }) => rotationKeysApply(tool)
  },
  {
    icon: Icons.Keys,
    input: (
      <>
        <kbd>[</kbd>
        <span className="legend__or">/</span>
        <kbd>]</kbd>
      </>
    ),
    action: "Elevation",
    applies: ({ tool }) => elevationKeysApply(tool)
  }
];

/**
 * The controls legend, anchored bottom-left of the viewport.
 *
 * Always on screen rather than behind a help button: the client's goal for it
 * was "making it easier and easier so any dummy can do it", which a panel you
 * have to know to open does not do. It collapses to its own title for anyone
 * who has learned the controls.
 */
export function ControlsLegend({
  tool,
  dragDraw = null
}: {
  tool: ToolId;
  dragDraw?: DragDrawPhase;
}) {
  const [open, setOpen] = useState(true);
  const controls = CONTROLS.filter((control) => control.applies?.({ tool, dragDraw }) ?? true);
  return (
    <div className="legend nosel">
      <button
        className="legend__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="controls-legend-list"
      >
        <span className="legend__title">Controls</span>
        {open ? <Icons.ChevD size={13} /> : <Icons.ChevU size={13} />}
      </button>
      <dl className="legend__list" id="controls-legend-list" hidden={!open}>
        {controls.map((control, i) => {
          const Glyph = control.icon;
          return (
            <div className="legend__row" key={i}>
              <dt className="legend__input">
                <Glyph size={17} className="legend__icon" />
                <span>{control.input}</span>
              </dt>
              <dd className="legend__action">{control.action}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
