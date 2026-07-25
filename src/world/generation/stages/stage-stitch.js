/**
 * @file Structure stage: joins separately-generated sections into one connected level. After two (or
 * more) structure sections have each carved their own bounds sub-rect (see the `box` stage), the level
 * is a set of disconnected floor components; `stitch` carves short room-to-room corridors across the
 * gaps between them so the whole level is traversable. See docs/design/organic-map-generation.md
 * (§ composition).
 *
 * Pure — consumes no RNG (candidates are ordered by gap length, ties by tile index). It works over any
 * geometry via the shared zone/room contract:
 *   - Endpoints are **room** tiles (chamber zones) on a component's frontier (next to wall), so
 *     connections read as door-to-door rather than tunnelling into random cave wall.
 *   - Candidates are frontier room-tile pairs in *different* components within `maxGap`, shortest first.
 *   - Connectivity is guaranteed: a candidate that merges two still-separate components is always
 *     taken (and a nearest-pair fallback connects anything the gap budget missed), so the level always
 *     ends connected — at least one connection. `maxConnections` is a best-effort ceiling on the number
 *     of *separate* connections; extra (non-merging) connections past what connectivity needs are added
 *     up to that ceiling, skipping any whose path overlaps or crowds an accepted one. Two orthogonal
 *     corridors that cross must share a tile, so overlap-rejection is exact non-crossing.
 *
 * Each connection carves its L-path to floor and drops a door on the dug gap. Zone adjacency across the
 * connection is recorded to `level:adjacency`.
 *
 * Operates over the **whole** level — not `level:bounds`, which by this point holds only the last
 * section's sub-rect (the documented last-writer-wins gotcha). A `bounds` param can scope it if a
 * future pipeline needs an embedded stitch.
 *
 * Stage parameters (all optional):
 *   maxConnections — best-effort number of separate connections (default 1, clamped to ≥1).
 *   maxGap         — longest gap (Manhattan) a normal connection bridges (default 6). The fallback
 *                    ignores this to guarantee connectivity.
 *   spacing        — min Chebyshev distance an *extra* connection keeps from the others (default 2).
 *   bounds         — restrict to a sub-rect (default the whole level).
 *
 * Blackboard: reads level:zones, level:rooms; writes tiles + level:adjacency; places doors.
 */
import { LEVEL_ZONES, LEVEL_ROOMS, LEVEL_ADJACENCY } from '../blackboard-keys.js';
import { roomTiles, isChamber } from '../zone-tiles.js';
import { DIRECTIONS_4 } from '../../map/geometry.js';
import { createDoor } from '../../entities/furniture.js';

export const DEFAULTS = { maxConnections: 1, maxGap: 6, spacing: 2 };

// The orthogonal L from a to b (horizontal leg then vertical), inclusive of both ends — 4-connected.
function lPath(a, b) {
  const tiles = [[a.x, a.y]];
  let x = a.x;
  let y = a.y;
  while (x !== b.x) {
    x += Math.sign(b.x - x);
    tiles.push([x, y]);
  }
  while (y !== b.y) {
    y += Math.sign(b.y - y);
    tiles.push([x, y]);
  }
  return tiles;
}

