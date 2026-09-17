import * as THREE from "three";
import type { ToolId, Vec3 } from "@/types";

/**
 * Pointer interaction, as pure functions over plain values.
 *
 * Orbiting, click-versus-drag discrimination and cell picking are the parts of
 * the viewport with real logic and no GPU, so they are kept testable and out of
 * the effect that owns the renderer.
 */

type PointerPoint = {
  x: number;
  y: number;
};

export type ViewportDragState = {
  active: boolean;
  dragging: boolean;
  dragX: number;
  dragY: number;
  downX: number;
  downY: number;
};

export function createViewportDragState(): ViewportDragState {
  return {
    active: false,
    dragging: false,
    dragX: 0,
    dragY: 0,
    downX: 0,
    downY: 0
  };
}

export function beginViewportDrag(
  state: ViewportDragState,
  point: PointerPoint
): ViewportDragState {
  return {
    ...state,
    active: true,
    dragging: false,
    dragX: point.x,
    dragY: point.y,
    downX: point.x,
    downY: point.y
  };
}

export function moveViewportDrag(
  state: ViewportDragState,
  point: PointerPoint,
  buttons: number
): { state: ViewportDragState; delta: PointerPoint | null } {
  if (!state.active || !(buttons & 1)) return { state, delta: null };

  const dx = point.x - state.dragX;
  const dy = point.y - state.dragY;
  const dragging = state.dragging || Math.abs(dx) + Math.abs(dy) > 3;
  const next = { ...state, dragging };

  if (!dragging) return { state: next, delta: null };

  next.dragX = point.x;
  next.dragY = point.y;
  return { state: next, delta: { x: dx, y: dy } };
}

export function isViewportClick(state: ViewportDragState, point: PointerPoint): boolean {
  return Math.abs(point.x - state.downX) + Math.abs(point.y - state.downY) < 4 && !state.dragging;
}

export function endViewportDrag(state: ViewportDragState): ViewportDragState {
  return {
    ...state,
    active: false,
    dragging: false
  };
}

export function partIdForObject(object: THREE.Object3D): string | undefined {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (typeof current.userData.partId === "string") return current.userData.partId;
    current = current.parent;
  }
  return undefined;
}

export function landingCellForObject(object: THREE.Object3D): Vec3 | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const cell = current.userData.landingCell as Vec3 | undefined;
    if (Array.isArray(cell) && cell.length === 3) return cell;
    current = current.parent;
  }
  return null;
}

export function cellFromWorldPoint(point: Pick<THREE.Vector3, "x" | "y" | "z">): Vec3 {
  return [Math.floor(point.x), Math.floor(point.y), Math.floor(point.z)];
}

/**
 * The cell a pointer ray lands on: a landing marker if it crosses one, else
 * the square the ray meets on the plane, raised to `planeCellY`.
 *
 * The plane sits on the floor of the active storey, not at the placement
 * height, and that separation is the point (ADR-0035). The pointer picks the
 * square it is aiming at on the floor; the elevation only says how high above
 * that square the part goes. So `[` and `]` cannot move the ghost sideways —
 * they change `planeCellY` and nothing else — and the click, which picks the
 * same way, lands on the square the ghost stood on.
 *
 * Picking against a plane raised to the elevation instead is what made the two
 * disagree: seen from the camera, a raised plane meets a still pointer nearer
 * than the floor does, so the ghost slid towards the camera as the height went
 * up. Re-picking on every plane move made the ghost agree with the click again
 * by moving both, which is the half the client rejected.
 *
 * The camera is still a dependency: turning or zooming it puts a different
 * floor square under a still pointer, so the viewport re-picks on camera moves.
 *
 * The overlay the markers live in also holds the floor shadows, which carry no
 * landing cell. Taking the nearest object and giving up when it turns out to be
 * a shadow threw away a landing marker the ray had also crossed, dropping the
 * placement back to the plane. So the search runs down the hits in distance
 * order and stops at the first one that actually names a cell.
 */
export function pickPointerCell(
  ray: THREE.Raycaster,
  landings: THREE.Object3D[],
  plane: THREE.Mesh,
  planeCellY: number
): Vec3 | null {
  for (const hit of ray.intersectObjects(landings, true)) {
    const landing = landingCellForObject(hit.object);
    if (landing) return landing;
  }
  const planeHit = ray.intersectObject(plane)[0];
  if (planeHit) {
    return [Math.floor(planeHit.point.x), Math.floor(planeCellY), Math.floor(planeHit.point.z)];
  }
  return null;
}

export function clickCellForTool(
  tool: ToolId,
  fallbackCell: Vec3 | null,
  partHitPoint?: Pick<THREE.Vector3, "x" | "y" | "z">
): Vec3 | null {
  if (tool === "erase" && partHitPoint) return cellFromWorldPoint(partHitPoint);
  return fallbackCell;
}
