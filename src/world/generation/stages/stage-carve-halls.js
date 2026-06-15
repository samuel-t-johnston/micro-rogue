// Realization stage: connects linked zones with doored corridors. For each link, picks an adjacent
// cell-pair, a random non-corner opening on each room's facing wall, places a door on both sides, and
// runs a corridor between them — straight if the openings line up, else a Z-bend through the gutter.
// Collisions are tolerated (floor-over-wall is harmless; connectivity is what matters).
// See docs/design/procedural-3x3-dungeon.md (Room variety & dog-leg halls).
import { createDoor } from '../../furniture.js';

const cellsAdjacent = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
const randIn = (lo, hi, rng) => lo + rng.nextInt(0, hi - lo + 1);

export function run(level, stageConfig, blackboard, rng, registry) {
  const zones = blackboard['level:zones'] ?? [];
  const links = blackboard['level:links'] ?? [];
  const rooms = blackboard['level:rooms'] ?? {};
  const byId = new Map(zones.map(z => [z.id, z]));

  const carve = (x, y) => { if (level.tiles[y]?.[x] !== undefined) level.tiles[y][x] = 'floor'; };
  const carveH = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) carve(x, y); };
  const carveV = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) carve(x, y); };

  for (const link of links) {
    const za = byId.get(link.a);
    const zb = byId.get(link.b);
    if (!za || !zb) continue;

    const pairs = [];
    for (const ca of za.cells) for (const cb of zb.cells) if (cellsAdjacent(ca, cb)) pairs.push([ca, cb]);
    if (pairs.length === 0) continue;
    const [ca, cb] = rng.pick(pairs);
    const a = rooms[`${ca[0]},${ca[1]}`];
    const b = rooms[`${cb[0]},${cb[1]}`];
    if (!a || !b) continue;

    const dir = [cb[0] - ca[0], cb[1] - ca[1]];

    if (dir[1] === 0) {
      // Horizontal link: doors on facing vertical walls, Z-bends vertically through the gutter.
      const east = dir[0] > 0;
      const ax = east ? a.x1 + 1 : a.x0 - 1;
      const bx = east ? b.x0 - 1 : b.x1 + 1;
      const ay = randIn(a.y0, a.y1, rng);
      const by = randIn(b.y0, b.y1, rng);
      const mid = Math.trunc((ax + bx) / 2);
      carveH(ax, mid, ay);
      carveV(ay, by, mid);
      carveH(mid, bx, by);
      level.placeEntity(createDoor(registry, ax, ay));
      level.placeEntity(createDoor(registry, bx, by));
    } else {
      // Vertical link: doors on facing horizontal walls, Z-bends horizontally through the gutter.
      const south = dir[1] > 0;
      const ay = south ? a.y1 + 1 : a.y0 - 1;
      const by = south ? b.y0 - 1 : b.y1 + 1;
      const ax = randIn(a.x0, a.x1, rng);
      const bx = randIn(b.x0, b.x1, rng);
      const mid = Math.trunc((ay + by) / 2);
      carveV(ay, mid, ax);
      carveH(ax, bx, mid);
      carveV(mid, by, bx);
      level.placeEntity(createDoor(registry, ax, ay));
      level.placeEntity(createDoor(registry, bx, by));
    }
  }
}
