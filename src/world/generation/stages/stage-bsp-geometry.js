/**
 * @file Structure-planning stage: binary space partitioning (the "BSP" geometry). Recursively splits
 * the map rectangle into leaf rooms — a "fully packed" building-like layout where every tile is a room
 * floor or a wall, with no leftover void. No tiles are written here; this stage plans, and `bspCarve`
 * realizes. `label`/`stairs`/`spawn`/`populate` consume its output through the same
 * `level:zones`/`level:rooms` contract the room-grid pipeline uses, so they work over BSP geometry
 * unchanged. See docs/design/map-generation.md.
 *
 * Model: a region is a tile-space rect {x,y,w,h} for a room's *outer* extent (wall ring inclusive).
 * `minRoomSize` is the wall-inclusive footprint (default 5 → a 5×5 room = 3×3 walkable).
 *
 * Two connection modes:
 *   - No halls (default): siblings overlap by 1 tile on their seam — that shared column/row is the
 *     wall. Splittable iff length ≥ 2·minRoom − 1. Connectivity is intrinsic to the tree: each internal
 *     node opens one non-corner door between a leaf of its left subtree and one of its right subtree. A
 *     full binary tree with n leaves has n−1 internal nodes, so this is a spanning tree over the rooms.
 *   - Halls: each split lays a `hallWidth`-wide corridor strip along its seam (splittable iff length ≥
 *     2·minRoom + hallWidth). Every leaf room gets one door onto its parent node's hall, and each node's
 *     hall links up to its parent node's hall (a corridor-wide, door-less opening). Where a split runs
 *     parallel to its parent's the child hall can't reach the parent hall directly; the room between
 *     them then becomes a pass-through (a second door). The tree leaves most abutting halls unjoined;
 *     `hallLoopChance` re-opens a fraction of those for loops. With `skipLeafHalls`, a terminal split
 *     drops its hall and becomes a shared-wall two-room *suite* (interior door + one door onto the
 *     hall), which thins out the corridors. All rooms end up on one connected interior hall network.
 *
 * Stage parameters (from the pipeline config, all optional):
 *   width, height  — full map dimensions in tiles, walls included (default 48 × 32). Ignored if bounds.
 *   bounds         — {x,y,w,h}: partition this sub-rectangle of an in-progress level (another stage may
 *                    have built an enclosing box). Defaults to the full map.
 *   minRoomSize    — wall-inclusive minimum room footprint (default 5).
 *   includeHalls   — lay corridors between rooms instead of shared-wall doors (default false).
 *   hallWidth      — corridor width when includeHalls (default 1; rarely > 2).
 *   hallLoopChance — probability each extra hall-to-hall adjacency (not in the spanning tree) is opened
 *                    for a loop (default 0.3). Hall mode only.
 *   skipLeafHalls  — make terminal splits shared-wall two-room suites instead of hall splits, for fewer
 *                    corridors (default false). Hall mode only.
 *
 * Blackboard outputs:
 *   level:zones     -> [{ id, cells: [[id,0]], rect:{x,y,w,h} (outer), labels:['room'] }]
 *   level:rooms     -> { "id,0": { x0,y0,x1,y1 } }   (floor interior, inclusive)
 *   level:adjacency -> [[idA,idB], …]   (idA < idB; leaves whose outer rects share a wall)
 *   level:links     -> [{ id, a, b }]   (room-to-room connections; sparse in hall mode — halls carry it)
 *   level:bsp       -> { bounds, outerWall, halls:[{x0,y0,x1,y1}],
 *                        connections:[{ gap:[x,y], tiles:[[x,y]…], door:boolean, rooms:number[] }] }
 */
import { LEVEL_BSP } from '../blackboard-keys.js';
import { appendZones } from '../zone-tiles.js';

const DEFAULTS = {
  width: 48,
  height: 32,
  minRoomSize: 5,
  includeHalls: false,
  hallWidth: 1,
  hallLoopChance: 0.3,
  skipLeafHalls: false,
};

/** All leaf nodes under `node`, in tree (left-to-right) order. */
function leavesOf(node, acc = []) {
  if (node.leaf) acc.push(node);
  else {
    leavesOf(node.left, acc);
    leavesOf(node.right, acc);
  }
  return acc;
}

/** All internal (non-leaf) nodes under `node`, pre-order. */
function internalsOf(node, acc = []) {
  if (!node.leaf) {
    acc.push(node);
    internalsOf(node.left, acc);
    internalsOf(node.right, acc);
  }
  return acc;
}

