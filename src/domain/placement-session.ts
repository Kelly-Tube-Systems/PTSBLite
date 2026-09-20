import { bendLandingCells, bendPlacementGhost, placeBend } from "@/domain/bend-placement";
import {
  blowerTerminalOrientation,
  placeBlowerWithTerminal,
  validateBlowerTerminalFootprint
} from "@/domain/blower-terminal";
import { companionOccupantId } from "@/domain/design-state";
import { eraseAtCell } from "@/domain/erase-placement";
import {
  DEFAULT_FREE_PLACEMENT_MEMORY,
  DEFAULT_FREE_PLACEMENT_ROTATION,
  freePlacementGhost,
  freePlacementLandingCells,
  freePlacementSeat,
  placeFreePart,
  rememberFreePlacementOrientation,
  type FreePlacementMemory,
  type FreePlacementRotation,
  type FreePlacementType
} from "@/domain/free-placement";
import {
  cancelObstaclePlacement,
  obstacleBaseElevation,
  obstaclePlacementDraftBounds,
  obstaclePlacementDraftHasFootprint,
  obstaclePlacementGhost,
  placeObstacleVolume,
  prospectiveObstacleDraft,
  restOnObstacles,
  resizeObstaclePlacementHeight,
  setObstaclePlacementFootprint,
  startObstaclePlacement,
  type ObstacleKind,
  type ObstaclePlacementDraft
} from "@/domain/obstacle-placement";
import { floorBeneath } from "@/domain/floors";
import { clampElevation } from "@/domain/sparse-grid";
import { placeTube, tubeLandingCells, tubePlacementGhost } from "@/domain/tube-placement";
import type { BuildArea, DesignMetadata, DesignState, Ghost, ToolId, Vec3 } from "@/types";

/**
 * Everything about a placement in progress: which tool is armed, where the
 * pointer is, how the ghost is turned, what the obstacle drag has drawn so far,
 * and which plane placement lands on.
 *
 * These seven were seven separate `useState` calls in `App`, and they are not
 * independent: arming a tool abandons whatever the last one had in flight, and
 * shrinking the build area both clamps the elevation and drops the draft. Rules
 * like that belong somewhere they can be stated once and tested without a
 * renderer.
 *
 * Nothing here touches React, the DOM, or the file system, and nothing here
 * generates an id — `attemptPlacement` takes one, so it stays a function of its
 * arguments. See `newOccupantId`.
 */
export type PlacementSession = {
  tool: ToolId;
  hoverCell: Vec3 | null;
  obstacleDraft: ObstaclePlacementDraft | null;
  /** Which kind of volume the obstacle tool draws. Sticky across tool changes. */
  obstacleKind: ObstacleKind;
  ghostRotation: number;
  freePlacementMemory: FreePlacementMemory;
  freePlacementRotation: FreePlacementRotation;
  activeElevation: number;
};

export const INITIAL_PLACEMENT_SESSION: PlacementSession = {
  tool: "cursor",
  hoverCell: null,
  obstacleDraft: null,
  obstacleKind: "impenetrable",
  ghostRotation: 0,
  freePlacementMemory: DEFAULT_FREE_PLACEMENT_MEMORY,
  freePlacementRotation: DEFAULT_FREE_PLACEMENT_ROTATION,
  activeElevation: 0
};

/**
 * Where the pointer's cell actually lands for the armed tool.
 *
 * A blower, a terminal, or the pair of a blower and a terminal aimed at an
 * impenetrable obstacle steps onto it. Tubes and bends continue from a port,
 * while the obstacle tool must be able to draw over existing occupants.
 */
export function resolvePlacementCell(
  tool: ToolId,
  design: DesignState,
  cell: Vec3,
  buildArea: BuildArea
): Vec3 {
  switch (tool) {
    case "blower":
    case "terminal":
    case "blowerTerminal":
      // The pair steps up for the same reason its blower does: it is a blower
      // being stood somewhere, and what the terminal on top of it needs is
      // headroom rather than a different surface.
      return restOnObstacles(design, cell, buildArea);
    case "cursor":
    case "tube":
    case "bend":
    case "obstacle":
    case "erase":
      return cell;
  }
}

