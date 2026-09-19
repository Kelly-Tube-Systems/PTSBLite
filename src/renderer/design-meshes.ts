import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { KEL2020_BLOWER, KEL2020_TERMINAL } from "@/data/kel2020-geometry";
import { terminalAxisIsVertical, terminalBodyDir } from "@/domain/terminal";
import { vEq } from "@/domain/vec3";
import { buildBakedMesh, type BakedSplit } from "@/renderer/baked-geometry";
import { buildKel2020Decal, type DecalPlacement } from "@/renderer/kel2020-decal";
import { PORT_R, TUBE_R, v3, VP } from "@/renderer/three-utils";
import type { Vec3 } from "@/types";

/**
 * Meshes for the things a design is made of: blower, terminal, tube, bend and
 * obstacle. One module because they share the tube radius, the palette and the
 * ghost/solid convention, and because they are rebuilt together whenever the
 * design changes.
 *
 * Scene furniture — the ground, landing highlights, port glows, labels — lives
 * in scene-affordances.ts. It belongs to different scene groups with different
 * update lifecycles, which is the seam that matters here rather than file size.
 */

function buildTransportArrow(
  dir: THREE.Vector3 = new THREE.Vector3(1, 0, 0),
  from: Vec3 = [-0.38, 0.82, 0]
): THREE.ArrowHelper {
  return new THREE.ArrowHelper(
    dir,
    new THREE.Vector3(from[0], from[1], from[2]),
    0.82,
    VP.accent,
    0.22,
    0.14
  );
}

/**
 * Where the wordmark sits on a blower: across the drum, centred on the front,
 * at the drum's own mid-height.
 *
 * `radius` is a measurement of the baked geometry, not a choice: rays cast
 * outward from the port axis across this patch meet the drum at 0.2649 ft, and
 * anything short of that leaves the mark cut to ribbons by the facets standing
 * through it. The drum runs unbroken from the base at x = -0.5 to about
 * x = 0.28, where the neck steps in. 0.42 ft of mark is 91° of it, five inches
 * on the real six inch unit.
 */
const BLOWER_WORDMARK: DecalPlacement = {
  radius: 0.2649,
  width: 0.42,
  axis: "x",
  at: [-0.11, 0, 0]
};

/**
 * A blower: the power unit at the foot of a Kel2020 stack.
 *
 * The shape is Kelly Tube Systems' own CAD for the A444200 4 inch blower
 * assembly, baked out of the STEP file (ADR-0033) rather than drawn by eye as
 * it was until 2026-09-15. The real unit is a 6 inch drum standing just under
 * a foot tall with a 4 inch port on top, so it is scaled to exactly the cell
 * it occupies and looks slimmer than the drum it replaces — that slimness is
 * the unit's real proportions.
 *
 * The port axis is the unit's axis, because `dirToQuat` turns this whole group
 * to map +X onto the direction the blower faces. A blower with its hole up
 * therefore stands on the floor the way the real unit does, with the tube
 * leaving its top, and one turned to a side lies along its own run.
 *
 * The ring at the port is the app's, not the unit's: it says which way the
 * blower faces, which is a thing the viewport has to show and the hardware has
 * no reason to. The wordmark across the drum is the other way round — it is the
 * unit's own marking, which the CAD does not carry (ADR-0034).
 *
 * It is drawn on the rim of the neck — `PORT_R` across, at the port face — so
 * it reads as the mouth of the port. It used to stand a third wider and float
 * clear of the face, on a radius taken off `TUBE_R`, and the client asked for
 * it to fit the top of the blower exactly.
 */
export function buildBlowerMesh({ ghost = false } = {}): THREE.Group {
  const g = new THREE.Group();
  g.add(
    buildBakedMesh(
      KEL2020_BLOWER,
      () =>
        new THREE.MeshStandardMaterial({
          color: VP.blower,
          roughness: 0.62,
          metalness: 0.2,
          transparent: ghost,
          opacity: ghost ? 0.45 : 1
        })
    )
  );
  const decal = buildKel2020Decal(BLOWER_WORDMARK, { ghost });
  if (decal) g.add(decal);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(PORT_R, 0.018, 8, 24),
    new THREE.MeshBasicMaterial({ color: VP.accent, transparent: true, opacity: ghost ? 0.5 : 0.9 })
  );
  ring.position.set(0.5, 0, 0);
  ring.rotation.y = Math.PI / 2;
  g.add(ring);
  if (ghost) g.add(buildTransportArrow());
  return g;
}

