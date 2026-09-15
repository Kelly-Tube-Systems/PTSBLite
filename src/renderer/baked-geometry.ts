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

export type BakedGeometry = {
  /** The STEP file this came out of, for tracing a shape back to its source. */
  source: string;
  /** The box the positions are quantised across, in feet, in the part's frame. */
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  vertexCount: number;
  /** One run of the index buffer per material role, in draw order. */
  groups: readonly { role: BakedRole; start: number; count: number }[];
  /** Base64: three Uint16 per vertex, three Int8 per vertex, Uint16 indices. */
  position: string;
  normal: string;
  index: string;
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

/**
 * One geometry carrying every role as its own draw group, in the order
 * `baked.groups` lists them.
 */
function bakedBufferGeometry(baked: BakedGeometry): THREE.BufferGeometry {
  const { position, normal, index } = decode(baked);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  for (const group of baked.groups) geometry.addGroup(group.start, group.count, 0);
  return geometry;
}

/**
 * The baked part as a mesh, drawn in the materials `materialFor` returns for
 * each role. Groups with the same role share one material so the scene does not
 * hold a second copy of it per part placed.
 */
export function buildBakedMesh(
  baked: BakedGeometry,
  materialFor: (role: BakedRole) => THREE.Material
): THREE.Mesh {
  const geometry = bakedBufferGeometry(baked);
  const materials: THREE.Material[] = [];
  const byRole = new Map<BakedRole, number>();
  baked.groups.forEach((group, at) => {
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