export type PlacementAction =
  /** Arm a tool. Abandons anything the previous tool had in flight. */
  | { type: "select-tool"; tool: ToolId }
  | { type: "hover"; cell: Vec3 | null }
  /** `R` — turns the ghost, or the free-placement orientation. */
  | { type: "rotate" }
  /** `[` and `]` — move the active placement plane. */
  | { type: "nudge-elevation"; delta: number; buildArea: BuildArea }
  /** Jump the placement plane, e.g. the floor selector picking a floor's base. */
  | { type: "set-elevation"; elevation: number; buildArea: BuildArea }
  /** Grow or shrink the obstacle draft, within whatever it has above it. */
  | {
      type: "set-obstacle-height";
      height: number;
      metadata: DesignMetadata;
      buildArea: BuildArea;
    }
  | { type: "cancel-obstacle-draft" }
  /** Switch what the obstacle tool draws. An in-flight draft keeps its shape. */
  | { type: "set-obstacle-kind"; kind: ObstacleKind }
  /**
   * Fold back the session `attemptPlacement` or `commitObstacleDraft` returned.
   *
   * Those two need the current design to reach the placement rules and have to
   * report a result as well as a next state, which is more than a reducer can
   * return — so they stay pure functions and this action carries their answer
   * back in.
   */
  | { type: "apply-attempt"; session: PlacementSession };

function isFreePlacementTool(tool: ToolId): tool is FreePlacementType {
  return tool === "blower" || tool === "terminal";
}

/**
 * Whether `R` turns this tool's orientation rather than a bend's rotation
 * index. The blower-and-terminal pair is not a free placement — it is two of
 * them — but it turns on the same ring and out of the same memory.
 */
function usesFreePlacementRotation(tool: ToolId): boolean {
  return isFreePlacementTool(tool) || tool === "blowerTerminal";
}

/**
 * Whether `[` and `]` change anything for the armed tool.
 *
 * An obstacle stands on the floor of whichever storey is selected rather than
 * on the placement plane, so once the elevation stepper went away the keys had
 * nothing left to move — except, across a storey boundary, the floor itself,
 * which the floor selector and the `1`/`2` keys own. They are inert for the
 * obstacle tool and hidden from the controls that offer them, so what is on
 * screen and what the keys do agree.
 */
export function elevationKeysApply(tool: ToolId): boolean {
  return tool !== "obstacle";
}

/**
 * What a left drag across the grid does with the armed tool.
 *
 * Every tool but one orbits the camera, which is what a left drag has always
 * done. The obstacle tool is the exception while its box is still being drawn:
 * people reach for a drag the way they would in any other drawing tool, and got
 * the view spinning with a corner anchored behind them. So a drag draws the box
 * instead, in one of two phases —
 *
 * - `"anchor"`: nothing is down yet, so the press puts the first corner on the
 *   grid and the release closes the footprint on the square it lands on.
 * - `"close"`: a corner is already down from a first click, so the press adds
 *   nothing and the release closes the footprint.
 *
 * `null` once the footprint is closed and the draft is waiting for its height
 * and Place: there is nothing left to draw, and the camera should be free to
 * look at what was drawn. See ADR-0044.
 */
export type DragDrawPhase = "anchor" | "close" | null;

export function dragDrawPhase(session: PlacementSession): DragDrawPhase {
  if (session.tool !== "obstacle") return null;
  if (obstaclePlacementDraftHasFootprint(session.obstacleDraft)) return null;
  return session.obstacleDraft ? "close" : "anchor";
}

/**
 * Whether `R` turns anything for the armed tool.
 *
 * Rotation reaches two things: the orientation a blower or terminal is set down
 * in, and the index a bend is placed at. An obstacle volume is drawn corner to
 * corner and has no orientation to give it, and a tube takes its direction from
 * the port it continues from — so for those two the keys turned a number
 * nothing about the placement reads. Worse than idle: `ghostRotation` survives
 * a tool change, so an `R` pressed here came back later as a pre-turned bend.
 * They are inert for both and hidden from the controls that offered them, so
 * what is on screen and what the keys do agree.
 *
 * The select and erase tools keep the row, exactly as they keep the elevation
 * row: they place nothing, so the legend is describing the app rather than the
 * moment, which is the only thing that can be said with no ghost on screen.
 */
export function rotationKeysApply(tool: ToolId): boolean {
  return tool !== "obstacle" && tool !== "tube";
}