/**
 * The KEL2020 mark the terminal already carries: moulded into the front of the
 * housing in the CAD itself, and picked out of the housing's faces so it can be
 * painted rather than left in the plastic's own colour (ADR-0040).
 *
 * The whole mark bakes as `body` — the first zero of 2020 is a dark solid in
 * the CAD and used to arrive with the hinges and latches, until the bake
 * learned to correct that one colour (ADR-0039) — so the split has one role to
 * take from.
 *
 * A character is a piece of its own: the CAD moulds each one as a separate
 * solid, so its triangles join up to each other and to nothing else. The mark
 * is the connected pieces of the housing that lie wholly inside the strokes'
 * own height band — y = 0.7768 to 0.8587, measured — and on the front of the
 * unit. Nothing else the housing is made of both starts and ends inside 0.08 ft
 * of height: the raised panel the lettering stands on runs y = 0.75 to 0.91
 * unbroken, and the shell runs the length of the unit.
 *
 * Three pieces of hinge leaf do share the band. They lie flat against the side
 * of the unit and reach no further forward than z = 0.018, where the mark's
 * furthest-round character starts at z = 0.078, so a front test half way
 * between the two separates them with room to spare.
 *
 * Pieces rather than a window around the lettering, because a window has now
 * cut the mark at both ends. Relief against a cylinder fitted to the housing
 * dropped the last 0 (ADR-0041), and the x span that replaced it took 0.04 ft
 * off the solid block the artwork opens the K with — read as a narrow stem
 * rather than as a missing character, so it outlived the fix for the 0
 * (ADR-0042). A piece is all of a character or none of it, so neither end can
 * be shaved.
 *
 * The emblem moulded into the **back** of the housing is a piece in the same
 * band, and the front test leaves it unpainted: it is the far side of a
 * see-through unit rather than a second mark on the front (ADR-0040).
 */
const MARK_BAND = { from: 0.77, to: 0.862 } as const;
const MARK_FRONT_Z = 0.05;

export const TERMINAL_MOULDED_MARK: BakedSplit = {
  from: "body",
  to: "mark",
  pick: ({ positions, index, faces }) => {
    // Union-find over the vertices the housing's faces share, which is what
    // "joined up" means once the bake has welded the shell into one buffer.
    const root = new Map<number, number>();
    const find = (vertex: number): number => {
      let at = vertex;
      while (root.get(at) !== at) at = root.get(at)!;
      for (let step = vertex; root.get(step) !== at;) {
        const next = root.get(step)!;
        root.set(step, at);
        step = next;
      }
      return at;
    };
    const join = (a: number, b: number): void => {
      const left = find(a);
      const right = find(b);
      if (left !== right) root.set(left, right);
    };
    for (const face of faces)
      for (let corner = 0; corner < 3; corner++) {
        const vertex = index[face + corner];
        if (!root.has(vertex)) root.set(vertex, vertex);
      }
    for (const face of faces) {
      join(index[face], index[face + 1]);
      join(index[face + 1], index[face + 2]);
    }

    // A piece is lettering until one of its corners leaves the band or the
    // front, so a stray triangle disqualifies a whole character rather than
    // half-painting one.
    const lettering = new Map<number, boolean>();
    for (const face of faces) {
      const piece = find(index[face]);
      if (lettering.get(piece) === false) continue;
      let inside = true;
      for (let corner = 0; corner < 3; corner++) {
        const vertex = index[face + corner] * 3;
        const y = positions[vertex + 1];
        const z = positions[vertex + 2];
        if (z < MARK_FRONT_Z || y < MARK_BAND.from || y > MARK_BAND.to) inside = false;
      }
      lettering.set(piece, inside);
    }

    const picked = new Set<number>();
    for (const face of faces) if (lettering.get(find(index[face]))) picked.add(face);
    return picked;
  }
};

