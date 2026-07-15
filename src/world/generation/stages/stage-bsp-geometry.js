/**
 * @file Structure-planning stage: binary space partitioning (the "BSP" geometry). Recursively splits
 * the map rectangle into leaf rooms separated by shared 1-tile walls — a "fully packed" building-like
 * layout where every tile is a room floor or a wall, with no leftover void. No tiles are written here;
 * this stage plans, and `bspCarve` realizes. `label`/`stairs`/`spawn`/`populate` consume its output
 * through the same `level:zones`/`level:rooms` contract the room-grid pipeline uses, so they work over
 * BSP geometry unchanged. See docs/design/map-generation.md.
 *
 * Model: a region is a tile-space rect {x,y,w,h} for a room's *outer* extent (wall ring inclusive).
 * Sibling regions overlap by exactly 1 tile on their seam — that shared column/row is the wall between
 * them. `minRoomSize` is the wall-inclusive footprint (default 5 → a 5×5 room = 3×3 walkable). A region
 * of width w is splittable iff w ≥ 2·minRoom − 1 (the two children share one seam wall).
 *
 * Connectivity is intrinsic to the partition tree, not a spanning tree over an arbitrary graph (so the
 * generic `link` stage does not apply): each internal node opens one door between a leaf of its left
 * subtree and a leaf of its right subtree, across their shared wall. A full binary tree with n leaves
 * has n−1 internal nodes, so this yields n−1 doors connecting all rooms — a tree, connected by
 * construction. Gaps are always strictly interior to both rooms' walls, so no exit lands on a corner.
 *
 * Stage parameters (from the pipeline config, all optional):
 *   width, height — full map dimensions in tiles, walls included (default 48 × 32). Ignored if `bounds`
 *                   is given.
 *   bounds        — {x,y,w,h}: partition this sub-rectangle of an in-progress level instead of the whole
 *                   map (another stage may have built an enclosing box). Defaults to the full map.
 *   minRoomSize   — wall-inclusive minimum room footprint (default 5).
 *
 * Blackboard outputs:
 *   level:zones     -> [{ id, cells: [[id,0]], rect:{x,y,w,h} (outer), labels:['room'] }]
 *   level:rooms     -> { "id,0": { x0,y0,x1,y1 } }   (floor interior, inclusive)
 *   level:adjacency -> [[idA,idB], …]   (idA < idB; leaves sharing a wall)
 *   level:links     -> [{ id, a, b }]   (the subset actually connected by a door — a spanning tree)
 *   level:bsp       -> { bounds, exits:[{ a, b, gap:[x,y], orientation:'v'|'h' }] }  (for bspCarve)
 */
import {
  LEVEL_ZONES,
  LEVEL_ADJACENCY,
  LEVEL_LINKS,
  LEVEL_ROOMS,
  LEVEL_BSP,
} from '../blackboard-keys.js';

const DEFAULTS = { width: 48, height: 32, minRoomSize: 5 };

/** All leaf nodes under `node`, in tree (left-to-right) order. */
function leavesOf(node, acc = []) {
  if (node.leaf) acc.push(node);
  else {
    leavesOf(node.left, acc);
    leavesOf(node.right, acc);
  }
  return acc;
}

/** Recursively partitions `rect` until neither axis can be split without violating minRoom. */
function partition(rect, minRoom, rng) {
  const { x, y, w, h } = rect;
  const canV = w >= 2 * minRoom - 1;
  const canH = h >= 2 * minRoom - 1;
  if (!canV && !canH) return { rect, leaf: true };

  const vertical = canV && canH ? rng.nextInt(0, 2) === 0 : canV;
  if (vertical) {
    // Shared wall at column X; left is [x,X], right is [X, x+w-1] (they overlap on column X).
    const X = rng.intInclusive(x + minRoom - 1, x + w - minRoom);
    return {
      rect,
      vertical: true,
      wall: X,
      left: partition({ x, y, w: X - x + 1, h }, minRoom, rng),
      right: partition({ x: X, y, w: x + w - X, h }, minRoom, rng),
    };
  }
  const Y = rng.intInclusive(y + minRoom - 1, y + h - minRoom);
  return {
    rect,
    vertical: false,
    wall: Y,
    left: partition({ x, y, w, h: Y - y + 1 }, minRoom, rng),
    right: partition({ x, y: Y, w, h: y + h - Y }, minRoom, rng),
  };
}

