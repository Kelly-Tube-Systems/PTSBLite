import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  bendConnectorSpans,
  bendRenderCurve,
  bendRenderPath,
  buildSplitSleeveMesh,
  buildTerminalMesh,
  TERMINAL_MOULDED_MARK,
  TERMINAL_WORDMARK,
  tubeRenderSpan,
  tubeSectionJointPoints
} from "@/renderer/design-meshes";
import { KEL2020_TERMINAL } from "@/data/kel2020-geometry";
import { buildBakedMesh, drawnGeometry, type BakedRole } from "@/renderer/baked-geometry";
import { STANDOFF } from "@/renderer/kel2020-decal";
import {
  beginDragDraw,
  cellFromWorldPoint,
  clickCellForTool,
  createViewportDragState,
  dragDrawRelease,
  moveViewportDrag,
  partIdForObject,
  pickPointerCell
} from "@/renderer/interaction";
import { clearGroup, VP } from "@/renderer/three-utils";
import {
  cameraFarPlane,
  heightMarkerScale,
  maxCameraDistance,
  openingCameraDistance
} from "@/renderer/Viewport";
import { BUILD_AREA, DEFAULT_ROOM } from "@/domain/sparse-grid";

const vec = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

describe("Viewport click cell resolution", () => {
  it("uses the clicked part's world cell for erase instead of the active plane cell", () => {
    expect(clickCellForTool("erase", [2, 0, 3], { x: 2.45, y: 7.82, z: 3.5 })).toEqual([2, 7, 3]);
  });

  it("keeps non-erase clicks on the active placement plane", () => {
    expect(clickCellForTool("tube", [2, 0, 3], { x: 2.45, y: 7.82, z: 3.5 })).toEqual([2, 0, 3]);
  });

  it("floors world hit coordinates to grid cells, including negative coordinates", () => {
    expect(cellFromWorldPoint({ x: -1.05, y: 4.99, z: -0.01 })).toEqual([-2, 4, -1]);
  });
});

describe("drawing a box with a drag", () => {
  it("leaves the drag to the camera when nothing is being drawn", () => {
    expect(beginDragDraw(null, [1, 0, 1])).toBeNull();
  });

  it("leaves the drag to the camera when the press is off the grid", () => {
    expect(beginDragDraw("anchor", null)).toBeNull();
  });

  it("closes the box on the square the drag ends over", () => {
    const gesture = beginDragDraw("anchor", [1, 0, 1]);
    expect(gesture).toEqual({ from: [1, 0, 1], anchored: true });
    expect(dragDrawRelease(gesture!, [4, 0, 6])).toEqual([4, 0, 6]);
  });

  it("leaves a press and release on one square as the first of two clicks", () => {
    // The press already put that corner down, so closing here as well would
    // turn every first click into a finished one-foot box.
    const gesture = beginDragDraw("anchor", [1, 0, 1]);
    expect(dragDrawRelease(gesture!, [1, 0, 1])).toBeNull();
  });

  it("closes on the release when a click anchored the corner first", () => {
    // Nothing was anchored by this press, so the release is the second click —
    // whether the pointer travelled between the two or not.
    const gesture = beginDragDraw("close", [1, 0, 1]);
    expect(gesture).toEqual({ from: [1, 0, 1], anchored: false });
    expect(dragDrawRelease(gesture!, [1, 0, 1])).toEqual([1, 0, 1]);
  });

  it("closes nothing when the release lands off the grid", () => {
    expect(dragDrawRelease({ from: [1, 0, 1], anchored: false }, null)).toBeNull();
  });
});