/**
 * Move the placement plane, dragging the hover cell — and the ghost derived
 * from it — along. Without this, pressing an elevation key changed nothing on
 * screen until the pointer happened to move again, which read as the key doing
 * nothing at all.
 *
 * Straight up is the whole answer, not a first approximation (ADR-0035). The
 * square is the one the pointer is aiming at on the floor, and the elevation
 * only says how high above it the part goes, so the cell above the old hover
 * is the cell the pointer still rests on. The viewport picks a click the same
 * way — against a plane on the storey's floor, lifted to the elevation — so
 * the part lands on the square the ghost stood on.
 *
 * It read as a stop-gap while the pointer cast onto a plane raised to the
 * elevation: that plane met a still pointer nearer than the floor did, so the
 * ghost had to be re-picked to agree with the click, and the fix moved both
 * rather than neither. The client rejected that — "it retains its x/y
 * position" — and the picking plane came down to the floor instead.
 */
function withElevation(session: PlacementSession, activeElevation: number): PlacementSession {
  return {
    ...session,
    activeElevation,
    hoverCell: session.hoverCell
      ? [session.hoverCell[0], activeElevation, session.hoverCell[2]]
      : session.hoverCell
  };
}

export function placementSessionReducer(
  session: PlacementSession,
  action: PlacementAction
): PlacementSession {
  switch (action.type) {
    case "select-tool":
      return {
        ...session,
        tool: action.tool,
        freePlacementRotation: DEFAULT_FREE_PLACEMENT_ROTATION,
        obstacleDraft: null
      };

    case "hover":
      return { ...session, hoverCell: action.cell };

    // `R` steps one way round a closed ring, so it still reaches every
    // orientation. There was a `⇧R` that stepped the other way until the client
    // asked for it to go — "R and Shift+R is the same tool but just in reverse"
    // — and a few more presses is the cost he chose to pay for one less key.
    case "rotate":
      if (!rotationKeysApply(session.tool)) return session;
      if (usesFreePlacementRotation(session.tool)) {
        // One ring of five orientations, stepped one way. It used to toggle
        // up/down on a separate axis, which left a blower that had been turned
        // sideways unable to point back up.
        return {
          ...session,
          freePlacementRotation: session.freePlacementRotation + 1
        };
      }
      return {
        ...session,
        ghostRotation: (session.ghostRotation + 1) % 4
      };

    case "nudge-elevation":
      if (!elevationKeysApply(session.tool)) return session;
      return withElevation(
        session,
        clampElevation(session.activeElevation + action.delta, action.buildArea)
      );

    case "set-elevation":
      return withElevation(session, clampElevation(action.elevation, action.buildArea));

    case "set-obstacle-height":
      return {
        ...session,
        obstacleDraft: session.obstacleDraft
          ? resizeObstaclePlacementHeight(
              session.obstacleDraft,
              action.height,
              action.metadata,
              action.buildArea
            )
          : session.obstacleDraft
      };

    case "set-obstacle-kind":
      return { ...session, obstacleKind: action.kind };

    case "cancel-obstacle-draft":
      return { ...session, obstacleDraft: cancelObstaclePlacement(session.obstacleDraft) };

    case "apply-attempt":
      // The attempt was computed from a session read during render, so it can be
      // a pointer-move behind by the time it is applied. Everything else in it
      // is a consequence of the click and should win, but where the pointer is
      // now is not something a placement gets a say in — keeping the live hover
      // cell stops a click from dragging the ghost back to where the pointer
      // used to be. The plane the attempt left is a consequence of the click,
      // though, so the live cell is carried onto it the way an elevation key
      // would carry it.
      return withElevation(
        { ...action.session, hoverCell: session.hoverCell },
        action.session.activeElevation
      );
  }
}

/** What a click on the grid did. */
export type PlacementResult =
  /** Nothing to do — the cursor tool, or an orientation that could not be resolved. */
  | { status: "ignored" }
  /** The session moved on but the design did not, i.e. the obstacle drag advanced. */
  | { status: "updated" }
  | { status: "error"; message: string }
  | { status: "committed"; design: DesignState };

/**
 * Apply a click at `cell` with whatever tool is armed.
 *
 * The tool branches stay explicit rather than collapsing into a lookup table:
 * they take genuinely different arguments — a source part, a rotation index, an
 * orientation memory — and a table would hide that behind optional fields and
 * casts.
 *
 * `occupantId` is supplied by the caller because generating one would make this
 * depend on `crypto`, and the point of putting the placement rules here is that
 * they can be tested by reading the return value.
 */
