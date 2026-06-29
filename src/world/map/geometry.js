/** @file Small grid-geometry helpers shared across pathfinding and AI goals. */

/** 8-directional neighbor offsets (orthogonal first, then diagonals). */
export const DIRECTIONS_8 = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Chebyshev (chessboard) distance — the number of 8-directional steps between two tiles. */
export function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The 8 compass directions, in bearing-sector order (E, then clockwise on the y-down grid). The order
 * is load-bearing: `cardinalDirection` indexes this by the 45° sector of `atan2`. The canonical list of
 * direction names — anything that needs the set (e.g. directional projectile sprites) reads it here.
 */
export const COMPASS_DIRECTIONS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

/**
 * The 8-way compass direction from `from` to `to` (e.g. 'N', 'SE'), or null when they coincide.
 * Buckets the bearing into eight 45° sectors. The grid is y-down (tiles[y][x]), so a smaller y is
 * north. Used for imprecise hearing ("a shout somewhere to the NW") — not exact positions.
 */
export function cardinalDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  const sector = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  return COMPASS_DIRECTIONS[sector];
}

/**
 * Unit step for each 8-way compass direction on the y-down grid — the inverse of cardinalDirection.
 * Used by goals that turn a perceived direction (a shouted heading, a scent gradient) into a move.
 */
export const DIRECTION_STEPS = {
  N: [0, -1],
  NE: [1, -1],
  E: [1, 0],
  SE: [1, 1],
  S: [0, 1],
  SW: [-1, 1],
  W: [-1, 0],
  NW: [-1, -1],
};

/**
 * The farthest passable tile in `direction` from `from`, up to maxDist tiles away (or `from` itself
 * if the first step is blocked). Turns an imprecise directional lead — a heard noise, a scent
 * gradient — into a concrete tile to navigate toward.
 */
export function projectTile(level, from, direction, maxDist) {
  const step = DIRECTION_STEPS[direction];
  if (!step) return { x: from.x, y: from.y };
  const [dx, dy] = step;
  let target = { x: from.x, y: from.y };
  for (let i = 1; i <= maxDist; i++) {
    const x = from.x + dx * i;
    const y = from.y + dy * i;
    if (!level.isPassable(x, y)) break;
    target = { x, y };
  }
  return target;
}

/**
 * The tiles a straight line passes through from (x0, y0) to (x1, y1), inclusive of both endpoints and
 * ordered from start to end (integer Bresenham). Used to trace a thrown item's physical flight path —
 * unlike shadowcasting FOV, a line can't curve around a corner, so it may stop short of a visible tile.
 */
export function lineTiles(x0, y0, x1, y1) {
  const tiles = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    tiles.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return tiles;
}

/** The passable tiles orthogonally or diagonally adjacent to `pos`. */
export function passableNeighbors(pos, level) {
  return DIRECTIONS_8.map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy })).filter((tile) =>
    level.isPassable(tile.x, tile.y),
  );
}
