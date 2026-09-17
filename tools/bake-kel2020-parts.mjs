/**
 * Turn the Kelly Tube Systems STEP files into the geometry the viewport draws.
 *
 *   pnpm add -D occt-import-js            # ~12 MB, LGPL, not shipped
 *   node tools/bake-kel2020-parts.mjs ~/kel2020-step
 *   pnpm remove occt-import-js && pnpm run format
 *
 * Run by hand when KTS ships new CAD, never by the build: the STEP files are
 * not in the repository (they are a 10 MB drop from the client), and the
 * importer that reads them is a large LGPL dependency the app does not ship.
 * What the app ships is the file this writes. See ADR-0033.
 *
 * The two files this expects, both from the 2026-09-10 KTS drop:
 *   A444200 4 Inch Blower Assy for KEL2020 3D.step
 *   A444940 3D 4 Inch  Terminal.Body Fabrication For KEL2020 Assy DC.step
 */

import fs from "node:fs";
import path from "node:path";

let occtimportjs;
try {
  ({ default: occtimportjs } = await import("occt-import-js"));
} catch {
  console.error(
    "This script needs occt-import-js, which is deliberately not a dependency of\n" +
      "this repository. Install it for the run and remove it afterwards:\n" +
      "  pnpm add -D occt-import-js\n" +
      "  node tools/bake-kel2020-parts.mjs <step-directory>\n" +
      "  pnpm remove occt-import-js"
  );
  process.exit(1);
}

const IN_PER_FT = 12;
const MM_PER_IN = 25.4;

/**
 * How fine to tessellate, in millimetres of sag and radians between adjacent
 * facets. The angular figure is what decides a cylinder: 0.5 rad gives a barrel
 * about as many segments as the hand-built one it replaces had.
 */
const TESSELLATION = { linearDeflection: 1.5, angularDeflection: 0.5 };

/**
 * How far apart two vertices have to be, in feet, before decimation keeps both.
 * 0.018 ft is a fifth of an inch at part scale — under a pixel wherever a part
 * is actually looked at, and it is what takes the terminal from twenty thousand
 * triangles to seven.
 */
const DECIMATION_CELL_FT = 0.018;

/**
 * Fasteners and threads the CAD models in full. One 3/4 inch screw in the
 * terminal costs more triangles than the carrier barrel it holds, and it is
 * never more than a pixel or two across, so anything smaller than this goes.
 */
const MIN_FEATURE_IN = 0.8;

/**
 * Which file, which node inside it, and how the CAD's own axes sit in the frame
 * the renderer builds each part in. `axes` names the CAD axis that becomes the
 * part's local X, Y and Z, and `along` names the local axis the unit's ports run
 * down — the one it is measured and scaled along.
 */
const PARTS = {
  blower: {
    file: "A444200 4 Inch Blower Assy for KEL2020 3D.step",
    node: "Blower Assy",
    // CAD +Z is the port axis, and the renderer's local +X is the direction a
    // blower faces, so the unit stands on its local -X face.
    axes: ["z", "x", "y"],
    along: 0,
    // One cell long, with the port at the boundary the tube leaves from.
    spanFeet: 1,
    spanEnd: 0.5
  },
  terminal: {
    file: "A444940 3D 4 Inch  Terminal.Body Fabrication For KEL2020 Assy DC.step",
    node: null,
    // The carrier barrel runs up CAD +Z onto the local +Y the body lies along,
    // and the white front of the fabrication faces CAD -Y, which is the local
    // +Z a carrier is loaded from.
    axes: ["x", "z", "-y"],
    along: 1,
    // Two cells of body between the port faces, where the tubes leaving a
    // terminal already meet it.
    spanFeet: 1.9,
    spanEnd: 1.45
  }
};

const occt = await occtimportjs();

/** Tessellate one file and return every mesh under `node`, in millimetres. */
function readStep(file, node) {
  const result = occt.ReadStepFile(new Uint8Array(fs.readFileSync(file)), {
    linearUnit: "millimeter",
    linearDeflectionType: "absolute_value",
    ...TESSELLATION
  });
  if (!result.success) throw new Error(`could not read ${file}`);
  const named = (n) => {
    if (n.name === node) return n;
    for (const child of n.children ?? []) {
      const found = named(child);
      if (found) return found;
    }
    return null;
  };
  const root = node ? named(result.root) : result.root;
  if (!root) throw new Error(`no node named ${node} in ${file}`);
  const indices = [];
  const collect = (n) => {
    indices.push(...(n.meshes ?? []));
    for (const child of n.children ?? []) collect(child);
  };
  collect(root);
  return indices.map((i) => {
    const mesh = result.meshes[i];
    return {
      position: mesh.attributes.position.array,
      normal: mesh.attributes.normal.array,
      index: mesh.index.array,
      colour: mesh.color ?? null,
      bbox: bboxOf(mesh.attributes.position.array)
    };
  });
}