describe("pickPointerCell", () => {
  /** The viewport's placement plane: a horizontal sheet at `y`. */
  function planeAt(y: number): THREE.Mesh {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200));
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = y;
    plane.updateMatrixWorld();
    return plane;
  }

  /** A pointer ray from 6 ft up, looking down and along +x/+z at 45°. */
  function pointerRay(): THREE.Raycaster {
    return new THREE.Raycaster(
      new THREE.Vector3(0.5, 6, 0.5),
      new THREE.Vector3(1, -1, 1).normalize()
    );
  }

  it("holds a still pointer on its square as the placement height rises", () => {
    // Aim at (6, 0, 6) on the floor, then press ] three times without moving.
    // The square is picked on the floor and the elevation lifts it, so the
    // ghost rises straight up the way the client asked: same x and z, 3 ft up.
    expect(pickPointerCell(pointerRay(), [], planeAt(0), 0)).toEqual([6, 0, 6]);
    expect(pickPointerCell(pointerRay(), [], planeAt(0), 3)).toEqual([6, 3, 6]);
  });

  it("takes its square from the plane, not from the height it reports", () => {
    // The regression guarded here is picking against a plane raised to the
    // elevation: that plane meets this same ray at (3, 3, 3), a cell nearer the
    // camera, which is how the ghost used to slide sideways under a still
    // pointer. Only a floor change moves the plane now.
    expect(pickPointerCell(pointerRay(), [], planeAt(3), 3)).toEqual([3, 3, 3]);
  });

  it("prefers a landing marker the ray crosses over the plane", () => {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    marker.position.set(3, 3.5, 3); // squarely on the ray
    marker.userData.landingCell = [2, 3, 2];
    marker.updateMatrixWorld();
    expect(pickPointerCell(pointerRay(), [marker], planeAt(0), 0)).toEqual([2, 3, 2]);
  });

  it("reports nothing when the ray misses the plane", () => {
    const skyward = new THREE.Raycaster(new THREE.Vector3(0, 6, 0), new THREE.Vector3(0, 1, 0));
    expect(pickPointerCell(skyward, [], planeAt(0), 0)).toBeNull();
  });

  it("looks past a nearer overlay that names no cell", () => {
    // The overlay holds the floor shadows as well as the landing markers, and a
    // shadow carries no landing cell. A raised port under a shadow — a run in
    // the plenum, with the storey above shading it — put the shadow nearest the
    // camera, and stopping there threw away the marker the ray went on to cross
    // and dropped the placement back to the plane.
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    shadow.position.set(2, 4.5, 2);
    shadow.updateMatrixWorld();
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    marker.position.set(3, 3.5, 3);
    marker.userData.landingCell = [2, 3, 2];
    marker.updateMatrixWorld();

    expect(pickPointerCell(pointerRay(), [shadow, marker], planeAt(0), 0)).toEqual([2, 3, 2]);
  });
});

describe("Viewport camera drag handling", () => {
  it("ignores window mouse movement when the drag did not start in the viewport", () => {
    const drag = createViewportDragState();
    const moved = moveViewportDrag(drag, { x: 240, y: 120 }, 1);

    expect(moved.delta).toBeNull();
    expect(moved.state.dragging).toBe(false);
  });
});

