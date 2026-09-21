import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { KEL2020_BLOWER, KEL2020_TERMINAL } from "@/data/kel2020-geometry";
import {
  buildBakedMesh,
  drawnGeometry,
  type BakedGeometry,
  type BakedCut,
  type BakedRole
} from "@/renderer/baked-geometry";

/**
 * The baked parts are generated, so there is nothing to test about how they were
 * written. What is worth holding is where they land: the whole point of scaling
 * the CAD into the app's frame (ADR-0033) is that a tube drawn to a cell
 * boundary meets the port that is supposed to be there. A re-bake that moved a
 * part half a foot would otherwise only show up as tubes floating in the air.
 */

function meshFor(baked: BakedGeometry): THREE.Mesh {
  return buildBakedMesh(baked, () => new THREE.MeshBasicMaterial());
}

function boxOf(baked: BakedGeometry): THREE.Box3 {
  const mesh = meshFor(baked);
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!;
}

const CLOSE = 3;

/** Triangles whose centre falls inside `box`, counted by the role they draw in. */
function trianglesInside(baked: BakedGeometry, box: THREE.Box3): Record<string, number> {
  const geometry = meshFor(baked).geometry;
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex()!;
  const counts: Record<string, number> = {};
  const centre = new THREE.Vector3();
  const corner = new THREE.Vector3();
  for (const group of baked.groups)
    for (let at = group.start; at < group.start + group.count; at += 3) {
      centre.set(0, 0, 0);
      for (let vertex = 0; vertex < 3; vertex++)
        centre.add(corner.fromBufferAttribute(position, index.getX(at + vertex)));
      if (box.containsPoint(centre.divideScalar(3)))
        counts[group.role] = (counts[group.role] ?? 0) + 1;
    }
  return counts;
}

