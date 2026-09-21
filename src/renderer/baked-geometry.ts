import * as THREE from "three";

/**
 * The Kel2020 blower and terminal are the real Kelly Tube Systems CAD, not
 * shapes drawn by eye (ADR-0033). Their geometry is too large to keep as plain
 * numbers, so `tools/bake-kel2020-parts.mjs` writes it quantised and base64'd
 * into src/data/kel2020-geometry.ts and this module reads it back.
 *
 * Positions are 16 bits per axis across the part's own box — about a
 * fiftieth of an inch at part scale, well under a pixel wherever a part is
 * looked at — and normals are a signed byte each, which Three.js consumes
 * directly as a normalized attribute.
 */

/** The viewport materials a baked face can be drawn in. */
export type BakedRole = "body" | "trim" | "door" | "glass";

/** One run of the index buffer, drawn in one material. */
export type BakedGroup = { role: BakedRole; start: number; count: number };

export type BakedGeometry = {
  /** The STEP file this came out of, for tracing a shape back to its source. */
  source: string;
  /** The box the positions are quantised across, in feet, in the part's frame. */
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  vertexCount: number;
  /** One run of the index buffer per material role, in draw order. */
  groups: readonly BakedGroup[];
  /** Base64: three Uint16 per vertex, three Int8 per vertex, Uint16 indices. */
  position: string;
  normal: string;
  index: string;
};

/** The triangles of the role a cut takes from, for `BakedCut.pick`. */
export type CutFaces = {
  /** Every vertex of the part, in its own frame: x, y, z per vertex. */
  positions: Float32Array;
  /** The part's index buffer. A face is `index[face]`, `+ 1` and `+ 2`. */
  index: Uint16Array;
  /** Where each of the role's faces starts in `index`. */
  faces: readonly number[];
};

/**
 * Faces the bake could not tell apart from the rest of their role, taken out of
 * it and left undrawn.
 *
 * The bake classifies a face by the colour the CAD gives it (ADR-0033), which
 * is all the STEP files say: the KEL2020 lettering moulded into the terminal's
 * housing is the same plastic as the housing and arrives in the same group.
 * Rather than a second bake with hand-edited roles — the data file is
 * generated, and re-running the bake needs STEP files that are not in the
 * repository — the cut names the faces by the shape they make, which is a
 * property of the part rather than of this particular bake.
 */
export type BakedCut = {
  /** The role the faces are taken out of. */
  from: BakedRole;
  /**
   * Which of those faces to drop, as the offsets handed in.
   *
   * The whole role at once rather than one triangle at a time, because what
   * separates the terminal's lettering from its housing is that the lettering's
   * triangles join up into pieces of their own, and no single triangle can see
   * that (ADR-0042). Called once per part per cut, behind the cache below.
   */
  pick: (role: CutFaces) => ReadonlySet<number>;
};

function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type Decoded = { position: Float32Array; normal: Int8Array; index: Uint16Array };

/**
 * Decoding is per part, not per mesh: a blower's geometry is the same whichever
 * cell it stands in, and the ghost rebuilds on every cell the cursor crosses.
 * The buffers are shared; the BufferGeometry wrapped around them is not, because
 * `disposeObject` frees each mesh's geometry when the design changes.
 */
const decoded = new WeakMap<BakedGeometry, Decoded>();

function decode(baked: BakedGeometry): Decoded {
  const cached = decoded.get(baked);
  if (cached) return cached;
  const quantised = new Uint16Array(bytesOf(baked.position).buffer);
  const position = new Float32Array(baked.vertexCount * 3);
  for (let v = 0; v < baked.vertexCount; v++)
    for (let axis = 0; axis < 3; axis++) {
      const span = baked.max[axis] - baked.min[axis];
      position[v * 3 + axis] = baked.min[axis] + (quantised[v * 3 + axis] / 65535) * span;
    }
  const bytes = bytesOf(baked.normal);
  const fresh: Decoded = {
    position,
    normal: new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    index: new Uint16Array(bytesOf(baked.index).buffer)
  };
  decoded.set(baked, fresh);
  return fresh;
}

type Drawn = { index: Uint16Array; groups: readonly BakedGroup[] };

/**
 * The index buffer a cut rewrites, per cut, alongside the decoded one.
 *
 * A cut runs over every triangle of a group, so it is done once for the part
 * rather than once per mesh: the ghost rebuilds on each cell the cursor
 * crosses, and the buffer it hands out is the same one every time.
 */
const cutIndexes = new WeakMap<BakedGeometry, Map<BakedCut, Drawn>>();

/**
 * The index buffer and groups a mesh built from `baked` draws, with `cut`
 * applied: the picked faces left out of the group they came from.
 *
 * Only the index is rewritten. Positions and normals are untouched and stay
 * shared, so a cut costs one more index buffer for the part and nothing per
 * mesh.
 */
export function drawnGeometry(baked: BakedGeometry, cut?: BakedCut): Drawn {
  const { index } = decode(baked);
  if (!cut) return { index, groups: baked.groups };
  const forBaked = cutIndexes.get(baked) ?? new Map<BakedCut, Drawn>();
  cutIndexes.set(baked, forBaked);
  const cached = forBaked.get(cut);
  if (cached) return cached;

  const { position } = decode(baked);
  const out = new Uint16Array(index.length);
  const groups: BakedGroup[] = [];
  let at = 0;
  for (const group of baked.groups) {
    if (group.role !== cut.from) {
      out.set(index.subarray(group.start, group.start + group.count), at);
      groups.push({ role: group.role, start: at, count: group.count });
      at += group.count;
      continue;
    }
    const faces: number[] = [];
    for (let face = group.start; face < group.start + group.count; face += 3) faces.push(face);
    const dropped = cut.pick({ positions: position, index, faces });
    const kept = at;
    for (const face of faces) {
      if (dropped.has(face)) continue;
      out[at++] = index[face];
      out[at++] = index[face + 1];
      out[at++] = index[face + 2];
    }
    groups.push({ role: group.role, start: kept, count: at - kept });
  }
  const drawn: Drawn = { index: out.subarray(0, at), groups };
  forBaked.set(cut, drawn);
  return drawn;
}

/**
 * One geometry carrying every role as its own draw group, in the order
 * `drawnGeometry` lists them.
 */
function bakedBufferGeometry(baked: BakedGeometry, cut?: BakedCut): THREE.BufferGeometry {
  const { position, normal } = decode(baked);
  const { index, groups } = drawnGeometry(baked, cut);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  for (const group of groups) geometry.addGroup(group.start, group.count, 0);
  return geometry;
}

/**
 * The baked part as a mesh, drawn in the materials `materialFor` returns for
 * each role. Groups with the same role share one material so the scene does not
 * hold a second copy of it per part placed.
 */
export function buildBakedMesh(
  baked: BakedGeometry,
  materialFor: (role: BakedRole) => THREE.Material,
  cut?: BakedCut
): THREE.Mesh {
  const geometry = bakedBufferGeometry(baked, cut);
  const materials: THREE.Material[] = [];
  const byRole = new Map<BakedRole, number>();
  drawnGeometry(baked, cut).groups.forEach((group, at) => {
    let slot = byRole.get(group.role);
    if (slot === undefined) {
      slot = materials.length;
      byRole.set(group.role, slot);
      materials.push(materialFor(group.role));
    }
    geometry.groups[at].materialIndex = slot;
  });
  return new THREE.Mesh(geometry, materials);
}