describe("Viewport tube and bend render alignment", () => {
  it("draws tube geometry on occupied grid-cell boundaries instead of centerline endpoints", () => {
    expect(tubeRenderSpan([1.5, 0.5, 0.5], [7.5, 0.5, 0.5])).toEqual({
      from: [1, 0.5, 0.5],
      to: [7, 0.5, 0.5],
      length: 6
    });
  });

  it("aligns visible tube section joints with grid lines", () => {
    expect(tubeSectionJointPoints([1.5, 0.5, 0.5], [7.5, 0.5, 0.5])).toEqual([
      [1, 0.5, 0.5],
      [2, 0.5, 0.5],
      [3, 0.5, 0.5],
      [4, 0.5, 0.5],
      [5, 0.5, 0.5],
      [6, 0.5, 0.5],
      [7, 0.5, 0.5]
    ]);
  });

  it("keeps negative-direction tube joints on grid lines too", () => {
    expect(tubeRenderSpan([1.5, 0.5, 0.5], [1.5, 0.5, -5.5])).toEqual({
      from: [1.5, 0.5, 1],
      to: [1.5, 0.5, -5],
      length: 6
    });
  });

  it("keeps straight tube render spans grid-bound at bend connections", () => {
    // Spans feeding and leaving a +X -> +Z bend that enters at [1.5, 0.5, 0.5]
    // and exits at [4.5, 0.5, 3.5]: both must still land on whole cells.
    expect(tubeRenderSpan([-4.5, 0.5, 0.5], [1.5, 0.5, 0.5])).toEqual({
      from: [-5, 0.5, 0.5],
      to: [1, 0.5, 0.5],
      length: 6
    });
    expect(tubeRenderSpan([4.5, 0.5, 4.5], [4.5, 0.5, 10.5])).toEqual({
      from: [4.5, 0.5, 4],
      to: [4.5, 0.5, 10],
      length: 6
    });
  });

  it("starts a tube placed after a bend at the bend extension boundary", () => {
    const bend = {
      entry: vec(1.5, 0.5, 0.5),
      exit: vec(4.5, 0.5, 3.5),
      center: vec(1.5, 0.5, 3.5),
      inDir: vec(1, 0, 0),
      outDir: vec(0, 0, 1),
      radius: 3
    };
    const [, exitExtension] = bendConnectorSpans(bend);

    expect(tubeRenderSpan([4.5, 0.5, 4.5], [4.5, 0.5, 10.5])).toEqual({
      from: exitExtension.to,
      to: [4.5, 0.5, 10],
      length: 6
    });
    expect(tubeSectionJointPoints([4.5, 0.5, 4.5], [4.5, 0.5, 10.5])[0]).toEqual(exitExtension.to);
  });

  it("adds bend tangent extensions without shifting straight tube boundaries", () => {
    const bend = {
      entry: vec(1.5, 0.5, 0.5),
      exit: vec(4.5, 0.5, 3.5),
      center: vec(1.5, 0.5, 3.5),
      inDir: vec(1, 0, 0),
      outDir: vec(0, 0, 1),
      radius: 3
    };

    expect(bendConnectorSpans(bend)).toEqual([
      { from: [1, 0.5, 0.5], to: [1.5, 0.5, 0.5] },
      { from: [4.5, 0.5, 3.5], to: [4.5, 0.5, 4] }
    ]);
  });

  it("draws bend extensions and the circular arc as one continuous visual path", () => {
    const bend = {
      entry: vec(1.5, 0.5, 0.5),
      exit: vec(4.5, 0.5, 3.5),
      center: vec(1.5, 0.5, 3.5),
      inDir: vec(1, 0, 0),
      outDir: vec(0, 0, 1),
      radius: 3
    };
    const path = bendRenderPath(bend);
    const start = path.getPoint(0);
    const end = path.getPoint(1);

    expect(path.curves).toHaveLength(3);
    expect([start.x, start.y, start.z]).toEqual([1, 0.5, 0.5]);
    expect([end.x, end.y, end.z]).toEqual([4.5, 0.5, 4]);
  });

  it("keeps a full six feet visible when a tube leaves a bend", () => {
    const tube = { from: vec(4.5, 7.5, 0.5), to: vec(10.5, 7.5, 0.5) };

    expect(tubeRenderSpan(tube.from, tube.to)).toEqual({
      from: [4, 7.5, 0.5],
      to: [10, 7.5, 0.5],
      length: 6
    });
    expect(tubeSectionJointPoints(tube.from, tube.to)).toEqual([
      [4, 7.5, 0.5],
      [5, 7.5, 0.5],
      [6, 7.5, 0.5],
      [7, 7.5, 0.5],
      [8, 7.5, 0.5],
      [9, 7.5, 0.5],
      [10, 7.5, 0.5]
    ]);
  });

  it("keeps a full six feet visible when a tube enters a bend", () => {
    const tube = { from: vec(4.5, 7.5, 0.5), to: vec(10.5, 7.5, 0.5) };

    expect(tubeRenderSpan(tube.from, tube.to)).toEqual({
      from: [4, 7.5, 0.5],
      to: [10, 7.5, 0.5],
      length: 6
    });
    expect(tubeSectionJointPoints(tube.from, tube.to)).toEqual([
      [4, 7.5, 0.5],
      [5, 7.5, 0.5],
      [6, 7.5, 0.5],
      [7, 7.5, 0.5],
      [8, 7.5, 0.5],
      [9, 7.5, 0.5],
      [10, 7.5, 0.5]
    ]);
  });

  it("keeps vertical tube rings grid-bound when a bend is placed at the tube end", () => {
    const tube = { from: vec(0.5, 1.5, 0.5), to: vec(0.5, 7.5, 0.5) };

    expect(tubeRenderSpan(tube.from, tube.to)).toEqual({
      from: [0.5, 1, 0.5],
      to: [0.5, 7, 0.5],
      length: 6
    });
    expect(tubeSectionJointPoints(tube.from, tube.to)).toEqual([
      [0.5, 1, 0.5],
      [0.5, 2, 0.5],
      [0.5, 3, 0.5],
      [0.5, 4, 0.5],
      [0.5, 5, 0.5],
      [0.5, 6, 0.5],
      [0.5, 7, 0.5]
    ]);
  });

  it("keeps bend centerlines circular", () => {
    const bend = {
      entry: vec(1.5, 0.5, 0.5),
      exit: vec(4.5, 0.5, 3.5),
      center: vec(1.5, 0.5, 3.5),
      inDir: vec(1, 0, 0),
      outDir: vec(0, 0, 1),
      radius: 3
    };
    const curve = bendRenderCurve(bend);

    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const point = curve.getPoint(t);
      expect(Math.hypot(point.x - 1.5, point.y - 0.5, point.z - 3.5)).toBeCloseTo(3, 5);
    }
  });
});

