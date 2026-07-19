/**
 * @file Realization stage: turns each planned node (`layoutNodes`) into an organic chamber of floor
 * tiles, tagged as a `chamber` zone. Third stage of the semi-sober walker pipeline; pairs with
 * `carveCorridors`, which connects the chambers. See docs/design/organic-map-generation.md.
 *
 * A chamber is carved by a leashed random walker rather than a stamped disc, so it reads as a blob
 * instead of a circle: from the node centre the walker takes radius² steps, painting a plus brush at
 * each, with both the walker and the brush clipped to within Chebyshev `radius` of the centre. Because
 * each step's brush overlaps the last, the result is a single connected component that always includes
 * the centre — so the `core` (the node centre) is guaranteed floor, and corridors can rely on it.
 *
 * Owns the level's tile grid when none exists yet (standalone): sizes it to `level:bounds` and walls
 * it. When `level.tiles` is already populated it carves floor in place (embedded — another stage built
 * the enclosing box). Chambers never reach the bounds border (layoutNodes pads by the max radius), so
 * no outer-wall handling is needed here.
 *
 * Blackboard:
 *   reads  level:nodes, level:bounds
 *   writes tiles; appends to level:zones ({ id, cells:[[id,0]], rect, labels:['room'],
 *          kind:'chamber', origin:'tagged' }) and level:rooms ("id,0" -> { tiles, rect, core }).
 */
import { LEVEL_NODES, LEVEL_BOUNDS, LEVEL_ZONES, LEVEL_ROOMS } from '../blackboard-keys.js';
import { DIRECTIONS_4, chebyshevDistance } from '../../map/geometry.js';

// Plus-shaped brush: the walker tile and its four orthogonal neighbours.
const BRUSH = [[0, 0], ...DIRECTIONS_4];

// Walks a single chamber, returning its floor tiles (deduped, in carve order). Leashed so every
// painted tile stays within Chebyshev `radius` of the centre; the centre is always the first tile.
function walkChamber(node, rng) {
  const { x: cx, y: cy, radius } = node;
  const within = (x, y) => chebyshevDistance({ x, y }, node) <= radius;
  const seen = new Set();
  const tiles = [];
  const paint = (x, y) => {
    const k = `${x},${y}`;
    if (within(x, y) && !seen.has(k)) {
      seen.add(k);
      tiles.push([x, y]);
    }
  };
  let px = cx;
  let py = cy;
  const steps = radius * radius;
  for (let i = 0; i <= steps; i++) {
    for (const [ox, oy] of BRUSH) paint(px + ox, py + oy);
    const [dx, dy] = rng.pick(DIRECTIONS_4);
    if (within(px + dx, py + dy)) {
      px += dx;
      py += dy;
    }
  }
  return tiles;
}

const boundsOf = (tiles) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of tiles) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

/** Runs the carve-chambers realization stage (see the file overview). */
export function run(level, stageConfig, blackboard, rng) {
  const nodes = blackboard[LEVEL_NODES] ?? [];
  const bounds = blackboard[LEVEL_BOUNDS] ?? { x: 0, y: 0, w: level.width, h: level.height };

  // Own the grid only if no earlier stage laid tiles; otherwise carve into the existing level in place.
  if (!level.tiles.length) {
    level.width = bounds.x + bounds.w;
    level.height = bounds.y + bounds.h;
    level.tiles = Array.from({ length: level.height }, () =>
      Array.from({ length: level.width }, () => 'wall'),
    );
  }

  const setFloor = (x, y) => {
    if (level.tiles[y]?.[x] !== undefined) level.tiles[y][x] = 'floor';
  };

  const zones = blackboard[LEVEL_ZONES] ?? [];
  const rooms = blackboard[LEVEL_ROOMS] ?? {};
  for (const node of nodes) {
    const tiles = walkChamber(node, rng);
    for (const [x, y] of tiles) setFloor(x, y);
    zones.push({
      id: node.id,
      cells: [[node.id, 0]],
      rect: boundsOf(tiles),
      labels: ['room'],
      kind: 'chamber',
      origin: 'tagged',
    });
    rooms[`${node.id},0`] = { tiles, rect: boundsOf(tiles), core: [node.x, node.y] };
  }
  blackboard[LEVEL_ZONES] = zones;
  blackboard[LEVEL_ROOMS] = rooms;
}
