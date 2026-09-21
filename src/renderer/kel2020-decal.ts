import * as THREE from "three";
import { KEL2020_WORDMARK_GLYPHS } from "@/data/kel2020-wordmark";
import { VP } from "@/renderer/three-utils";
import type { Vec3 } from "@/types";

/**
 * The KEL2020 wordmark, wrapped onto the blower's drum (ADR-0034).
 *
 * The blower's CAD carries its shape and not its markings, so the mark is a
 * separate piece of geometry rather than another material role: a strip of
 * cylinder standing a few thousandths of a foot off the surface it names,
 * textured with the artwork and cut out by alpha.
 *
 * It is a cylinder strip and not a flat plane because the drum is round and the
 * mark is wide enough to see the curve — about 96° of it. A tangent plane would
 * lift its ends a tenth of an inch clear of the unit, which reads as a label
 * peeling off.
 *
 * The terminal wears one too. It stopped for a while, because its own CAD
 * moulds KEL2020 into the housing and the decal sat over that as a second mark,
 * so the moulded one was painted instead (ADR-0040). Three rules for finding
 * those faces later, the moulding still would not read as cleanly as this does:
 * it is a tessellation, open in places and stockier than the artwork. So the
 * moulding is cut away and the decal is back, on the cylinder the moulding
 * stood on, which is where the real unit's sticker is (ADR-0050).
 */

/** The box the artwork's ink actually fills, inside its 1575 x 366 viewBox. */
const INK = { x: 33, y: 65, width: 1508, height: 223 } as const;
const INK_ASPECT = INK.width / INK.height;

/**
 * Wide enough that the mark is drawn a little over a pixel per artwork unit
 * when a part fills the viewport, which is as close as anyone gets to it.
 */
const TEXTURE_WIDTH = 1024;

/**
 * How far the mark stands off the surface it sits on, in feet. Enough that no
 * viewing angle lets the two z-fight, and under a hundredth of an inch, so it
 * still looks painted on rather than bolted to the unit.
 */
export const STANDOFF = 0.004;

/**
 * One texture for every blower and terminal in the scene, drawn the first time
 * a part asks for it.
 *
 * Shared because it is the same mark on every unit and a design can hold
 * dozens of them, and because the placement ghost rebuilds its mesh on each
 * cell the cursor crosses — a texture per mesh would rasterise and re-upload
 * the wordmark on every mouse move. `userData.shared` is how `disposeObject`
 * knows not to free it with the first part erased.
 *
 * `null` means this environment cannot draw it: happy-dom has no 2D context,
 * and a browser old enough to lack `Path2D` cannot take the artwork's path
 * data. Both build the parts without their mark rather than failing to mount.
 */
let wordmark: THREE.CanvasTexture | null | undefined;

function wordmarkTexture(): THREE.CanvasTexture | null {
  if (wordmark !== undefined) return wordmark;
  wordmark = drawWordmark();
  return wordmark;
}

function drawWordmark(): THREE.CanvasTexture | null {
  if (typeof Path2D === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = Math.round(TEXTURE_WIDTH / INK_ASPECT);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // The glyphs are drawn white and tinted by the material, so the palette
  // stays in three-utils.ts with every other colour the viewport chooses. The
  // artwork's own green is Kelly Tube Systems' brand green, which is a shade
  // the app has already decided not to use (ADR-0026).
  const scale = canvas.width / INK.width;
  ctx.setTransform(scale, 0, 0, scale, -INK.x * scale, -INK.y * scale);
  ctx.fillStyle = "#ffffff";
  for (const glyph of KEL2020_WORDMARK_GLYPHS) {
    const path = new Path2D();
    path.addPath(new Path2D(glyph.d), new DOMMatrix().translate(glyph.x ?? 0, 0));
    ctx.fill(path, glyph.evenOdd ? "evenodd" : "nonzero");
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.shared = true;
  return texture;
}

export type DecalPlacement = {
  /** Radius of the surface the mark sits on, in the part's own frame. */
  radius: number;
  /** How wide the mark runs across that surface, in feet, measured on the arc. */
  width: number;
  /** Which of the part's own axes the surface runs along. */
  axis: "x" | "y";
  /** Centre of the mark, on the surface's axis, in the part's own frame. */
  at: Vec3;
};

/**
 * The wordmark as a mesh in the part's own frame, centred on local +Z — the
 * side a blower's port ring and a terminal's door both face — and reading left
 * to right from there.
 *
 * Cut out by `alphaTest` rather than blended, so the mark stays an opaque
 * object: it sorts and occludes like the unit it is painted on, and does not
 * have to be ordered against the terminal's clear barrel. A ghost turns it
 * transparent along with everything else.
 */
export function buildKel2020Decal(
  { radius, width, axis, at }: DecalPlacement,
  { ghost = false } = {}
): THREE.Mesh | null {
  const map = wordmarkTexture();
  if (!map) return null;
  const surface = radius + STANDOFF;
  const arc = width / surface;
  const geometry = new THREE.CylinderGeometry(
    surface,
    surface,
    width / INK_ASPECT,
    24,
    1,
    true,
    -arc / 2,
    arc
  );
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map,
      color: VP.signal,
      alphaTest: 0.4,
      transparent: ghost,
      opacity: ghost ? 0.45 : 1
    })
  );
  // The strip is built around local +Y. A blower's drum runs along its port
  // axis instead, which is local +X, so the mark turns with the unit and still
  // reads upright when it stands on the floor with its port up.
  if (axis === "x") mesh.rotation.z = -Math.PI / 2;
  mesh.position.set(at[0], at[1], at[2]);
  return mesh;
}