export function attemptPlacement(
  session: PlacementSession,
  design: DesignState,
  cell: Vec3,
  occupantId: string,
  sourcePartId?: string
): { session: PlacementSession; result: PlacementResult } {
  const unchanged = (result: PlacementResult) => ({ session, result });

  switch (session.tool) {
    case "cursor":
      return unchanged({ status: "ignored" });

    case "erase": {
      const erased = eraseAtCell(design, cell);
      return unchanged(
        erased.ok
          ? { status: "committed", design: erased.design }
          : { status: "error", message: erased.message }
      );
    }

    // Blowers and terminals place identically: anywhere legal, snapping to an
    // open port when there is one under the cursor. Terminal 1 used to be a
    // third case, pinned to the blower's outlet cell, until the client withdrew
    // that rule (ADR-0019).
    case "blower":
    case "terminal": {
      // The same seat the ghost previews, resolved the same way, so what gets
      // placed is what was on screen — including the cell, which for a terminal
      // seating on a port is a step along from the one under the cursor.
      const type: FreePlacementType = session.tool;
      const seat = freePlacementSeat(
        design,
        type,
        cell,
        session.freePlacementMemory,
        session.freePlacementRotation
      );
      const orientation = seat.orientation;
      const placed = placeFreePart(design, { id: occupantId, type, cell: seat.cell, orientation });
      if (!placed.ok) return unchanged({ status: "error", message: placed.message });
      // Once an endpoint is down the height setting goes back to the floor of
      // the storey it was placed from. The client chose this over leaving the
      // setting where it was, knowing the first tube after a raised blower
      // needs the setting put back up to reach its port (ADR-0031). Tubes and
      // bends keep the height they are working at.
      return {
        session: withElevation(
          {
            ...session,
            freePlacementMemory: rememberFreePlacementOrientation(
              session.freePlacementMemory,
              type,
              orientation
            ),
            freePlacementRotation: DEFAULT_FREE_PLACEMENT_ROTATION
          },
          floorBeneath(design.metadata, session.activeElevation)
        ),
        result: { status: "committed", design: placed.design }
      };
    }

    // Two parts, one click. The pair does not snap — see blower-terminal.ts —
    // so its orientation is only what it was last turned to, carried round the
    // same ring by `R`.
    case "blowerTerminal": {
      const orientation = blowerTerminalOrientation(
        session.freePlacementMemory,
        session.freePlacementRotation
      );
      const placed = placeBlowerWithTerminal(design, {
        blowerId: occupantId,
        terminalId: companionOccupantId(occupantId),
        cell,
        orientation
      });
      if (!placed.ok) return unchanged({ status: "error", message: placed.message });
      // Everything a single endpoint does on landing, for the same reasons: the
      // orientation is remembered for the next one, `R` starts over, and the
      // placement plane drops back to the floor of the storey (ADR-0031).
      return {
        session: withElevation(
          {
            ...session,
            freePlacementMemory: rememberFreePlacementOrientation(
              session.freePlacementMemory,
              "blowerTerminal",
              orientation
            ),
            freePlacementRotation: DEFAULT_FREE_PLACEMENT_ROTATION
          },
          floorBeneath(design.metadata, session.activeElevation)
        ),
        result: { status: "committed", design: placed.design }
      };
    }

    case "tube": {
      const placed = placeTube(design, { id: occupantId, cell, sourcePartId });
      return unchanged(
        placed.ok
          ? { status: "committed", design: placed.design }
          : { status: "error", message: placed.message }
      );
    }

    case "bend": {
      const placed = placeBend(design, {
        id: occupantId,
        cell,
        sourcePartId,
        rotationIndex: session.ghostRotation
      });
      return unchanged(
        placed.ok
          ? { status: "committed", design: placed.design }
          : { status: "error", message: placed.message }
      );
    }

    case "obstacle": {
      // Two clicks: the first anchors a corner, the second sets the footprint.
      // Height is then adjusted from the HUD before `commitObstacleDraft`.
      if (!session.obstacleDraft) {
        const started = startObstaclePlacement(design, cell, session.obstacleKind);
        if (!started.ok) return unchanged({ status: "error", message: started.message });
        return {
          session: { ...session, obstacleDraft: started.draft },
          result: { status: "updated" }
        };
      }
      if (!obstaclePlacementDraftHasFootprint(session.obstacleDraft)) {
        return {
          session: {
            ...session,
            obstacleDraft: setObstaclePlacementFootprint(session.obstacleDraft, cell)
          },
          result: { status: "updated" }
        };
      }
      return unchanged({ status: "ignored" });
    }
  }
}