describe("terminal materials", () => {
  // The client asked for the door — the housing the KEL2020 mark is on — to be
  // see-through like the real unit's, so the barrel behind it shows. Two things
  // make that work and neither is visible in the shape of the mesh: the housing
  // has to be transparent, and it has to stay out of the depth buffer, because
  // the baked groups draw it before the barrel and a transparent surface that
  // writes depth hides whatever is drawn behind it afterwards.
  const drawn = drawnGeometry(KEL2020_TERMINAL, TERMINAL_MOULDED_MARK);
  const materialFor = (role: BakedRole, ghost = false): THREE.MeshStandardMaterial => {
    const mesh = buildTerminalMesh({ ghost }).children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh
    )!;
    const at = drawn.groups.findIndex((group) => group.role === role);
    const slot = mesh.geometry.groups[at].materialIndex!;
    return (mesh.material as THREE.Material[])[slot] as THREE.MeshStandardMaterial;
  };

  it("draws the door see-through, with the barrel behind it still reaching the screen", () => {
    const door = materialFor("body");
    expect(door.transparent).toBe(true);
    expect(door.opacity).toBeLessThan(1);
    expect(door.depthWrite).toBe(false);
    const groups = KEL2020_TERMINAL.groups.map((group) => group.role);
    expect(groups.indexOf("glass")).toBeGreaterThan(groups.indexOf("body"));
  });

  it("keeps the placement ghost fainter than a placed unit", () => {
    // Both are see-through now, so the one cue that told them apart — solid
    // versus not — is gone, and only the difference in opacity is left.
    expect(materialFor("body", true).opacity).toBeLessThan(materialFor("body").opacity);
  });
});