/** The floor interior of an outer rect: one tile in from its wall ring. */
const floorOf = (rect) => ({
  x0: rect.x + 1,
  y0: rect.y + 1,
  x1: rect.x + rect.w - 2,
  y1: rect.y + rect.h - 2,
});

// The floor of a hall strip. A vertical strip's side walls are the neighbouring rooms' walls (so all
// its columns are floor); only its two ends need walls. A horizontal strip is the transpose.
const hallFloor = (rect, vertical) =>
  vertical
    ? { x0: rect.x, y0: rect.y + 1, x1: rect.x + rect.w - 1, y1: rect.y + rect.h - 2 }
    : { x0: rect.x + 1, y0: rect.y, x1: rect.x + rect.w - 2, y1: rect.y + rect.h - 1 };

// True if two floor rects are separated by exactly one wall line and overlap along it — i.e. a single
// tile on that wall would join them.
function adjacent(a, b) {
  const yOverlap = Math.max(a.y0, b.y0) <= Math.min(a.y1, b.y1);
  const xOverlap = Math.max(a.x0, b.x0) <= Math.min(a.x1, b.x1);
  return (
    (yOverlap && (a.x1 + 2 === b.x0 || b.x1 + 2 === a.x0)) ||
    (xOverlap && (a.y1 + 2 === b.y0 || b.y1 + 2 === a.y0))
  );
}

// A run of `width` floor tiles along a wall, starting at a random offset that keeps the whole run
// strictly interior to the overlap (so it never touches a corner). `vertical` = the wall is a column
// at `fixed` and the run steps down y; otherwise it's a row and the run steps across x.
function runTiles(fixed, lo, hi, width, vertical, rng) {
  const w = Math.min(width, hi - lo + 1);
  const start = rng.intInclusive(lo, hi - w + 1);
  const tiles = [];
  for (let k = 0; k < w; k++) tiles.push(vertical ? [fixed, start + k] : [start + k, fixed]);
  return tiles;
}

// The floor tiles that join two adjacent floor rects across their shared wall: a single door tile
// (width 1) or a `width`-wide corridor opening. Assumes `adjacent(a, b)`; draws once from rng.
function opening(a, b, width, rng) {
  const yLo = Math.max(a.y0, b.y0);
  const yHi = Math.min(a.y1, b.y1);
  if (yLo <= yHi) {
    if (a.x1 + 2 === b.x0) return runTiles(a.x1 + 1, yLo, yHi, width, true, rng);
    if (b.x1 + 2 === a.x0) return runTiles(b.x1 + 1, yLo, yHi, width, true, rng);
  }
  const xLo = Math.max(a.x0, b.x0);
  const xHi = Math.min(a.x1, b.x1);
  if (a.y1 + 2 === b.y0) return runTiles(a.y1 + 1, xLo, xHi, width, false, rng);
  return runTiles(b.y1 + 1, xLo, xHi, width, false, rng);
}

// Builds a connection record. `tiles` are the floor tiles it carves; `gap` (the first) is where a door
// sits when door-eligible. Room doors are 1 wide; hall-to-hall openings match the corridor width.
function join(a, b, width, door, rooms, rng) {
  const tiles = opening(a, b, width, rng);
  return { gap: tiles[0], tiles, door, rooms };
}

const pairKey = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);