describe("baked Kel2020 geometry", () => {
  it("stands the blower in one cell with its port on the boundary", () => {
    const box = boxOf(KEL2020_BLOWER);
    // Local +X is the direction the blower faces, so the port is at the cell
    // face the tube leaves from and the unit fills the cell behind it.
    expect(box.max.x).toBeCloseTo(0.5, CLOSE);
    expect(box.min.x).toBeCloseTo(-0.5, CLOSE);
    // Across its axis the real unit is a 6 in drum, well inside the cell.
    for (const axis of ["y", "z"] as const) {
      expect(box.min[axis]).toBeGreaterThan(-0.5);
      expect(box.max[axis]).toBeLessThan(0.5);
    }
  });

  it("runs the terminal between the two ports the tubes are drawn to", () => {
    const box = boxOf(KEL2020_TERMINAL);
    expect(box.min.y).toBeCloseTo(-0.45, CLOSE);
    expect(box.max.y).toBeCloseTo(1.45, CLOSE);
    for (const axis of ["x", "z"] as const) {
      expect(box.min[axis]).toBeGreaterThan(-0.5);
      expect(box.max[axis]).toBeLessThan(0.5);
    }
  });

  it("keeps both units centred on the cell across their axis", () => {
    for (const baked of [KEL2020_BLOWER, KEL2020_TERMINAL]) {
      const box = boxOf(baked);
      for (const axis of baked === KEL2020_BLOWER ? ["y", "z"] : ["x", "z"]) {
        const at = axis as "x" | "y" | "z";
        expect(box.min[at] + box.max[at]).toBeCloseTo(0, CLOSE);
      }
    }
  });

  it("draws every triangle exactly once, in one material per role", () => {
    for (const baked of [KEL2020_BLOWER, KEL2020_TERMINAL]) {
      const mesh = meshFor(baked);
      const index = mesh.geometry.getIndex()!;
      const covered = baked.groups.reduce((total, group) => total + group.count, 0);
      expect(covered).toBe(index.count);
      // Groups are contiguous and in order, so the buffer has no gaps either.
      let at = 0;
      for (const group of baked.groups) {
        expect(group.start).toBe(at);
        at += group.count;
      }
      const roles = new Set<BakedRole>(baked.groups.map((group) => group.role));
      expect((mesh.material as THREE.Material[]).length).toBe(roles.size);
      expect(mesh.geometry.getAttribute("position").count).toBe(baked.vertexCount);
      expect(mesh.geometry.getAttribute("normal").count).toBe(baked.vertexCount);
    }
  });

  it("drops a cut's faces and leaves the rest of the part whole", () => {
    // The cut is how a face the bake could not tell apart from its neighbours
    // stops being drawn — the lettering moulded into the terminal's housing,
    // which a decal now covers (ADR-0050). Whatever it picks, the part must
    // still draw every other triangle it had, exactly once, in contiguous
    // groups, and no triangle twice.
    const cut: BakedCut = {
      from: "body",
      // The top half of the unit, which cuts across the housing's faces.
      pick: ({ positions, index, faces }) =>
        new Set(
          faces.filter((face) =>
            [0, 1, 2].every((corner) => positions[index[face + corner] * 3 + 1] > 0.5)
          )
        )
    };
    const plain = drawnGeometry(KEL2020_TERMINAL);
    const drawn = drawnGeometry(KEL2020_TERMINAL, cut);
    expect(drawn.index.length).toBeGreaterThan(0);
    expect(drawn.index.length).toBeLessThan(plain.index.length);
    // Exactly the triangles the rule picked are gone, and every other one is
    // still there, in the order it was in. Built from the plain buffer rather
    // than compared as a set, because the bake repeats a few triangles and a
    // set would quietly swallow one of them going missing.
    const positions = meshFor(KEL2020_TERMINAL).geometry.getAttribute("position");
    const expected: number[] = [];
    for (const group of KEL2020_TERMINAL.groups)
      for (let face = group.start; face < group.start + group.count; face += 3) {
        const high = [0, 1, 2].every((corner) => positions.getY(plain.index[face + corner]) > 0.5);
        if (group.role === "body" && high) continue;
        expected.push(plain.index[face], plain.index[face + 1], plain.index[face + 2]);
      }
    expect([...drawn.index]).toEqual(expected);
    let at = 0;
    for (const group of drawn.groups) {
      expect(group.start).toBe(at);
      at += group.count;
    }
    expect(at).toBe(drawn.index.length);
    // Still one material per role, and no role gained or lost.
    const roles = new Set(drawn.groups.map((group) => group.role));
    expect(roles).toEqual(new Set(KEL2020_TERMINAL.groups.map((group) => group.role)));
    const mesh = buildBakedMesh(KEL2020_TERMINAL, () => new THREE.MeshBasicMaterial(), cut);
    expect((mesh.material as THREE.Material[]).length).toBe(roles.size);
  });

  it("draws the terminal's moulded lettering in the housing, not the dark hardware", () => {
    // KEL2020 is moulded into the terminal's housing as a solid per character,
    // and the CAD finishes one of them — the first 0 of 2020 — in the colour the
    // latch and collars wear. Drawn as hardware it came out opaque near-black on
    // a translucent housing and stopped reading as a letter: the client saw "a
    // weird black circle that looks like an artifact" (Trello OdRGBlxB). The
    // bake corrects it by where it sits, so this holds across a re-bake.
    const lettering = new THREE.Box3(
      new THREE.Vector3(-0.22, 0.76, 0.06),
      new THREE.Vector3(0.18, 0.87, 0.23)
    );
    const counts = trianglesInside(KEL2020_TERMINAL, lettering);
    expect(counts.trim ?? 0).toBe(0);
    expect(counts.body ?? 0).toBeGreaterThan(0);
  });

  it("decodes once and hands out a fresh geometry each time, so disposal is safe", () => {
    const first = meshFor(KEL2020_BLOWER);
    const second = meshFor(KEL2020_BLOWER);
    expect(second.geometry).not.toBe(first.geometry);
    // The decoded buffers are shared, which is what makes rebuilding the ghost
    // on every hovered cell cheap.
    expect(second.geometry.getAttribute("position").array).toBe(
      first.geometry.getAttribute("position").array
    );
    first.geometry.dispose();
    expect(second.geometry.getAttribute("position").count).toBe(KEL2020_BLOWER.vertexCount);
  });
});