/** Turn a finished obstacle draft into a placed volume. */
export function commitObstacleDraft(
  session: PlacementSession,
  design: DesignState,
  occupantId: string
): { session: PlacementSession; result: PlacementResult } {
  if (!obstaclePlacementDraftHasFootprint(session.obstacleDraft)) {
    return { session, result: { status: "ignored" } };
  }
  const bounds = obstaclePlacementDraftBounds(session.obstacleDraft);
  const placed = placeObstacleVolume(design, {
    id: occupantId,
    cornerA: bounds.min,
    cornerB: bounds.max,
    kind: session.obstacleKind
  });
  if (!placed.ok) return { session, result: { status: "error", message: placed.message } };
  return {
    session: { ...session, obstacleDraft: null },
    result: { status: "committed", design: placed.design }
  };
}

/**
 * The translucent preview of what would be placed at the hovered cell.
 *
 * Derived, never stored: computing it during render costs one pass instead of
 * the two an effect-plus-setState needed, and removes any chance of a stored
 * ghost disagreeing with the state it was meant to reflect.
 */
export function placementGhost(session: PlacementSession, design: DesignState): Ghost | null {
  const { tool, hoverCell } = session;
  if (!hoverCell) return null;
  switch (tool) {
    case "cursor":
    case "erase":
      return null;
    case "blower":
    case "terminal":
      return freePlacementGhost({
        type: tool,
        design,
        cell: hoverCell,
        memory: session.freePlacementMemory,
        rotationSteps: session.freePlacementRotation
      });
    case "blowerTerminal": {
      // One ghost for the pair: the click is refused or accepted as a whole, so
      // previewing only the half that fits would promise a placement that is
      // not on offer.
      const dir = blowerTerminalOrientation(
        session.freePlacementMemory,
        session.freePlacementRotation
      );
      if (!validateBlowerTerminalFootprint(design, hoverCell, dir).ok) return null;
      return { type: "blowerTerminal", cell: hoverCell, dir };
    }
    case "tube":
      return tubePlacementGhost(design, hoverCell);
    case "bend":
      return bendPlacementGhost(design, hoverCell, { rotationIndex: session.ghostRotation });
    case "obstacle": {
      // Before the first click there is no draft, so stand in the one a click
      // would start: the volume itself is previewed from the moment the tool is
      // armed, not only once a corner has been anchored.
      const draft = session.obstacleDraft ?? prospectiveObstacleDraft(design, hoverCell);
      return obstaclePlacementGhost(draft, hoverCell, session.obstacleKind);
    }
  }
}

/**
 * The cells the viewport highlights for the armed tool.
 *
 * For the tools that place a part, these are the legal targets, worked out
 * from the design and standing still under the pointer. The obstacle tool has
 * no such set — every cell inside the build area is a legal corner — and it
 * highlights the one cell under the cursor instead, which is the only thing
 * there is to say about where a click would land. That cell is on the floor of
 * the active storey rather than on the placement plane, because that is where
 * the volume itself will be drawn. Out-of-bounds cells stay unlit: the hover
 * plane extends well past the build area, and there is no grid out there to
 * point at.
 */
export function placementLandingCells(session: PlacementSession, design: DesignState): Vec3[] {
  switch (session.tool) {
    case "cursor":
    case "erase":
      return [];
    case "blower":
    case "terminal":
      return freePlacementLandingCells(design);
    // Nothing lights up for the pair, because it has nothing to snap to: its
    // blower's only port is taken by its own terminal (blower-terminal.ts).
    // Every legal cell is as good as every other, which is what an empty set
    // says — the same thing it says for the first blower of a design.
    case "blowerTerminal":
      return [];
    case "tube":
      return tubeLandingCells(design);
    case "bend":
      return bendLandingCells(design);
    case "obstacle": {
      const cell = session.hoverCell;
      if (!cell || !design.grid.withinBounds(cell)) return [];
      return [[cell[0], obstacleBaseElevation(design.metadata, cell[1]), cell[2]]];
    }
  }
}