// Builds the partition recursion closure for the chosen mode. Leaf nodes carry their floor rect;
// internal nodes carry their split orientation, children, and (hall mode) their seam hall's floor. A
// `wallNode` is a hall-mode node whose seam is a shared wall instead of a hall (leaf-skip suites).
function makePartition(minRoom, hallWidth, halls, skipLeaf, rng) {
  const need = halls ? 2 * minRoom + hallWidth : 2 * minRoom - 1;
  // Below this length a hall-split would yield two rooms that can't split again — so with skipLeaf on
  // we drop the hall and make a shared-wall 2-room suite instead. (Both halves stay under `need`.)
  const suiteMax = 3 * minRoom + hallWidth - 1;
  const leaf = (rect) => ({ rect, leaf: true, floor: floorOf(rect) });
  const part = (rect) => {
    const { x, y, w, h } = rect;
    const canV = w >= need;
    const canH = h >= need;
    if (!canV && !canH) return leaf(rect);
    const vertical = canV && canH ? rng.nextInt(0, 2) === 0 : canV;

    if (halls && skipLeaf && (vertical ? w : h) < suiteMax) {
      // Suite: shared-wall split (like no-hall), both children terminal rooms — no hall.
      if (vertical) {
        const X = rng.intInclusive(x + minRoom - 1, x + w - minRoom);
        return {
          rect,
          vertical: true,
          wallNode: true,
          left: leaf({ x, y, w: X - x + 1, h }),
          right: leaf({ x: X, y, w: x + w - X, h }),
        };
      }
      const Y = rng.intInclusive(y + minRoom - 1, y + h - minRoom);
      return {
        rect,
        vertical: false,
        wallNode: true,
        left: leaf({ x, y, w, h: Y - y + 1 }),
        right: leaf({ x, y: Y, w, h: y + h - Y }),
      };
    }

    if (vertical && halls) {
      const wl = rng.intInclusive(minRoom, w - hallWidth - minRoom);
      const hall = hallFloor({ x: x + wl, y, w: hallWidth, h }, true);
      return {
        rect,
        vertical: true,
        hall,
        left: part({ x, y, w: wl, h }),
        right: part({ x: x + wl + hallWidth, y, w: w - wl - hallWidth, h }),
      };
    }
    if (vertical) {
      const X = rng.intInclusive(x + minRoom - 1, x + w - minRoom);
      return {
        rect,
        vertical: true,
        left: part({ x, y, w: X - x + 1, h }),
        right: part({ x: X, y, w: x + w - X, h }),
      };
    }
    if (halls) {
      const ht = rng.intInclusive(minRoom, h - hallWidth - minRoom);
      const hall = hallFloor({ x, y: y + ht, w, h: hallWidth }, false);
      return {
        rect,
        vertical: false,
        hall,
        left: part({ x, y, w, h: ht }),
        right: part({ x, y: y + ht + hallWidth, w, h: h - ht - hallWidth }),
      };
    }
    const Y = rng.intInclusive(y + minRoom - 1, y + h - minRoom);
    return {
      rect,
      vertical: false,
      left: part({ x, y, w, h: Y - y + 1 }),
      right: part({ x, y: Y, w, h: y + h - Y }),
    };
  };
  return part;
}

/** Sets `.parent` on every node (root's is null) so leaves/halls can find their enclosing hall. */
function linkParents(node, parent) {
  node.parent = parent;
  if (!node.leaf) {
    linkParents(node.left, node);
    linkParents(node.right, node);
  }
}

// No-hall connectivity: one door per internal node, between an adjacent leaf pair straddling its seam.
function noHallConnections(internals, rng) {
  const connections = [];
  for (const node of internals) {
    const pairs = [];
    for (const a of leavesOf(node.left))
      for (const b of leavesOf(node.right)) if (adjacent(a.floor, b.floor)) pairs.push([a, b]);
    if (pairs.length === 0) {
      console.warn('[bspGeometry] no adjacent leaf pair across a seam; rooms left unconnected');
      continue;
    }
    const [a, b] = rng.pick(pairs);
    connections.push(join(a.floor, b.floor, 1, true, [a.id, b.id], rng));
  }
  return connections;
}

// Hall connectivity, as a spanning tree over rooms + halls:
//   - every room doors onto its parent node's hall (a suite's two rooms instead share a door, and the
//     suite gets a single door onto the hall — see wallNode below);
//   - every non-root hall node links its subtree up to its parent hall, via an adjacent descendant
//     hall (a corridor-wide, door-less opening) when one reaches, else a pass-through room (a door).
// Then `hallLoopChance` re-opens a fraction of the hall adjacencies the tree left walled, for loops.
function hallConnections(leaves, internals, hallWidth, hallLoopChance, rng) {
  internals.forEach((n, i) => {
    n.hid = i;
  });
  const connections = [];
  const linked = new Set(); // hid pairs already joined hall-to-hall (so loops don't re-open them)

  for (const room of leaves) {
    if (!room.parent.hall) continue; // suite room — its doors come from the wallNode below
    connections.push(join(room.floor, room.parent.hall, 1, true, [room.id], rng));
  }

  for (const node of internals) {
    if (node.wallNode) {
      const [r1, r2] = [node.left, node.right];
      connections.push(join(r1.floor, r2.floor, 1, true, [r1.id, r2.id], rng)); // interior suite door
      if (node.parent?.hall) {
        const hp = node.parent.hall;
        const entry = adjacent(r1.floor, hp) ? r1 : r2; // single-entry: one door onto the hall
        connections.push(join(entry.floor, hp, 1, true, [entry.id], rng));
      }
      continue;
    }
    if (!node.parent) continue;
    const parentHall = node.parent.hall;
    const halls = internalsOf(node).filter((n) => n.hall && adjacent(n.hall, parentHall));
    if (halls.length > 0) {
      const hall = rng.pick(halls);
      connections.push(join(hall.hall, parentHall, hallWidth, false, [], rng));
      linked.add(pairKey(hall.hid, node.parent.hid));
      continue;
    }
    const rooms = leavesOf(node).filter((r) => adjacent(r.floor, parentHall));
    if (rooms.length === 0) {
      console.warn('[bspGeometry] could not connect a hall branch to its parent hall');
      continue;
    }
    const room = rng.pick(rooms);
    connections.push(join(room.floor, parentHall, 1, true, [room.id], rng));
  }

  // Extra loops: open some hall adjacencies the spanning tree skipped, so halls stop dead-ending.
  const hallNodes = internals.filter((n) => n.hall);
  for (let i = 0; i < hallNodes.length; i++) {
    for (let j = i + 1; j < hallNodes.length; j++) {
      const a = hallNodes[i];
      const b = hallNodes[j];
      if (!adjacent(a.hall, b.hall) || linked.has(pairKey(a.hid, b.hid))) continue;
      if (rng.random() < hallLoopChance) {
        connections.push(join(a.hall, b.hall, hallWidth, false, [], rng));
        linked.add(pairKey(a.hid, b.hid));
      }
    }
  }
  return connections;
}