// Every (leftLeaf, rightLeaf, gap) an internal node's door could use: leaves on each side that touch
// the seam, paired with each row/col strictly interior to *both* rooms' walls (so no corner exits).
function exitOptions(node) {
  const left = leavesOf(node.left);
  const right = leavesOf(node.right);
  const options = [];
  if (node.vertical) {
    const X = node.wall;
    const touchL = left.filter((l) => l.rect.x + l.rect.w - 1 === X);
    const touchR = right.filter((r) => r.rect.x === X);
    for (const a of touchL) {
      for (const b of touchR) {
        const lo = Math.max(a.rect.y + 1, b.rect.y + 1);
        const hi = Math.min(a.rect.y + a.rect.h - 2, b.rect.y + b.rect.h - 2);
        for (let gy = lo; gy <= hi; gy++) options.push({ a, b, gap: [X, gy] });
      }
    }
  } else {
    const Y = node.wall;
    const touchT = left.filter((l) => l.rect.y + l.rect.h - 1 === Y);
    const touchB = right.filter((r) => r.rect.y === Y);
    for (const a of touchT) {
      for (const b of touchB) {
        const lo = Math.max(a.rect.x + 1, b.rect.x + 1);
        const hi = Math.min(a.rect.x + a.rect.w - 2, b.rect.x + b.rect.w - 2);
        for (let gx = lo; gx <= hi; gx++) options.push({ a, b, gap: [gx, Y] });
      }
    }
  }
  return options;
}

// One door per internal node, connecting its two subtrees; recurse so every node contributes an exit.
function planExits(node, rng, out = []) {
  if (node.leaf) return out;
  const options = exitOptions(node);
  if (options.length > 0) {
    const { a, b, gap } = rng.pick(options);
    out.push({ a: a.id, b: b.id, gap, orientation: node.vertical ? 'v' : 'h' });
  } else {
    // Provably unreachable given minRoom ≥ 3 interior (walls are too sparse to cover every interior
    // line); guard anyway so a future param change can't silently drop connectivity.
    console.warn('[bspGeometry] no valid non-corner exit at a split; subtrees left unconnected');
  }
  planExits(node.left, rng, out);
  planExits(node.right, rng, out);
  return out;
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
  const bounds = stageConfig.bounds ?? {
    x: 0,
    y: 0,
    w: stageConfig.width ?? DEFAULTS.width,
    h: stageConfig.height ?? DEFAULTS.height,
  };

  const tree = partition({ ...bounds }, minRoom, rng);

  // Stable ids by position (top-left, row-major) so a given seed always numbers rooms the same way.
  const leaves = leavesOf(tree).sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  leaves.forEach((leaf, id) => {
    leaf.id = id;
  });

  const zones = leaves.map((leaf) => ({
    id: leaf.id,
    cells: [[leaf.id, 0]],
    rect: { ...leaf.rect },
    labels: ['room'],
  }));

  const rooms = {};
  for (const leaf of leaves) {
    const { x, y, w, h } = leaf.rect;
    rooms[`${leaf.id},0`] = { x0: x + 1, y0: y + 1, x1: x + w - 2, y1: y + h - 2 };
  }

  const adjacency = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      if (wallAdjacent(leaves[i].rect, leaves[j].rect))
        adjacency.push([leaves[i].id, leaves[j].id]);
    }
  }

  const exits = planExits(tree, rng);
  const links = exits
    .map(({ a, b }) => (a < b ? [a, b] : [b, a]))
    .sort((e1, e2) => e1[0] - e2[0] || e1[1] - e2[1])
    .map(([a, b], id) => ({ id, a, b }));

  blackboard[LEVEL_ZONES] = zones;
  blackboard[LEVEL_ROOMS] = rooms;
  blackboard[LEVEL_ADJACENCY] = adjacency;
  blackboard[LEVEL_LINKS] = links;
  blackboard[LEVEL_BSP] = { bounds, outerWall: stageConfig.outerWall ?? true, exits };
}