/**
 * A terminal: a 1 ft square, 2 ft long unit, standing up or lying down.
 *
 * The shape is Kelly Tube Systems' own CAD for the A444940 4 inch terminal body
 * fabrication, baked out of the STEP file (ADR-0033) rather than drawn by eye
 * as it was until 2026-09-15: a 4 inch carrier barrel running the unit's whole
 * length with the fabricated housing, its door and its latch wrapped round the
 * middle of it. The real unit is 20¾ inches end to end and the app gives it
 * 1.9 ft between ports, so it is stretched by a tenth to meet the tubes where
 * they already leave it.
 *
 * The whole unit turns with its ports: `R` on a terminal used to swing the two
 * fittings around a cabinet that stayed standing, and the client asked for the
 * body itself to turn (ADR-0027). So the group is laid down onto its axis, and
 * a terminal whose ports run sideways lies on its side, taking two squares of
 * floor and one of height instead of the other way round.
 *
 * The baked geometry is in the standing unit's frame: the body runs up local +Y
 * from the floor of the cell it was placed in to the top of the next one, the
 * barrel opens at each end of that, and the door faces local +Z. Laying it down
 * maps that +Y onto the body direction and keeps +Z horizontal, so the door ends
 * up across the run rather than into the floor — which is where it belongs,
 * since a carrier is loaded from the front while the tube leaves the end. The
 * group's origin is the centre of the cell the terminal was placed in, and the
 * KEL2020 mark is part of the housing (ADR-0040), so a terminal on its side
 * wears its mark on its side.
 */
export function buildTerminalMesh({
  axis = [0, 1, 0],
  ghost = false
}: { axis?: Vec3; ghost?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const body = terminalBodyDir(axis);
  const vertical = terminalAxisIsVertical({ axis });

  // Metalness is kept low across the unit on purpose: the scene has no
  // environment map, so a metalness much above a third has nothing to reflect
  // and renders as near-black — which is how the brushed collars first came
  // out, indistinguishable from the barrel between them.
  g.add(
    buildBakedMesh(
      KEL2020_TERMINAL,
      (role) => {
        if (role === "glass") {
          // The barrel a carrier is loaded into: clear on the real unit, so nearly
          // transparent here rather than tinted, which is what tells it apart from
          // the blower at a glance. A little of its own light, or it takes the
          // colour of whatever is behind it — in this scene a nearly black floor,
          // and a clear barrel that renders black is worse than no barrel at all.
          return new THREE.MeshStandardMaterial({
            color: VP.terminalGlass,
            roughness: 0.12,
            metalness: 0.05,
            emissive: VP.terminalGlass,
            emissiveIntensity: 0.14,
            transparent: true,
            opacity: ghost ? 0.18 : 0.42
          });
        }
        if (role === "door") {
          return new THREE.MeshStandardMaterial({
            color: VP.terminalDoor,
            roughness: 0.5,
            metalness: 0.3,
            transparent: ghost,
            opacity: ghost ? 0.5 : 1
          });
        }
        // The CAD's dark fittings, in the graphite the blower is drawn in: they
        // are the same hardware, and a true black disappears into the floor.
        if (role === "trim") {
          return new THREE.MeshStandardMaterial({
            color: VP.blower,
            roughness: 0.55,
            metalness: 0.2,
            transparent: ghost,
            opacity: ghost ? 0.45 : 1
          });
        }
        // The KEL2020 mark moulded into the housing, painted in the green a
        // Kel2020 signs itself with: on the real unit it is a colour sticker, not
        // relief left in the plastic (ADR-0040).
        //
        // Unlit, like the wordmark on the blower's drum, so the mark holds its
        // colour wherever the unit stands; and opaque, so it reads as a sticker
        // on the housing rather than another see-through layer of it.
        //
        // Drawn from both sides because the characters are open shells: the CAD
        // leaves the outward facet off parts of the 2, the 0 and the 2, so the
        // only triangle covering those patches is one turned into the unit, and
        // culling it bit lumps out of the strokes (ADR-0042). Nothing is lost by
        // keeping them — the material is unlit, so a face reads the same green
        // whichever side of it meets the camera — and seen from behind, through a
        // housing that is see-through at the client's request, the mark now shows
        // faintly and mirrored, as ADR-0040 already accepted for the emblem on
        // the back.
        if (role === "mark") {
          return new THREE.MeshBasicMaterial({
            color: VP.signal,
            side: THREE.DoubleSide,
            transparent: ghost,
            opacity: ghost ? 0.45 : 1
          });
        }
        // The housing, which is the door a carrier is loaded through: clear on the
        // real unit, so it is drawn see-through here rather than as a solid shell
        // and the barrel behind it reads through the KEL2020 mark. It keeps a
        // little of its own light for the same reason the barrel does, and a
        // touch more body than the barrel so the two still read as two pieces.
        //
        // `depthWrite` is off because the baked groups draw the housing before the
        // barrel (src/data/kel2020-geometry.ts), and a transparent surface that
        // writes depth hides whatever is drawn behind it afterwards — which would
        // leave the housing looking see-through everywhere except over the barrel.
        return new THREE.MeshStandardMaterial({
          color: VP.terminal,
          roughness: 0.3,
          metalness: 0.2,
          emissive: VP.terminal,
          emissiveIntensity: 0.1,
          transparent: true,
          depthWrite: false,
          opacity: ghost ? 0.22 : 0.5
        });
      },
      TERMINAL_MOULDED_MARK
    )
  );
  if (ghost) {
    // The arrow says which way the run leaves. The body already lies along the
    // axis, so in this frame that is simply one end or the other: +Y when the
    // port faces the way the body runs, -Y when it faces back down it. Standing
    // up it sits off to one side, lying down it sits out in front of the door,
    // so that in both cases it clears the unit rather than crossing it.
    const forward = vEq(axis, body) ? 1 : -1;
    const arrow = buildTransportArrow(
      new THREE.Vector3(0, forward, 0),
      vertical ? [0.9, 0.5, 0] : [0, 0.5, 0.9]
    );
    g.add(arrow);
  }
  // Lay the unit onto its axis: local +Y runs along the body, local +Z stays
  // horizontal and across it. A body that runs vertically is already in that
  // pose and needs no turn at all.
  if (!vertical) {
    const along = new THREE.Vector3(body[0], body[1], body[2]);
    const across = along
      .clone()
      .cross(new THREE.Vector3(0, 1, 0))
      .normalize();
    const side = new THREE.Vector3().crossVectors(along, across);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, along, across));
  }
  return g;
}