/** True if two outer rects share a wall line with ≥1 tile of overlap along it. */
function wallAdjacent(a, b) {
  const shareCol = a.x + a.w - 1 === b.x || b.x + b.w - 1 === a.x;
  const shareRow = a.y + a.h - 1 === b.y || b.y + b.h - 1 === a.y;
  const yOverlap = Math.min(a.y + a.h - 1, b.y + b.h - 1) - Math.max(a.y, b.y) >= 1;
  const xOverlap = Math.min(a.x + a.w - 1, b.x + b.w - 1) - Math.max(a.x, b.x) >= 1;
  return (shareCol && yOverlap) || (shareRow && xOverlap);
}

/** Runs the BSP geometry planning stage (see the file overview for params and outputs). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const minRoom = stageConfig.minRoomSize ?? DEFAULTS.minRoomSize;
  const includeHalls = stageConfig.includeHalls ?? DEFAULTS.includeHalls;
  const hallWidth = stageConfig.hallWidth ?? DEFAULTS.hallWidth;
  const hallLoopChance = stageConfig.hallLoopChance ?? DEFAULTS.hallLoopChance;
  const skipLeafHalls = stageConfig.skipLeafHalls ?? DEFAULTS.skipLeafHalls;
  const bounds = stageConfig.bounds ?? {
    x: 0,
    y: 0,
    w: stageConfig.width ?? DEFAULTS.width,
    h: stageConfig.height ?? DEFAULTS.height,
  };

  const tree = makePartition(minRoom, hallWidth, includeHalls, skipLeafHalls, rng)({ ...bounds });
  linkParents(tree, null);

  // Stable ids by position (top-left, row-major) so a given seed always numbers rooms the same way.
  const leaves = leavesOf(tree).sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  leaves.forEach((leaf, id) => {
    leaf.id = id;
  });
  const internals = internalsOf(tree);

  const zones = leaves.map((leaf) => ({
    id: leaf.id,
    cells: [[leaf.id, 0]],
    rect: { ...leaf.rect },
    labels: ['room'],
  }));
  const rooms = {};
  for (const leaf of leaves) rooms[`${leaf.id},0`] = { ...leaf.floor };
  const halls = internals.filter((n) => n.hall).map((n) => ({ ...n.hall }));

  const connections = includeHalls
    ? hallConnections(leaves, internals, hallWidth, hallLoopChance, rng)
    : noHallConnections(internals, rng);

  const adjacency = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      if (wallAdjacent(leaves[i].rect, leaves[j].rect))
        adjacency.push([leaves[i].id, leaves[j].id]);
    }
  }
  const links = connections
    .filter((c) => c.rooms.length === 2)
    .map(({ rooms: [a, b] }) => (a < b ? [a, b] : [b, a]))
    .sort((e1, e2) => e1[0] - e2[0] || e1[1] - e2[1])
    .map(([a, b], id) => ({ id, a, b }));

  appendZones(blackboard, { zones, rooms, adjacency, links });
  blackboard[LEVEL_BSP] = {
    bounds,
    outerWall: stageConfig.outerWall ?? true,
    halls,
    connections,
  };
}
