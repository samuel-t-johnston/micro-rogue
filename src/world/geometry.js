// Small grid-geometry helpers shared across pathfinding and AI goals.

// 8-directional neighbor offsets (orthogonal first, then diagonals).
export const DIRECTIONS_8 = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// Chebyshev (chessboard) distance — the number of 8-directional steps between two tiles.
export function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// The 8-way compass direction from `from` to `to` (e.g. 'N', 'SE'), or null when they coincide.
// Buckets the bearing into eight 45° sectors. The grid is y-down (tiles[y][x]), so a smaller y is
// north. Used for imprecise hearing ("a shout somewhere to the NW") — not exact positions.
const OCTANTS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
export function cardinalDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  const sector = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  return OCTANTS[sector];
}

// Unit step for each 8-way compass direction on the y-down grid — the inverse of cardinalDirection.
// Used by goals that turn a perceived direction (a shouted heading, a scent gradient) into a move.
export const DIRECTION_STEPS = {
  N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1],
};

// The passable tiles orthogonally or diagonally adjacent to `pos`.
export function passableNeighbors(pos, level) {
  return DIRECTIONS_8
    .map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy }))
    .filter(tile => level.isPassable(tile.x, tile.y));
}
