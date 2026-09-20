import { partRegistry, type PartRegistry } from "@/domain/part-registry";
import { terminalPortAnchor } from "@/domain/terminal";
import type { DesignState, Part, Vec3 } from "@/types";
import { cellAt, cellKey, dirOf, vAdd, vEq, vNeg, vSub } from "@/domain/vec3";

export type PortOwnerType = "blower" | "terminal" | "tube" | "bend";

export type Port = {
  partId: string;
  ownerType: PortOwnerType;
  index: number;
  from: Vec3;
  cell: Vec3;
  dir: Vec3;
};

function portKey(p: Port): string {
  return `${p.partId}:${p.index}`;
}

function catalogKey(part: Part): string {
  if (part.type === "tube") return "tube6";
  if (part.type === "bend") return "bend90";
  return part.type;
}

function assertCatalogPortCount(part: Part, ports: Port[], registry: PartRegistry): void {
  const expected = registry.get(catalogKey(part)).ports;
  if (typeof expected === "number" && ports.length !== expected) {
    throw new Error(
      `Topology: ${part.type} "${part.id}" computed ${ports.length} ports, expected ${expected}`
    );
  }
}

export function computePartPorts(part: Part, registry: PartRegistry = partRegistry): Port[] {
  let ports: Port[];
  switch (part.type) {
    case "blower": {
      const from = cellAt(part.cell);
      const dir = part.dir;
      ports = [
        { partId: part.id, ownerType: "blower", index: 0, from, cell: vAdd(from, dir), dir }
      ];
      break;
    }
    case "terminal": {
      // Each port leaves from the end of the 2 ft body it sits on, so one of
      // the two starts a foot along the body from the cell the terminal was
      // placed in — above it standing up, beside it lying down. See terminal.ts.
      const cell = cellAt(part.cell);
      const axis = part.axis;
      const back = vNeg(axis);
      const front = terminalPortAnchor(cell, axis, axis);
      const rear = terminalPortAnchor(cell, back, axis);
      ports = [
        {
          partId: part.id,
          ownerType: "terminal",
          index: 0,
          from: front,
          cell: vAdd(front, axis),
          dir: axis
        },
        {
          partId: part.id,
          ownerType: "terminal",
          index: 1,
          from: rear,
          cell: vAdd(rear, back),
          dir: back
        }
      ];
      break;
    }
    case "tube": {
      const d = dirOf(part.from, part.to);
      const firstCell = cellAt(part.from);
      const toCell = cellAt(part.to);
      const lastCell = vSub(toCell, d);
      ports = [
        {
          partId: part.id,
          ownerType: "tube",
          index: 0,
          from: firstCell,
          cell: vSub(firstCell, d),
          dir: vNeg(d)
        },
        {
          partId: part.id,
          ownerType: "tube",
          index: 1,
          from: lastCell,
          cell: toCell,
          dir: d
        }
      ];
      break;
    }
    case "bend": {
      const entryFrom = cellAt(part.entry);
      const exitCell = cellAt(part.exit);
      ports = [
        {
          partId: part.id,
          ownerType: "bend",
          index: 0,
          from: entryFrom,
          cell: vSub(entryFrom, part.inDir),
          dir: vNeg(part.inDir)
        },
        {
          partId: part.id,
          ownerType: "bend",
          index: 1,
          from: exitCell,
          cell: vAdd(exitCell, part.outDir),
          dir: part.outDir
        }
      ];
      break;
    }
  }
  assertCatalogPortCount(part, ports, registry);
  return ports;
}

/**
 * Which ports are joined to another, and which parts those joins group into
 * runs.
 *
 * The runs come out of the same pass because they are the same relation seen
 * from the other side: two parts are on one run exactly when a chain of joined
 * ports leads from one to the other. Callers that need to know whether two open
 * ports face each other across a gap — or are already two ends of the same
 * piece of pipework — need both.
 */