describe("the KEL2020 mark on a terminal", () => {
  // The terminal's mark is the artwork the blower wears, laid on the cylinder
  // the CAD moulded KEL2020 onto, with the moulding itself cut away (ADR-0050).
  // Two things have to hold and neither is visible in the shape of the mesh:
  // the cut finds the whole moulding, or grey relief is left beside the green
  // sticker; and the sticker lands where the moulding was, or it floats off the
  // panel or sinks into it. Both are measured off the baked geometry, so a
  // re-bake that moved the housing fails here rather than on the client's
  // screen — which is how the last three attempts at this mark were found.

  /** Corner positions of the faces the cut takes out of the housing. */
  function mouldedCorners(): { x: number; y: number; z: number }[] {
    const geometry = buildBakedMesh(KEL2020_TERMINAL, () => new THREE.MeshBasicMaterial()).geometry;
    const position = geometry.getAttribute("position");
    const positions = new Float32Array(position.count * 3);
    for (let vertex = 0; vertex < position.count; vertex++) {
      positions[vertex * 3] = position.getX(vertex);
      positions[vertex * 3 + 1] = position.getY(vertex);
      positions[vertex * 3 + 2] = position.getZ(vertex);
    }
    const index = drawnGeometry(KEL2020_TERMINAL).index;
    const faces: number[] = [];
    for (const group of KEL2020_TERMINAL.groups) {
      if (group.role !== "body") continue;
      for (let face = group.start; face < group.start + group.count; face += 3) faces.push(face);
    }
    const dropped = TERMINAL_MOULDED_MARK.pick({ positions, index, faces });
    const corners: { x: number; y: number; z: number }[] = [];
    for (const face of dropped)
      for (let corner = 0; corner < 3; corner++) {
        const vertex = index[face + corner];
        corners.push({
          x: positions[vertex * 3],
          y: positions[vertex * 3 + 1],
          z: positions[vertex * 3 + 2]
        });
      }
    return corners;
  }

  /** Where a point sits on the cylinder the decal is wrapped on. */
  function onDecalCylinder(point: { x: number; y: number; z: number }): {
    radius: number;
    angle: number;
  } {
    const across = point.x - TERMINAL_WORDMARK.at[0];
    const out = point.z - TERMINAL_WORDMARK.at[2];
    return { radius: Math.hypot(across, out), angle: Math.atan2(across, out) };
  }

  it("cuts the whole of the moulded mark out of the housing", () => {
    const corners = mouldedCorners();
    expect(corners.length).toBeGreaterThan(300);
    const across = corners.map((corner) => corner.x);
    const up = corners.map((corner) => corner.y);
    // All seven characters, the whole width of each. The lettering runs 0.371 ft
    // across the front of the housing. Without the last 0 it runs 0.29, which is
    // what the client saw when the unit read KEL202 (Trello c9VZJ9vY); without
    // the far end of the block that opens the K it runs 0.330, which is what he
    // saw next (Trello wQTcFyRn), and the bar here was 0.33, which that cleared
    // by a thousandth of a foot.
    expect(Math.max(...across) - Math.min(...across)).toBeGreaterThan(0.36);
    // And only the lettering. It stands 0.08 ft tall on a raised panel twice
    // that, so a rule that took the panel with it — the other way this can go
    // wrong — would cut a slot out of the front of the unit, and would show up
    // here as a taller band.
    expect(Math.max(...up) - Math.min(...up)).toBeGreaterThan(0.05);
    expect(Math.max(...up) - Math.min(...up)).toBeLessThan(0.1);
    for (const corner of corners) {
      expect(corner.z).toBeGreaterThan(0.05);
      expect(corner.y).toBeGreaterThan(0.75);
      expect(corner.y).toBeLessThan(0.88);
    }
  });

  it("leaves nothing moulded in the strokes' band still drawn", () => {
    // The width above says the cut reaches both ends. This says the same thing
    // from the other side, and is the one a rule that shaves an end cannot
    // pass: no face moulded onto the front of the housing between the top and
    // bottom of the strokes is still drawn.
    //
    // It is bounded by the strokes rather than by whatever the cut measures, so
    // it cannot be quieted by widening that — the panel would come with it and
    // fail the height check above.
    const mesh = buildTerminalMesh().children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh
    )!;
    const drawn = drawnGeometry(KEL2020_TERMINAL, TERMINAL_MOULDED_MARK);
    const position = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.getIndex()!;
    let left = 0;
    for (const group of drawn.groups)
      for (let face = group.start; face < group.start + group.count; face += 3) {
        const corners = [0, 1, 2].map((corner) => {
          const vertex = index.getX(face + corner);
          return { y: position.getY(vertex), z: position.getZ(vertex) };
        });
        if (corners.every(({ y, z }) => z > 0.05 && y > 0.7768 && y < 0.8587)) left++;
      }
    expect(left).toBe(0);
  });

  it("lays the sticker on the cylinder the moulding stood on", () => {
    // The moulding is the real unit's sticker, measured: where it sat is where
    // the decal goes. Its base lies on the decal's own radius and its relief
    // stands 0.003 ft off that, so every corner of it falls in a band that
    // thin — which is only true if the panel really is a cylinder about this
    // axis. It was read as not being one when the mark was picked out by relief
    // against the housing's shell, which is a wider cylinder on a different
    // axis (ADR-0041).
    const corners = mouldedCorners();
    const radii = corners.map((corner) => onDecalCylinder(corner).radius);
    expect(Math.min(...radii)).toBeGreaterThan(TERMINAL_WORDMARK.radius - 0.001);
    expect(Math.max(...radii)).toBeLessThan(TERMINAL_WORDMARK.radius + 0.004);

    // And the sticker spans it: the same arc, at the same mid-height. Within
    // 0.03 rad at each end, which is 0.006 ft — the moulding sits about 0.7°
    // round from the front and the decal is wrapped symmetrically about it, so
    // the two ends miss by that much in opposite directions.
    const angles = corners.map((corner) => onDecalCylinder(corner).angle);
    const surface = TERMINAL_WORDMARK.radius + STANDOFF;
    const arc = TERMINAL_WORDMARK.width / surface;
    expect(Math.abs(Math.max(...angles) - arc / 2)).toBeLessThan(0.03);
    expect(Math.abs(Math.min(...angles) + arc / 2)).toBeLessThan(0.03);
    const up = corners.map((corner) => corner.y);
    expect((Math.min(...up) + Math.max(...up)) / 2).toBeCloseTo(TERMINAL_WORDMARK.at[1], 3);
  });

  it("keeps the sticker clear of everything the terminal still draws", () => {
    // A decal that sinks into the surface it names is clipped by it, which is
    // the raggedness this change is fixing rather than a new way to cause it.
    // So nothing the terminal draws inside the sticker's own footprint may
    // reach the sticker's surface.
    const mesh = buildTerminalMesh().children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh
    )!;
    const position = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.getIndex()!;
    const surface = TERMINAL_WORDMARK.radius + STANDOFF;
    const arc = TERMINAL_WORDMARK.width / surface;
    const height = TERMINAL_WORDMARK.width / (1508 / 223);
    // Across each triangle rather than at its corners: the housing's facets are
    // coarse next to a mark an inch tall, and the panel behind the sticker is
    // spanned by triangles whose corners are all outside it.
    const STEPS = 16;
    const corner = new THREE.Vector3();
    const point = new THREE.Vector3();
    let under = 0;
    let blocked = 0;
    for (let face = 0; face < index.count; face += 3) {
      const abc = [0, 1, 2].map((at) =>
        corner.fromBufferAttribute(position, index.getX(face + at)).clone()
      );
      for (let i = 0; i <= STEPS; i++)
        for (let j = 0; i + j <= STEPS; j++) {
          const u = i / STEPS;
          const v = j / STEPS;
          point
            .copy(abc[0])
            .multiplyScalar(1 - u - v)
            .addScaledVector(abc[1], u)
            .addScaledVector(abc[2], v);
          if (Math.abs(point.y - TERMINAL_WORDMARK.at[1]) > height / 2) continue;
          const { radius, angle } = onDecalCylinder(point);
          if (Math.abs(angle) > arc / 2) continue;
          under++;
          if (radius >= surface) blocked++;
        }
    }
    // The panel is behind the sticker for its whole width, so there is plenty
    // here to clear; a footprint that had drifted off the unit would pass an
    // empty check.
    expect(under).toBeGreaterThan(100);
    expect(blocked).toBe(0);
  });
});

