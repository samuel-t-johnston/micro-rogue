// Realization stage: connects linked zones with corridors. For each link, picks an adjacent
// cell-pair across the two zones and carves through the 2-tile gutter between their rooms at a
// shared, non-corner offset, then drops a door at the opening. Links are always between adjacent
// cells, so a straight 2-tile cut suffices (dog-leg routing for varied/offset rooms is deferred
// alongside room-size variety). See docs/design/procedural-3x3-dungeon.md.
import { createDoor } from '../../furniture.js';

const cellsAdjacent = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

export function run(level, stageConfig, blackboard, rng, registry) {
  const zones = blackboard['level:zones'] ?? [];
  const links = blackboard['level:links'] ?? [];
  const cs = blackboard['level:grid']?.cellSize ?? 10;
  const byId = new Map(zones.map(z => [z.id, z]));

  for (const link of links) {
    const za = byId.get(link.a);
    const zb = byId.get(link.b);
    if (!za || !zb) continue;

    // Pick one cell-edge shared by the two zones to run the corridor through.
    const pairs = [];
    for (const ca of za.cells) for (const cb of zb.cells) if (cellsAdjacent(ca, cb)) pairs.push([ca, cb]);
    if (pairs.length === 0) continue; // links ⊆ adjacency, so this shouldn't happen
    const [ca, cb] = rng.pick(pairs);

    const dir = [cb[0] - ca[0], cb[1] - ca[1]];
    const horizontal = dir[1] === 0;

    // Offset along the shared wall, kept off the corners so it lands on room floor both sides.
    const originPerp = (horizontal ? ca[1] : ca[0]) * cs;
    const span = cs - 4;
    const offset = originPerp + (span > 0 ? 2 + rng.nextInt(0, span) : Math.floor(cs / 2));

    // The two gutter tiles: the dir-facing edge of cell A and the back edge of cell B.
    const tileA = horizontal
      ? [ca[0] * cs + (dir[0] > 0 ? cs - 1 : 0), offset]
      : [offset, ca[1] * cs + (dir[1] > 0 ? cs - 1 : 0)];
    const tileB = horizontal
      ? [cb[0] * cs + (dir[0] > 0 ? 0 : cs - 1), offset]
      : [offset, cb[1] * cs + (dir[1] > 0 ? 0 : cs - 1)];

    for (const [x, y] of [tileA, tileB]) level.tiles[y][x] = 'floor';
    level.placeEntity(createDoor(registry, tileA[0], tileA[1]));
  }
}
