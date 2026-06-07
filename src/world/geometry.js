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

// The passable tiles orthogonally or diagonally adjacent to `pos`.
export function passableNeighbors(pos, level) {
  return DIRECTIONS_8
    .map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy }))
    .filter(tile => level.isPassable(tile.x, tile.y));
}