describe("split sleeve mesh", () => {
  // Where a sleeve belongs is split-sleeve.ts's problem and is tested there.
  // What matters here is that the collar ends up wrapped around the run rather
  // than lying across it: the mesh is built along +Y like every cylinder in
  // this module, so the turn onto the run's axis is the part that can be wrong.
  const axisOf = (mesh: THREE.Group): THREE.Vector3 =>
    new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion);

  it("stands the collar on the axis of the run it wraps", () => {
    for (const along of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ] as const) {
      const axis = axisOf(buildSplitSleeveMesh([2, 0.5, 0.5], along));
      expect(axis.x).toBeCloseTo(along[0], 6);
      expect(axis.y).toBeCloseTo(along[1], 6);
      expect(axis.z).toBeCloseTo(along[2], 6);
    }
  });

  it("aims the bolted flange where it can be seen", () => {
    // Turning by the run's axis alone leaves the flange pointing at the floor on
    // an east-west run, which hides the one detail that reads as a split.
    const flangeOf = (along: readonly [number, number, number]): THREE.Vector3 =>
      new THREE.Vector3(1, 0, 0).applyQuaternion(buildSplitSleeveMesh([0, 0, 0], along).quaternion);
    expect(flangeOf([1, 0, 0]).y).toBeCloseTo(1, 6);
    expect(flangeOf([0, 0, 1]).y).toBeCloseTo(1, 6);
    // Nothing is "up" on a vertical run, so it goes out to the side instead.
    expect(flangeOf([0, 1, 0]).x).toBeCloseTo(1, 6);
  });

  it("sits where it is told, and is no wider than a foot of grid", () => {
    const mesh = buildSplitSleeveMesh([2, 0.5, 0.5], [1, 0, 0]);
    expect(mesh.position.toArray()).toEqual([2, 0.5, 0.5]);
    // A sleeve straddles a cell face, so anything approaching a whole cell
    // would read as a part rather than as the joint between two.
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeLessThan(1);
  });

  it("carries no part id, so erase reaches the tube underneath", () => {
    const mesh = buildSplitSleeveMesh([2, 0.5, 0.5], [1, 0, 0]);
    expect(partIdForObject(mesh)).toBeUndefined();
    for (const child of mesh.children) expect(partIdForObject(child)).toBeUndefined();
  });

  it("reads as the tube's grey, a hair darker", () => {
    // The client's own description of the real hardware: the same shade as the
    // tube, just a hair darker. An earlier sleeve was near-black, so this pins
    // both halves — close enough to be the same material, dark enough to see.
    const lightnessOf = (hex: number): number =>
      new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l;
    const sleeve = lightnessOf(VP.sleeve);
    const tube = lightnessOf(VP.tube);
    expect(sleeve).toBeLessThan(tube);
    expect(tube - sleeve).toBeLessThan(0.1);
    // And the same finish, or the shading reintroduces the gap the colour closed.
    const shell = buildSplitSleeveMesh([2, 0.5, 0.5], [1, 0, 0]).children[0] as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(shell.material.metalness).toBe(0.25);
    expect(shell.material.roughness).toBe(0.45);
  });
});