function bboxOf(position) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.length; i += 3)
    for (let axis = 0; axis < 3; axis++) {
      box[axis] = Math.min(box[axis], position[i + axis]);
      box[axis + 3] = Math.max(box[axis + 3], position[i + axis]);
    }
  return box;
}

const sizeOf = (b) => [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
const centreOf = (b) => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
const volumeOf = (b) => sizeOf(b).reduce((v, s) => v * Math.max(s, 0.01), 1);
const unionOf = (boxes) =>
  boxes.reduce((u, b) => [
    Math.min(u[0], b[0]),
    Math.min(u[1], b[1]),
    Math.min(u[2], b[2]),
    Math.max(u[3], b[3]),
    Math.max(u[4], b[4]),
    Math.max(u[5], b[5])
  ]);

/**
 * The blower file carries the unit's power cord and plug, drawn trailing thirty
 * feet away from it. The app has no cord, and keeping it would leave the blower
 * itself a third of its cell, so everything whose centre falls outside the
 * body's own footprint goes.
 */
function keepBodyOnly(meshes) {
  const body = meshes.reduce((a, b) => (volumeOf(a.bbox) >= volumeOf(b.bbox) ? a : b));
  const [cx, cy] = centreOf(body.bbox);
  const [sx, sy] = sizeOf(body.bbox);
  const radius = Math.max(sx, sy) / 2;
  return meshes.filter((mesh) => {
    const [mx, my] = centreOf(mesh.bbox);
    return Math.hypot(mx - cx, my - cy) <= radius;
  });
}

/**
 * The terminal file carries its DC supply as a second box standing clear of the
 * unit. Keep the group of touching parts that the tallest mesh — the carrier
 * barrel, which runs the whole height — belongs to.
 */
function keepBarrelAssembly(meshes) {
  const parent = meshes.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  // Millimetres: parts that touch in the CAD can round apart in the mesh.
  const PAD = 2;
  const touching = (a, b) =>
    a.bbox[0] - PAD <= b.bbox[3] &&
    b.bbox[0] - PAD <= a.bbox[3] &&
    a.bbox[1] - PAD <= b.bbox[4] &&
    b.bbox[1] - PAD <= a.bbox[4] &&
    a.bbox[2] - PAD <= b.bbox[5] &&
    b.bbox[2] - PAD <= a.bbox[5];
  for (let i = 0; i < meshes.length; i++)
    for (let j = i + 1; j < meshes.length; j++)
      if (touching(meshes[i], meshes[j])) parent[find(i)] = find(j);
  const tallest = meshes.reduce(
    (best, m, i) => (sizeOf(m.bbox)[2] > sizeOf(meshes[best].bbox)[2] ? i : best),
    0
  );
  const keep = find(tallest);
  return meshes.filter((_, i) => find(i) === keep);
}

function dropFasteners(meshes) {
  return meshes.filter((m) => Math.hypot(...sizeOf(m.bbox)) / MM_PER_IN >= MIN_FEATURE_IN);
}

/** The clear carrier tube: the tallest mesh, which runs the unit's full height. */
const findBarrel = (meshes) =>
  meshes.reduce((a, b) => (sizeOf(a.bbox)[2] >= sizeOf(b.bbox)[2] ? a : b));

/**
 * Which of the viewport's materials a CAD face is drawn in. The palette stays
 * the app's — ADR-0026 picked it so near-black hardware reads against a
 * near-black floor — and the CAD's own colours only say which role a face plays.
 */
function roleOf(mesh, barrel) {
  if (mesh === barrel) return "glass";
  if (!mesh.colour) return "body";
  const [r, g, b] = mesh.colour;
  if (r > 0.6 && g > 0.5 && b < g * 0.7) return "door";
  if (0.299 * r + 0.587 * g + 0.114 * b < 0.35) return "trim";
  return "body";
}

/**
 * Where the CAD's own colours say the wrong thing, as boxes in the part's own
 * frame, in feet.
 *
 * The terminal's moulded KEL2020 lettering is a solid per character raised off
 * the housing, and the STEP finishes one of them — the first 0 of 2020 — in the
 * dark colour the latch and the collars wear. `roleOf` reads colour, so that one
 * character came out opaque near-black against a translucent housing and
 * stopped reading as a letter at all: the client saw "a weird black circle that
 * looks like an artifact" (Trello OdRGBlxB). The lettering is moulded into the
 * housing, so all seven characters belong in the housing's material.
 *
 * Nothing in the file tells a character from a fitting except where it sits,
 * which is why this is a box and not another rule in `roleOf`. The numbers are
 * measured off the geometry the app already ships, and only a mesh that fits
 * inside one is corrected — the housing and the full-height trim rail run
 * straight through this box and are left alone.
 */
const ROLE_CORRECTIONS = {
  terminal: [{ role: "body", box: [-0.22, 0.76, 0.06, 0.18, 0.87, 0.23] }]
};

/** `bbox`, which is in CAD millimetres, as a box in the part's own frame. */
const localBox = (bbox, picks, toFeet, offset) => {
  const ends = picks.map(({ index, sign }, local) => [
    bbox[index] * sign * toFeet + offset[local],
    bbox[index + 3] * sign * toFeet + offset[local]
  ]);
  return [...ends.map((e) => Math.min(...e)), ...ends.map((e) => Math.max(...e))];
};

const inside = (box, outer) =>
  [0, 1, 2].every((a) => box[a] >= outer[a] && box[a + 3] <= outer[a + 3]);

const AXIS_INDEX = { x: 0, y: 1, z: 2 };
const axisPicker = (spec) =>
  spec.map((s) => ({ index: AXIS_INDEX[s.replace("-", "")], sign: s.startsWith("-") ? -1 : 1 }));

/**
 * Vertex-cluster decimation. Snap vertices to a grid, keep separate clusters for
 * separate facing directions so creases survive, and drop the triangles that
 * collapse. What goes first is the holes, bosses and fillets of the sheet-metal
 * fabrications, which is exactly where the triangles are.
 */
function decimate({ position, normal, index }) {
  const slots = new Map();
  const remap = new Int32Array(position.length / 3);
  const outPosition = [];
  const outNormal = [];
  const counts = [];
  for (let v = 0; v < remap.length; v++) {
    const key = [0, 1, 2]
      .map((a) => Math.round(position[v * 3 + a] / DECIMATION_CELL_FT))
      .concat([0, 1, 2].map((a) => Math.round(normal[v * 3 + a] * 2)))
      .join(",");
    let slot = slots.get(key);
    if (slot === undefined) {
      slot = counts.length;
      slots.set(key, slot);
      outPosition.push(0, 0, 0);
      outNormal.push(0, 0, 0);
      counts.push(0);
    }
    for (let a = 0; a < 3; a++) {
      outPosition[slot * 3 + a] += position[v * 3 + a];
      outNormal[slot * 3 + a] += normal[v * 3 + a];
    }
    counts[slot]++;
    remap[v] = slot;
  }
  for (let slot = 0; slot < counts.length; slot++) {
    for (let a = 0; a < 3; a++) outPosition[slot * 3 + a] /= counts[slot];
    const length =
      Math.hypot(outNormal[slot * 3], outNormal[slot * 3 + 1], outNormal[slot * 3 + 2]) || 1;
    for (let a = 0; a < 3; a++) outNormal[slot * 3 + a] /= length;
  }
  const outIndex = [];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [remap[index[t]], remap[index[t + 1]], remap[index[t + 2]]];
    if (a !== b && b !== c && a !== c) outIndex.push(a, b, c);
  }
  return { position: outPosition, normal: outNormal, index: outIndex };
}

