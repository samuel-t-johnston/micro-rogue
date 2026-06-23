/**
 * @file Realization stage: connects linked zones with doored corridors. For each link, picks an
 * adjacent cell-pair and routes a corridor between the rooms' facing walls, dropping a door on each
 * side. The route keeps every corridor tile a wall's-width from any room it doesn't open into:
 *   - walls overlap            → a straight cut at a shared offset;
 *   - gutter ≥ 3 (interior lane) → a Z-bend whose along-gutter leg runs the middle of the gutter;
 *   - 2-tile gutter, no overlap → an L-bend off the mutually-nearest corners (still no wall-hugging).
 * Routing the leg down a room-adjacent gutter column is the bug we avoid: it leaves a door stranded on
 * an edge that's already wide open to the corridor. Collisions are otherwise tolerated (floor-over-wall
 * is harmless; connectivity is what matters). See docs/design/procedural-3x3-dungeon.md.
 */
import { createDoor } from '../../furniture.js';

const cellsAdjacent = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
const randIn = (lo, hi, rng) => lo + rng.nextInt(0, hi - lo + 1);

// Plan one corridor as opening offsets + the lane for its perpendicular leg.
//   la / lb        — the gutter lines just outside each room's facing wall (la by A, lb by B).
//   [al,ah]/[bl,bh] — each room's facing-wall extent (perpendicular to the link).
// Returns { pa, pb, mid }: the opening offset on A, on B, and the lane the leg runs down. The three
// segments carveH(la,mid,pa) → carve(pa↔pb @ mid) → carveH(mid,lb,pb) degrade to a straight or L route
// when pa==pb or mid sits on a door line, so the caller stays a single uniform three-segment carve.
function planCorridor(la, lb, al, ah, bl, bh, rng) {
  const lo = Math.max(al, bl), hi = Math.min(ah, bh);
  if (lo <= hi) {                              // facing walls overlap → straight cut at a shared offset
    const s = randIn(lo, hi, rng);
    return { pa: s, pb: s, mid: la };
  }
  const innerLo = Math.min(la, lb) + 1, innerHi = Math.max(la, lb) - 1;
  if (innerLo <= innerHi) {                    // gutter ≥ 3: an interior lane exists → Z-bend through it
    return { pa: randIn(al, ah, rng), pb: randIn(bl, bh, rng), mid: randIn(innerLo, innerHi, rng) };
  }
  // 2-tile gutter and no overlap: bend off the mutually-nearest corners, leg on B's door line. The leg
  // then stays clear of both rooms (it never extends past either nearest corner), so nothing hugs a wall.
  const aBeforeB = ah < bl;
  return { pa: aBeforeB ? ah : al, pb: aBeforeB ? bl : bh, mid: lb };
}

/** Runs the carve-halls realization stage (see the file overview). */
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
      // Horizontal link: doors on facing vertical walls, the leg runs vertically through the gutter.
      const east = dir[0] > 0;
      const ax = east ? a.x1 + 1 : a.x0 - 1;
      const bx = east ? b.x0 - 1 : b.x1 + 1;
      const { pa: ay, pb: by, mid } = planCorridor(ax, bx, a.y0, a.y1, b.y0, b.y1, rng);
      carveH(ax, mid, ay);
      carveV(ay, by, mid);
      carveH(mid, bx, by);
      level.placeEntity(createDoor(registry, ax, ay));
      level.placeEntity(createDoor(registry, bx, by));
    } else {
      // Vertical link: doors on facing horizontal walls, the leg runs horizontally through the gutter.
      const south = dir[1] > 0;
      const ay = south ? a.y1 + 1 : a.y0 - 1;
      const by = south ? b.y0 - 1 : b.y1 + 1;
      const { pa: ax, pb: bx, mid } = planCorridor(ay, by, a.x0, a.x1, b.x0, b.x1, rng);
      carveV(ay, mid, ax);
      carveH(ax, bx, mid);
      carveV(mid, by, bx);
      level.placeEntity(createDoor(registry, ax, ay));
      level.placeEntity(createDoor(registry, bx, by));
    }
  }
}