describe("clearGroup", () => {
  it("disposes nested geometries, materials, and material textures", () => {
    const group = new THREE.Group();

    const meshGeometry = new THREE.BoxGeometry(1, 1, 1);
    const meshMaterial = new THREE.MeshStandardMaterial();
    const texture = new THREE.Texture();
    meshMaterial.map = texture;
    const mesh = new THREE.Mesh(meshGeometry, meshMaterial);

    // Nested one level down, so we know the traversal recurses rather than only
    // touching direct children.
    const childGeometry = new THREE.BufferGeometry();
    const childMaterial = new THREE.LineBasicMaterial();
    mesh.add(new THREE.LineSegments(childGeometry, childMaterial));
    group.add(mesh);

    const disposals = [meshGeometry, meshMaterial, texture, childGeometry, childMaterial].map(
      (resource) => vi.spyOn(resource, "dispose")
    );

    clearGroup(group);

    expect(group.children).toHaveLength(0);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalled();
  });

  it("disposes every element of a multi-material mesh", () => {
    const group = new THREE.Group();
    const materials = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials));

    const disposals = materials.map((material) => vi.spyOn(material, "dispose"));

    clearGroup(group);

    for (const dispose of disposals) expect(dispose).toHaveBeenCalled();
  });
});

describe("three.js integration points", () => {
  // Nothing else exercises three at runtime -- the helpers above are pure math and
  // App mocks the Viewport -- so these pin the two APIs most likely to churn
  // across a three upgrade. Constructing geometries and materials needs no WebGL
  // context; only rendering does.
  it("builds tube geometry from a bend path", () => {
    const path = bendRenderPath({
      entry: vec(1.5, 0.5, 0.5),
      exit: vec(4.5, 0.5, 3.5),
      center: vec(1.5, 0.5, 3.5),
      inDir: vec(1, 0, 0),
      outDir: vec(0, 0, 1),
      radius: 3
    });
    const geometry = new THREE.TubeGeometry(path, 40, 0.22, 14, false);
    const position = geometry.getAttribute("position");

    expect(position.count).toBeGreaterThan(0);
    expect(Number.isFinite(position.array[0])).toBe(true);
  });

  it("builds fat-line geometry and material for obstacle edges", () => {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2));
    const geometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);

    expect(geometry.getAttribute("instanceStart").count).toBeGreaterThan(0);

    // linewidth is interpreted in pixels via the resolution uniform, so both have
    // to keep working or obstacle outlines render at the wrong thickness.
    const material = new LineMaterial({
      color: 0xc23a48,
      linewidth: 1.5,
      resolution: new THREE.Vector2(800, 600)
    });

    expect(material.linewidth).toBe(1.5);
    expect(material.resolution.x).toBe(800);
  });
});

describe("how far the camera may pull back", () => {
  it("pulls back far enough to frame the whole build area", () => {
    // A 38 degree vertical field needs span / (2 * tan(19deg)) to fit a span.
    const needed =
      Math.hypot(BUILD_AREA.width, BUILD_AREA.depth) / (2 * Math.tan((19 * Math.PI) / 180));
    expect(maxCameraDistance(BUILD_AREA)).toBeGreaterThan(needed);
  });

  it("keeps the far plane clear of the build area at full pull-back", () => {
    // The regression this guards: a fixed far plane of 200 clipped the back
    // off anything larger than the old default build area.
    const halfDiagonal = Math.hypot(BUILD_AREA.width, BUILD_AREA.depth) / 2;
    expect(cameraFarPlane(BUILD_AREA)).toBeGreaterThan(
      maxCameraDistance(BUILD_AREA) + halfDiagonal
    );
  });
});