/** Read one part out of its STEP file and into the renderer's frame, in feet. */
function bake(name, directory) {
  const spec = PARTS[name];
  let meshes = readStep(path.join(directory, spec.file), spec.node);
  meshes = name === "blower" ? keepBodyOnly(meshes) : keepBarrelAssembly(meshes);
  meshes = dropFasteners(meshes);
  const barrel = name === "terminal" ? findBarrel(meshes) : null;

  const cadBox = unionOf(meshes.map((m) => m.bbox));
  const picks = axisPicker(spec.axes);
  const along = picks[spec.along];
  const scale = (spec.spanFeet * MM_PER_IN * IN_PER_FT) / sizeOf(cadBox)[along.index];
  const toFeet = scale / (MM_PER_IN * IN_PER_FT);
  const cadCentre = centreOf(cadBox);
  // The port end lands where the tube meets it; the other two axes are centred
  // on the cell, which is where a unit that occupies a cell belongs.
  const offset = picks.map((pick, local) => {
    if (local !== spec.along) return -cadCentre[pick.index] * pick.sign * toFeet;
    const end = along.sign > 0 ? cadBox[along.index + 3] : cadBox[along.index];
    return spec.spanEnd - end * along.sign * toFeet;
  });

  const corrections = ROLE_CORRECTIONS[name] ?? [];
  const byRole = new Map();
  for (const mesh of meshes) {
    const box = localBox(mesh.bbox, picks, toFeet, offset);
    const correction = corrections.find((c) => inside(box, c.box));
    const role = correction ? correction.role : roleOf(mesh, barrel);
    if (!byRole.has(role)) byRole.set(role, { position: [], normal: [], index: [] });
    const out = byRole.get(role);
    const base = out.position.length / 3;
    for (let i = 0; i < mesh.position.length; i += 3)
      for (let local = 0; local < 3; local++) {
        const { index, sign } = picks[local];
        out.position.push(mesh.position[i + index] * sign * toFeet + offset[local]);
        out.normal.push(mesh.normal[i + index] * sign);
      }
    for (const v of mesh.index) out.index.push(base + v);
  }
  return {
    scale,
    cadSizeIn: sizeOf(cadBox).map((v) => v / MM_PER_IN),
    roles: [...byRole.entries()].map(([role, geometry]) => ({ role, ...decimate(geometry) }))
  };
}

