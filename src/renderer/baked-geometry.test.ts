import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { KEL2020_BLOWER, KEL2020_TERMINAL } from "@/data/kel2020-geometry";
import {
  buildBakedMesh,
  drawnGeometry,
  type BakedGeometry,
  type BakedRole,
  type BakedSplit
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

  it("moves a split's faces into their own group without losing or repeating one", () => {
    // The split is how a face the bake could not tell apart from its neighbours
    // gets its own material — the mark moulded into the terminal's housing
    // (ADR-0039). Whatever it picks, the part must still draw every triangle it
    // had, exactly once, in contiguous groups.
    const split: BakedSplit = {
      from: ["body"],
      to: "mark",
      // The top half of the unit, which cuts across the housing's faces.
      pick: (triangle) => triangle[1] > 0.5 && triangle[4] > 0.5 && triangle[7] > 0.5
    };
    const plain = drawnGeometry(KEL2020_TERMINAL);
    const drawn = drawnGeometry(KEL2020_TERMINAL, split);
    expect(drawn.index.length).toBe(plain.index.length);
    expect([...drawn.index].sort()).toEqual([...plain.index].sort());
    let at = 0;
    for (const group of drawn.groups) {
      expect(group.start).toBe(at);
      at += group.count;
    }
    expect(at).toBe(drawn.index.length);
    const marked = drawn.groups.filter((group) => group.role === "mark");
    expect(marked.reduce((total, group) => total + group.count, 0)).toBeGreaterThan(0);
    // One material for the new role, however many runs it ends up as.
    const roles = new Set(drawn.groups.map((group) => group.role));
    const mesh = buildBakedMesh(KEL2020_TERMINAL, () => new THREE.MeshBasicMaterial(), split);
    expect((mesh.material as THREE.Material[]).length).toBe(roles.size);
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