/** Runs the stitch stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const bounds = stageConfig.bounds ?? { x: 0, y: 0, w: level.width, h: level.height };
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const rooms = blackboard[LEVEL_ROOMS] ?? {};
  const maxConnections = Math.max(1, stageConfig.maxConnections ?? DEFAULTS.maxConnections);
  const maxGap = stageConfig.maxGap ?? DEFAULTS.maxGap;
  const spacing = stageConfig.spacing ?? DEFAULTS.spacing;

  const W = level.width;
  const idx = (x, y) => y * W + x;
  const isFloor = (x, y) => level.tiles[y]?.[x] === 'floor';

  // Connected floor components (4-connected); comp[tileIndex] = component id.
  const comp = new Map();
  let nComp = 0;
  for (let y = bounds.y; y < bounds.y + bounds.h; y++)
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      if (!isFloor(x, y) || comp.has(idx(x, y))) continue;
      const id = nComp++;
      const stack = [[x, y]];
      comp.set(idx(x, y), id);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        for (const [dx, dy] of DIRECTIONS_4) {
          const k = idx(cx + dx, cy + dy);
          if (isFloor(cx + dx, cy + dy) && !comp.has(k)) {
            comp.set(k, id);
            stack.push([cx + dx, cy + dy]);
          }
        }
      }
    }
  if (nComp <= 1) return; // already connected

  // Map room tiles (chamber zones only) to their zone id, and gather the frontier ones (next to wall).
  const zoneOf = new Map();
  for (const z of zones)
    if (isChamber(z)) for (const [x, y] of roomTiles(z, rooms)) zoneOf.set(idx(x, y), z.id);
  const frontier = [];
  for (const [tile, zid] of zoneOf) {
    if (!comp.has(tile)) continue; // room tile outside the stitched bounds
    const x = tile % W;
    const y = (tile - x) / W;
    if (DIRECTIONS_4.some(([dx, dy]) => !isFloor(x + dx, y + dy)))
      frontier.push({ x, y, zone: zid, comp: comp.get(tile) });
  }

  // Candidate connections: frontier room-tile pairs in different components within maxGap, shortest
  // first (ties by tile index) so selection is deterministic.
  const candidates = [];
  for (let i = 0; i < frontier.length; i++)
    for (let j = i + 1; j < frontier.length; j++) {
      const a = frontier[i];
      const b = frontier[j];
      if (a.comp === b.comp) continue;
      const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (d <= maxGap) candidates.push({ a, b, d });
    }
  candidates.sort(
    (p, q) =>
      p.d - q.d || idx(p.a.x, p.a.y) - idx(q.a.x, q.a.y) || idx(p.b.x, p.b.y) - idx(q.b.x, q.b.y),
  );

  // Union-find over components so we know which candidates still merge two sections.
  const parent = Array.from({ length: nComp }, (_, i) => i);
  const find = (r) => {
    while (parent[r] !== r) r = parent[r] = parent[parent[r]];
    return r;
  };
  let components = nComp;

  const carved = new Set(); // tile indices already on a connection (for overlap / spacing checks)
  const adjacency = (blackboard[LEVEL_ADJACENCY] ?? []).slice();
  const near = (tiles, dist) =>
    tiles.some(([x, y]) => {
      for (let oy = -dist; oy <= dist; oy++)
        for (let ox = -dist; ox <= dist; ox++) if (carved.has(idx(x + ox, y + oy))) return true;
      return false;
    });

  const connect = ({ a, b }) => {
    let door = null;
    for (const [x, y] of lPath(a, b)) {
      if (door == null && !isFloor(x, y)) door = [x, y]; // first dug (wall) tile of the gap
      if (level.tiles[y]?.[x] !== undefined) level.tiles[y][x] = 'floor';
      carved.add(idx(x, y));
    }
    if (door && registry) level.placeEntity(createDoor(registry, door[0], door[1]));
    if (a.zone !== b.zone) {
      const lo = Math.min(a.zone, b.zone);
      const hi = Math.max(a.zone, b.zone);
      if (!adjacency.some(([p, q]) => p === lo && q === hi)) adjacency.push([lo, hi]);
    }
    const ra = find(a.comp);
    const rb = find(b.comp);
    if (ra !== rb) {
      parent[ra] = rb;
      components--;
    }
  };

  let made = 0;
  for (const cand of candidates) {
    const merging = find(cand.a.comp) !== find(cand.b.comp);
    if (!merging && made >= maxConnections) continue; // connectivity is free; extras are capped
    const path = lPath(cand.a, cand.b);
    if (path.some(([x, y]) => carved.has(idx(x, y)))) continue; // overlap ⇒ crossing
    if (!merging && near(path, spacing)) continue; // keep extras visually separate
    connect(cand);
    made++;
    if (components === 1 && made >= maxConnections) break;
  }

  // Fallback: if the gap budget left components unconnected, force-connect the nearest room pair per
  // remaining split so the level is always fully connected.
  if (components > 1) {
    let guard = nComp;
    while (components > 1 && guard-- > 0) {
      let best = null;
      for (let i = 0; i < frontier.length; i++)
        for (let j = i + 1; j < frontier.length; j++) {
          const a = frontier[i];
          const b = frontier[j];
          if (find(a.comp) === find(b.comp)) continue;
          const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
          if (!best || d < best.d) best = { a, b, d };
        }
      if (!best) break;
      connect(best);
    }
  }

  blackboard[LEVEL_ADJACENCY] = adjacency;
}