/**
 * One interleaved buffer per part: positions quantised to 16 bits across the
 * part's own box, normals to a signed byte each, and a group per material role.
 * A fifth of a millimetre of position error at part scale is invisible, and it
 * is the difference between a file the app can carry and one it cannot.
 */
function encode(part) {
  const position = part.roles.flatMap((r) => r.position);
  const min = [0, 1, 2].map((a) => Math.min(...position.filter((_, i) => i % 3 === a)));
  const max = [0, 1, 2].map((a) => Math.max(...position.filter((_, i) => i % 3 === a)));
  const span = min.map((lo, a) => Math.max(max[a] - lo, 1e-6));
  const vertexCount = position.length / 3;
  const quantised = new Uint16Array(position.length);
  const normals = new Int8Array(position.length);
  const indices = [];
  const groups = [];
  let vertexBase = 0;
  let cursor = 0;
  for (const role of part.roles) {
    for (let v = 0; v < role.position.length / 3; v++)
      for (let a = 0; a < 3; a++) {
        const at = (vertexBase + v) * 3 + a;
        quantised[at] = Math.round(((role.position[v * 3 + a] - min[a]) / span[a]) * 65535);
        normals[at] = Math.max(-127, Math.min(127, Math.round(role.normal[v * 3 + a] * 127)));
      }
    groups.push({ role: role.role, start: cursor, count: role.index.length });
    for (const i of role.index) indices.push(vertexBase + i);
    cursor += role.index.length;
    vertexBase += role.position.length / 3;
  }
  if (vertexCount > 65535) throw new Error("too many vertices for 16-bit indices");
  const base64 = (view) =>
    Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString("base64");
  return {
    min,
    max,
    vertexCount,
    triangleCount: indices.length / 3,
    groups,
    position: base64(quantised),
    normal: base64(normals),
    index: base64(new Uint16Array(indices))
  };
}

const directory = process.argv[2];
if (!directory) {
  console.error("usage: node tools/bake-kel2020-parts.mjs <step-directory>");
  process.exit(1);
}

const baked = {};
for (const name of Object.keys(PARTS)) {
  const part = bake(name, directory);
  baked[name] = { source: PARTS[name].file, ...encode(part) };
  console.log(
    `${name}: ${baked[name].triangleCount} triangles, ${baked[name].vertexCount} vertices,` +
      ` CAD ${part.cadSizeIn.map((v) => v.toFixed(2)).join(" x ")} in, scaled ${part.scale.toFixed(4)}`
  );
}

const literal = (part) =>
  `{
  source: ${JSON.stringify(part.source)},
  min: [${part.min.map((v) => v.toFixed(6)).join(", ")}],
  max: [${part.max.map((v) => v.toFixed(6)).join(", ")}],
  vertexCount: ${part.vertexCount},
  groups: [
${part.groups.map((g) => `    { role: ${JSON.stringify(g.role)}, start: ${g.start}, count: ${g.count} }`).join(",\n")}
  ],
  position:
    "${part.position}",
  normal:
    "${part.normal}",
  index:
    "${part.index}"
}`;

const out = `// Generated by tools/bake-kel2020-parts.mjs from the Kelly Tube Systems STEP
// files. Do not edit by hand: re-run the bake instead. See ADR-0033.
import type { BakedGeometry } from "@/renderer/baked-geometry";

export const KEL2020_BLOWER: BakedGeometry = ${literal(baked.blower)};

export const KEL2020_TERMINAL: BakedGeometry = ${literal(baked.terminal)};
`;
const target = path.join(process.cwd(), "src/data/kel2020-geometry.ts");
fs.writeFileSync(target, out);
console.log(`wrote ${target} (${(fs.statSync(target).size / 1024).toFixed(0)} KB)`);