function computeTopologyRelations(ports: Port[]): {
  connected: Set<string>;
  runByPart: Map<string, string>;
} {
  const connected = new Set<string>();
  const parent = new Map<string, string>();

  const find = (id: string): string => {
    let root = parent.get(id) ?? id;
    while (root !== (parent.get(root) ?? root)) root = parent.get(root) ?? root;
    // Path compression, so a long run does not walk its whole length per query.
    let cursor = id;
    while (cursor !== root) {
      const next = parent.get(cursor) ?? cursor;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  const byFrom = new Map<string, Port[]>();
  for (const p of ports) {
    parent.set(p.partId, parent.get(p.partId) ?? p.partId);
    const k = cellKey(p.from);
    const arr = byFrom.get(k);
    if (arr) arr.push(p);
    else byFrom.set(k, [p]);
  }
  for (const a of ports) {
    if (connected.has(portKey(a))) continue;
    const candidates = byFrom.get(cellKey(a.cell));
    if (!candidates) continue;
    for (const b of candidates) {
      if (b.partId === a.partId) continue;
      if (connected.has(portKey(b))) continue;
      if (!vEq(b.cell, a.from)) continue;
      if (!vEq(b.dir, vNeg(a.dir))) continue;
      connected.add(portKey(a));
      connected.add(portKey(b));
      union(a.partId, b.partId);
      break;
    }
  }

  const runByPart = new Map<string, string>();
  for (const partId of parent.keys()) runByPart.set(partId, find(partId));
  return { connected, runByPart };
}

export class Topology {
  private readonly registry: PartRegistry;
  private readonly partPorts = new Map<string, Port[]>();
  private _ports: Port[] = [];
  private _connected = new Set<string>();
  private _runByPart = new Map<string, string>();

  constructor(items: readonly (Part | Port)[] = [], registry: PartRegistry = partRegistry) {
    this.registry = registry;
    for (const item of items) {
      if (isPart(item)) {
        this.partPorts.set(item.id, computePartPorts(item, this.registry));
      } else {
        const existing = this.partPorts.get(item.partId);
        if (existing) existing.push(item);
        else this.partPorts.set(item.partId, [item]);
      }
    }
    this.rebuild();
  }

  ports(): Port[] {
    return this._ports.slice();
  }

  isConnected(p: Port): boolean {
    return this._connected.has(portKey(p));
  }

  openPorts(): Port[] {
    return this._ports.filter((p) => !this._connected.has(portKey(p)));
  }

  openPortsNear(cell: Vec3): Port[] {
    return this.openPorts().filter((p) => vEq(p.cell, cell));
  }

  /**
   * The open ports a part standing in this cell's square offers from that
   * square or above it, nearest first.
   *
   * `openPortsNear` answers "is there a port whose landing cell is this one",
   * which needs the cursor already at the port's height. This answers the
   * question the cursor can ask from the floor: point at the square a blower
   * stands in and its open port is the one on offer, whether the blower sits on
   * the floor, up on an obstacle, or at the top of a riser five feet of tube
   * above it. The port is found by the cell it leaves *from* — the part's own
   * square — so a port facing sideways is offered from its owner's square just
   * as an upward one is.
   *
   * Only at or above the aimed cell: the placement plane is what the cursor
   * aims along, and a port below it belongs to something the pointer is already
   * past. That also leaves the elevation keys their say — raise the plane over
   * a part and the square is an ordinary one again.
   */
  openPortsInColumn(cell: Vec3): Port[] {
    return this.openPorts()
      .filter((p) => p.from[0] === cell[0] && p.from[2] === cell[2] && p.from[1] >= cell[1])
      .sort((a, b) => a.from[1] - b.from[1]);
  }

  /**
   * An identifier shared by every part reachable from this one through joined
   * ports. Two open ports with the same run are already two ends of the same
   * pipework, so joining them would close a loop rather than extend the system.
   */
  runOf(partId: string): string {
    return this._runByPart.get(partId) ?? partId;
  }

  private rebuild(): void {
    this._ports = [...this.partPorts.values()].flat();
    const relations = computeTopologyRelations(this._ports);
    this._connected = relations.connected;
    this._runByPart = relations.runByPart;
  }
}

export function computeTopology(design: DesignState): Topology {
  return new Topology(design.parts);
}

function isPart(value: Part | Port): value is Part {
  return "type" in value;
}
