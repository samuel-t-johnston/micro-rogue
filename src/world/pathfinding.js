// BFS pathfinding over the level grid. Returns the full path from the step
// after `from` to `to` as an array of {x, y}, or null if unreachable.
// Returns [] if from === to. Supports 8-directional movement.
export function findPath(from, to, level) {
  if (from.x === to.x && from.y === to.y) return [];

  const queue = [{ x: from.x, y: from.y, path: [] }];
  const visited = new Set([`${from.x},${from.y}`]);

  while (queue.length > 0) {
    const { x, y, path } = queue.shift();

    for (const [dx, dy] of [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;

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
