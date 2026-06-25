import { DIRECTIONS_8, passableNeighbors } from './geometry.js';
import { tileKey } from '../../engine/core/tile-key.js';

/**
 * BFS pathfinding over the level grid. Supports 8-directional movement.
 * @returns {{x: number, y: number}[] | null} The path from the step after `from` through `to`, `[]`
 *   if `from === to`, or null if `to` is unreachable.
 */
export function findPath(from, to, level) {
  if (from.x === to.x && from.y === to.y) return [];

  const queue = [{ x: from.x, y: from.y, path: [] }];
  const visited = new Set([tileKey(from.x, from.y)]);

  while (queue.length > 0) {
    const { x, y, path } = queue.shift();

    for (const [dx, dy] of DIRECTIONS_8) {
      const nx = x + dx;
      const ny = y + dy;
      const key = tileKey(nx, ny);

      if (visited.has(key)) continue;
      if (!level.isPassable(nx, ny)) continue;

      visited.add(key);
      const newPath = [...path, { x: nx, y: ny }];

      if (nx === to.x && ny === to.y) return newPath;

      queue.push({ x: nx, y: ny, path: newPath });
    }
  }

  return null;
}

/**
 * Returns the shortest path to any passable tile adjacent to `target`, or null if none is reachable.
 * Use this to approach a blocking entity (creatures have blocksMovement, so the target's own tile is
 * never passable and findPath to it would always fail).
 */
export function findPathToAdjacent(from, target, level) {
  let best = null;
  for (const tile of passableNeighbors(target, level)) {
    const path = findPath(from, tile, level);
    if (path && (best === null || path.length < best.length)) best = path;
  }
  return best;
}