export function tubeRenderSpan(from: Vec3, to: Vec3): { from: Vec3; to: Vec3; length: number } {
  const a = v3(from);
  const b = v3(to);
  const length = a.distanceTo(b);
  if (length < 1e-4) return { from, to, length: 0 };
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const renderFrom = a.clone().addScaledVector(dir, -0.5);
  const renderTo = b.clone().addScaledVector(dir, -0.5);
  return {
    from: [renderFrom.x, renderFrom.y, renderFrom.z],
    to: [renderTo.x, renderTo.y, renderTo.z],
    length
  };
}

export function tubeSectionJointPoints(from: Vec3, to: Vec3): Vec3[] {
  const span = tubeRenderSpan(from, to);
  if (span.length < 1e-4) return [];
  const a = v3(span.from);
  const b = v3(span.to);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const joints: Vec3[] = [];
  const sectionCount = Math.round(span.length);
  for (let i = 0; i <= sectionCount; i++) {
    const point = a.clone().addScaledVector(dir, i);
    joints.push([point.x, point.y, point.z]);
  }
  return joints;
}

export type BendShape = {
  entry: Vec3;
  exit: Vec3;
  center: Vec3;
  inDir: Vec3;
  outDir: Vec3;
  radius?: number;
};

export function bendConnectorSpans(bend: BendShape): Array<{ from: Vec3; to: Vec3 }> {
  const entry = v3(bend.entry);
  const exit = v3(bend.exit);
  const inDir = v3(bend.inDir).normalize();
  const outDir = v3(bend.outDir).normalize();
  const entryStart = entry.clone().addScaledVector(inDir, -0.5);
  const exitEnd = exit.clone().addScaledVector(outDir, 0.5);
  return [
    { from: [entryStart.x, entryStart.y, entryStart.z], to: bend.entry },
    { from: bend.exit, to: [exitEnd.x, exitEnd.y, exitEnd.z] }
  ];
}

export function buildTubeMesh(
  from: Vec3,
  to: Vec3,
  {
    ghost = false,
    blocked = false,
    accent = false
  }: { ghost?: boolean; blocked?: boolean; accent?: boolean } = {}
): THREE.Group {
  const g = new THREE.Group();
  const span = tubeRenderSpan(from, to);
  const a = v3(span.from);
  const b = v3(span.to);
  const len = span.length;
  if (len < 1e-4) return g;
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const geom = new THREE.CylinderGeometry(TUBE_R, TUBE_R, len, 18, 1, false);
  const color = blocked ? VP.danger : accent ? VP.accent : VP.tube;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.25,
    transparent: ghost,
    opacity: ghost ? 0.6 : 1
  });
  const tube = new THREE.Mesh(geom, mat);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  tube.quaternion.copy(quat);
  tube.position.copy(a).addScaledVector(dir, len / 2);
  g.add(tube);
  if (!ghost) {
    const ringGeom = new THREE.TorusGeometry(TUBE_R * 1.04, 0.012, 6, 18);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x05080c });
    for (const point of tubeSectionJointPoints(from, to)) {
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.copy(v3(point));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      g.add(ring);
    }
  }
  return g;
}

