// Realization stage: turns the zone plan into floor tiles. Inits the grid to wall, then carves a
// random room per cell and merges same-zone cells by growing their rooms until they touch (no
// intra-zone corridors). Rooms keep a 1-tile gutter on sides facing a *different* zone or the grid
// edge, so adjacent zones never touch. Records each cell's room rect to `level:rooms` for the hall
// stage. See docs/design/procedural-3x3-dungeon.md (Room variety & dog-leg halls).

const MIN_FLOOR = 2; // a 2x2 floor room (4x4 counting its wall ring)

// Grow range `a` until it overlaps range `b` by at least one (a only grows; b's ends are in-band).
function ensureOverlap(a, b, k0, k1) {
  if (Math.max(a[k0], b[k0]) <= Math.min(a[k1], b[k1])) return;
  if (a[k1] < b[k0]) a[k1] = b[k0];
  else a[k0] = b[k1];
}

export function run(level, stageConfig, blackboard, rng) {
  const grid = blackboard['level:grid'] ?? { cols: 0, rows: 0, cellSize: 10 };
  const cs = grid.cellSize;
  const zones = blackboard['level:zones'] ?? [];

  level.width = grid.cols * cs;
  level.height = grid.rows * cs;
  level.tiles = Array.from({ length: level.height }, () =>
    Array.from({ length: level.width }, () => 'wall'));

  const cellZone = new Map();
  for (const z of zones) for (const [gc, gr] of z.cells) cellZone.set(`${gc},${gr}`, z.id);

  // 1. A random room rectangle per cell, inside the cell interior (1-tile gutter all round for now).
  const room = new Map(); // "c,r" -> { x0, y0, x1, y1 } inclusive floor bounds
  for (const z of zones) {
    for (const [gc, gr] of z.cells) {
      const ix0 = gc * cs + 1;
      const ix1 = gc * cs + cs - 2;
      const iy0 = gr * cs + 1;
      const iy1 = gr * cs + cs - 2;
      const w = Math.min(ix1 - ix0 + 1, MIN_FLOOR + rng.nextInt(0, Math.max(1, (ix1 - ix0 + 1) - MIN_FLOOR + 1)));
      const h = Math.min(iy1 - iy0 + 1, MIN_FLOOR + rng.nextInt(0, Math.max(1, (iy1 - iy0 + 1) - MIN_FLOOR + 1)));
      const x0 = ix0 + rng.nextInt(0, (ix1 - ix0 + 1) - w + 1);
      const y0 = iy0 + rng.nextInt(0, (iy1 - iy0 + 1) - h + 1);
      room.set(`${gc},${gr}`, { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 });
    }
  }

  // 2-3. Merge same-zone cells: extend the two rooms to the shared boundary, then (if needed) grow
  // perpendicular until they overlap. Handle each seam once via east/south neighbours.
  for (const z of zones) {
    for (const [gc, gr] of z.cells) {
      const a = room.get(`${gc},${gr}`);
      if (cellZone.get(`${gc + 1},${gr}`) === z.id) {
        const b = room.get(`${gc + 1},${gr}`);
        a.x1 = (gc + 1) * cs - 1;   // A reaches its east edge…
        b.x0 = (gc + 1) * cs;       // …B reaches its west edge (adjacent column)
        ensureOverlap(a, b, 'y0', 'y1');
      }
      if (cellZone.get(`${gc},${gr + 1}`) === z.id) {
        const b = room.get(`${gc},${gr + 1}`);
        a.y1 = (gr + 1) * cs - 1;
        b.y0 = (gr + 1) * cs;
        ensureOverlap(a, b, 'x0', 'x1');
      }
    }
  }

  // 4. Carve, and record the rects for the hall stage.
  const rooms = {};
  for (const [key, r] of room) {
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) level.tiles[y][x] = 'floor';
    }
    rooms[key] = { ...r };
  }
  blackboard['level:rooms'] = rooms;
}
