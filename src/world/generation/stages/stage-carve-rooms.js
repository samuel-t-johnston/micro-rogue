// Realization stage: turns the zone plan into floor tiles. Initializes the grid to wall and carves
// a room per zone — **from the zone's actual cells, never its bounding box** — so polyomino (L/T/blob)
// zones carve correctly. Walls between same-zone cells are opened (one contiguous room); a gutter is
// left against any other-zone cell or the grid edge, so rooms never touch (halls run in the gutters).
// See docs/design/procedural-3x3-dungeon.md.
//
// Rooms currently fill their cell minus a 1-tile gutter (max size); per-cell size variety is a
// deferred enhancement (it must keep same-zone seams overlapping — see the design doc).

export function run(level, stageConfig, blackboard) {
  const grid = blackboard['level:grid'] ?? { cols: 0, rows: 0, cellSize: 10 };
  const cs = grid.cellSize;
  const zones = blackboard['level:zones'] ?? [];

  level.width = grid.cols * cs;
  level.height = grid.rows * cs;
  level.tiles = Array.from({ length: level.height }, () =>
    Array.from({ length: level.width }, () => 'wall'));

  // Which zone owns each cell, so we can tell same-zone seams (open) from gutters (keep wall).
  const cellZone = new Map();
  for (const z of zones) for (const [gc, gr] of z.cells) cellZone.set(`${gc},${gr}`, z.id);

  for (const z of zones) {
    for (const [gc, gr] of z.cells) {
      const same = (dc, dr) => cellZone.get(`${gc + dc},${gr + dr}`) === z.id;
      const x0 = gc * cs + (same(-1, 0) ? 0 : 1);
      const x1 = gc * cs + cs - 1 - (same(1, 0) ? 0 : 1);
      const y0 = gr * cs + (same(0, -1) ? 0 : 1);
      const y1 = gr * cs + cs - 1 - (same(0, 1) ? 0 : 1);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) level.tiles[y][x] = 'floor';
      }
    }
  }
}