/** How much of a foot a sleeve covers, and how far it stands off the tube. */
const SLEEVE_LENGTH = 0.42;
const SLEEVE_R = TUBE_R + 0.045;

/**
 * A split sleeve: the bolted collar that joins one piece of tube to the next.
 *
 * Modelled from the Kel2020 media the client pointed at — a band a little wider
 * than the tube and about a diameter long, split along its length and closed by
 * a raised pair of flanges carrying three bolts. The shell is open at both ends
 * because it wraps a tube rather than capping it: the run stays visible running
 * through it.
 *
 * Shell and flange take the tube's own finish, not just a colour near it. A
 * standard material with no environment map loses diffuse as metalness rises,
 * so a sleeve finished more metallic than the tube renders darker than its hex
 * suggests — which is what made these read as a different material.
 *
 * Built along +Y like every cylinder here and turned onto the run's axis by the
 * caller's `along`. A real sleeve can be clocked any way round the tube the
 * installer likes, so the flange is aimed where it can be seen: upward on a
 * horizontal run, and out along +X on a vertical one. Turning by the axis alone
 * would leave it pointing at the floor on every east–west run, which is the
 * detail that says "split sleeve" rather than "band" hidden underneath.
 *
 * Sleeves are derived rather than placed (ADR-0022), so these carry no
 * `partId` and live outside the group the viewport picks against — clicking one
 * with the erase tool passes through to the tube it sits on.
 */
export function buildSplitSleeveMesh(at: Vec3, along: Vec3): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({
    color: VP.sleeve,
    roughness: 0.45,
    metalness: 0.25
  });
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(SLEEVE_R, SLEEVE_R, SLEEVE_LENGTH, 16, 1, true),
    body
  );
  g.add(shell);
  const flange = new THREE.Mesh(new THREE.BoxGeometry(0.1, SLEEVE_LENGTH * 0.94, 0.05), body);
  flange.position.x = SLEEVE_R + 0.04;
  g.add(flange);
  const boltGeom = new THREE.CylinderGeometry(0.019, 0.019, 0.11, 8);
  const boltMat = new THREE.MeshStandardMaterial({
    color: VP.sleeveBolt,
    roughness: 0.35,
    metalness: 0.8
  });
  for (const offset of [-0.13, 0, 0.13]) {
    const bolt = new THREE.Mesh(boltGeom, boltMat);
    // Through the flange, so the bolt runs tangentially rather than up the tube.
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(SLEEVE_R + 0.04, offset, 0);
    g.add(bolt);
  }
  g.position.set(at[0], at[1], at[2]);
  const axis = v3(along).normalize();
  // Local +Y onto the run, local +X onto the side the flange should face.
  const flangeOut =
    Math.abs(axis.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const third = new THREE.Vector3().crossVectors(flangeOut, axis);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(flangeOut, axis, third));
  return g;
}

class BendArc extends THREE.Curve<THREE.Vector3> {
  c: THREE.Vector3;
  r: number;
  inDir: THREE.Vector3;
  outDir: THREE.Vector3;
  constructor(center: THREE.Vector3, radius: number, inDir: Vec3, outDir: Vec3) {
    super();
    this.c = center;
    this.r = radius;
    this.inDir = new THREE.Vector3(inDir[0], inDir[1], inDir[2]);
    this.outDir = new THREE.Vector3(outDir[0], outDir[1], outDir[2]);
  }
  override getPoint(t: number, target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const ang = (Math.PI / 2) * t;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return target.set(
      this.c.x + this.r * (-this.outDir.x * c + this.inDir.x * s),
      this.c.y + this.r * (-this.outDir.y * c + this.inDir.y * s),
      this.c.z + this.r * (-this.outDir.z * c + this.inDir.z * s)
    );
  }
}

export function bendRenderCurve(bend: BendShape): BendArc {
  return new BendArc(v3(bend.center), bend.radius ?? 3, bend.inDir, bend.outDir);
}