describe("where the camera opens", () => {
  const LARGEST = { width: BUILD_AREA.width, depth: BUILD_AREA.depth };

  it("opens outside the default room's walls, not inside them", () => {
    // The regression this guards: the wall-less era's opening distance of 38
    // sat inside the room once walls existed, filling the frame with hatch.
    // 1.6 diagonals — maxCameraDistance's own see-it-whole multiple — stands
    // clear of the room's footprint with margin, whatever that footprint is.
    const { width, depth } = DEFAULT_ROOM;
    const opening = openingCameraDistance(DEFAULT_ROOM);
    expect(opening).toBeCloseTo(Math.hypot(width, depth) * 1.6, 5);
    // Past the near corner, so the camera is outside the walls rather than in.
    expect(opening).toBeGreaterThan(Math.hypot(width / 2, depth / 2));
  });

  it("stands further back for a larger room", () => {
    expect(openingCameraDistance(LARGEST)).toBeGreaterThan(openingCameraDistance(DEFAULT_ROOM));
  });

  it("frames every room at the same multiple of its diagonal", () => {
    const ratio =
      Math.hypot(LARGEST.width, LARGEST.depth) / Math.hypot(DEFAULT_ROOM.width, DEFAULT_ROOM.depth);
    expect(openingCameraDistance(LARGEST)).toBeCloseTo(
      openingCameraDistance(DEFAULT_ROOM) * ratio,
      5
    );
  });

  it("never opens beyond where the visitor could scroll back to", () => {
    // The wheel's limit is the build area's; no room may open past it.
    for (const room of [DEFAULT_ROOM, LARGEST, { width: 4, depth: 4 }]) {
      expect(openingCameraDistance(room)).toBeLessThanOrEqual(maxCameraDistance(BUILD_AREA));
    }
  });

  it("keeps a degenerate footprint off the camera's nose", () => {
    // The smallest legal room (4 x 4) already clears the 8 ft minimum at 1.6
    // diagonals; the floor still guards anything smaller reaching this code.
    expect(openingCameraDistance({ width: 4, depth: 4 })).toBeCloseTo(Math.hypot(4, 4) * 1.6, 5);
    expect(openingCameraDistance({ width: 1, depth: 1 })).toBe(8);
  });
});

describe("how big a height marker draws", () => {
  const VIEWPORT = 760;
  /** What the marker's on-screen height works out to at a given distance. */
  const pixels = (distance: number) => {
    const { feet } = heightMarkerScale(distance, VIEWPORT);
    const perPixel = (2 * distance * Math.tan((38 * Math.PI) / 360)) / VIEWPORT;
    return feet / perPixel;
  };

  it("shrinks with the part it labels through the working range", () => {
    // The regression this guards: markers held a constant pixel size, so
    // zooming out grew them relative to the part until they covered it.
    // Doubling the distance must halve the marker on screen.
    expect(pixels(120)).toBeCloseTo(pixels(60) / 2, 4);
  });

  it("still draws a marker at the default opening, small as it is", () => {
    // The client traded legibility here away for smaller markers — "that's
    // what zoom is for" — so this no longer asks for a readable 11 px. What it
    // does hold is that shrinking them did not make them vanish from the view
    // every design opens on.
    const opening = openingCameraDistance(DEFAULT_ROOM);
    expect(heightMarkerScale(opening, VIEWPORT).visible).toBe(true);
    expect(pixels(opening)).toBeLessThan(11);
  });

  it("keeps a marker smaller than the cell it labels", () => {
    // The complaint that started this: markers were bigger than some parts. A
    // part is one 1 ft cell, so beyond the near clamp a marker must be under a
    // cell tall at every distance it is drawn at.
    for (const distance of [40, 80, openingCameraDistance(DEFAULT_ROOM), 140]) {
      expect(heightMarkerScale(distance, VIEWPORT).feet).toBeLessThan(1);
    }
  });

  it("keeps markers through a good pull-back past the opening view", () => {
    // Dropping the legibility floor with the size would have swapped one
    // complaint for another: markers disappearing the moment you zoom out.
    expect(heightMarkerScale(openingCameraDistance(DEFAULT_ROOM) * 1.4, VIEWPORT).visible).toBe(
      true
    );
  });

  it("keeps the far cut-off where it was when markers stood taller", () => {
    // The trap in shrinking a marker: the minimum is a pixel count, so leaving
    // it alone moves the point markers vanish at *towards* the camera — the
    // client asked for smaller, not for gone sooner. What holds is a distance,
    // and it belongs either side of the pull-back the row above checks.
    const opening = openingCameraDistance(DEFAULT_ROOM);
    expect(heightMarkerScale(opening * 1.45, VIEWPORT).visible).toBe(true);
    expect(heightMarkerScale(opening * 1.7, VIEWPORT).visible).toBe(false);
  });

  it("stops drawing once there is nothing left of a marker to read", () => {
    // Pulled right back over the build area a label is fuzz; the elevation is
    // still shown beside the armed tool, so nothing is actually lost.
    expect(heightMarkerScale(maxCameraDistance(BUILD_AREA), VIEWPORT).visible).toBe(false);
  });

  it("never lets a marker cover the part at close range", () => {
    // Without the cap a world-sized marker fills a third of the screen at the
    // closest the wheel allows.
    for (const distance of [8, 12, 20]) {
      expect(pixels(distance)).toBeLessThanOrEqual(64.001);
    }
    expect(heightMarkerScale(8, VIEWPORT).visible).toBe(true);
  });
});