export function bendRenderPath(bend: BendShape): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const [entryExtension, exitExtension] = bendConnectorSpans(bend);
  path.add(new THREE.LineCurve3(v3(entryExtension.from), v3(entryExtension.to)));
  path.add(bendRenderCurve(bend));
  path.add(new THREE.LineCurve3(v3(exitExtension.from), v3(exitExtension.to)));
  return path;
}

export function buildBendMesh(
  bend: BendShape,
  { ghost = false, accent = false }: { ghost?: boolean; accent?: boolean } = {}
): THREE.Group {
  const g = new THREE.Group();
  const geom = new THREE.TubeGeometry(bendRenderPath(bend), 40, TUBE_R, 14, false);
  const color = accent ? VP.accent : VP.bend;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.25,
    transparent: ghost,
    opacity: ghost ? 0.6 : 1
  });
  g.add(new THREE.Mesh(geom, mat));
  return g;
}

export function buildObstacleMesh(
  min: Vec3,
  max: Vec3,
  opts: { ghost?: boolean; penetrable?: boolean } = {}
): THREE.Group {
  const ghost = !!opts.ghost;
  // The kinds share their geometry, edges and hatching; color alone tells them
  // apart — red for a volume routing must avoid, steel blue for one it may
  // pass through.
  const color = opts.penetrable ? VP.obstaclePenetrable : VP.obstacle;
  const sx = max[0] - min[0] + 1;
  const sy = max[1] - min[1] + 1;
  const sz = max[2] - min[2] + 1;
  const cx = (min[0] + max[0] + 1) / 2;
  const cy = (min[1] + max[1] + 1) / 2;
  const cz = (min[2] + max[2] + 1) / 2;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: ghost ? 0.035 : 0.07,
    roughness: 0.95,
    depthWrite: false
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  box.position.set(cx, cy, cz);
  g.add(box);
  // Fat lines (screen-space width) so edges never drop sub-pixel segments the
  // way 1px gl.LINES do. resolution is corrected on resize by updateLineResolutions.
  const edgeGeom = new LineSegmentsGeometry().fromEdgesGeometry(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz))
  );
  const edges = new LineSegments2(
    edgeGeom,
    new LineMaterial({
      color,
      linewidth: 1.5,
      transparent: true,
      opacity: ghost ? 0.45 : 0.7,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
    })
  );
  edges.position.set(cx, cy, cz);
  g.add(edges);
  const hatchMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: ghost ? 0.25 : 0.4
  });
  // 45° hatch lines on every face. Each face is a rectangle in some (u, v)
  // plane; a hatch line is the locus u - v = c. Sweep c across the rectangle
  // and clip each line to it by its v-parameter — clamping u and v
  // independently bends the diagonals. `place` lifts (u, v) into the face's
  // 3D plane, offset slightly outward so the lines never z-fight the box.
  const lines: number[] = [];
  // The hatch spacing grows with the box. A fixed 0.6 ft was tuned for
  // furniture-sized obstacles; across a 60 ft room wall it packs hundreds of
  // diagonals per face and dissolves into moiré at any distance.
  const step = Math.max(0.6, Math.max(sx, sy, sz) / 40);
  const hatchFace = (
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    place: (u: number, v: number) => [number, number, number]
  ) => {
    const cMin = u0 - v1;
    const cMax = u1 - v0;
    for (let c = cMin; c < cMax; c += step) {
      const vLo = Math.max(v0, u0 - c);
      const vHi = Math.min(v1, u1 - c);
      if (vHi > vLo) lines.push(...place(vLo + c, vLo), ...place(vHi + c, vHi));
    }
  };
  const x0 = min[0],
    x1 = max[0] + 1;
  const y0 = min[1],
    y1 = max[1] + 1;
  const z0 = min[2],
    z1 = max[2] + 1;
  const lift = 0.002;
  hatchFace(x0, x1, z0, z1, (u, v) => [u, y1 + lift, v]); // top
  hatchFace(x0, x1, z0, z1, (u, v) => [u, y0 - lift, v]); // bottom
  hatchFace(x0, x1, y0, y1, (u, v) => [u, v, z1 + lift]); // south
  hatchFace(x0, x1, y0, y1, (u, v) => [u, v, z0 - lift]); // north
  hatchFace(z0, z1, y0, y1, (u, v) => [x1 + lift, v, u]); // east
  hatchFace(z0, z1, y0, y1, (u, v) => [x0 - lift, v, u]); // west
  if (lines.length) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    g.add(new THREE.LineSegments(lg, hatchMat));
  }
  return g;
}
