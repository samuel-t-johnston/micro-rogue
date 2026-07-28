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
 * **Protected footprints and connectors** (a static block embedded via the `static` stage). A rect in
 * `level:protected` is never carved through, so an authored area's content stays intact; such a block
 * is therefore joined *only* through the floor tiles it lists in `level:connectors` (its own frontier is
 * excluded), and a connector join is never doored — the static side owns its opening. A connection
 * carves the shorter of the two L-orientations, and when both would cut a protected block it falls back
 * to a BFS route around it (any number of segments); a component with endpoints that still can't be
 * routed is warned about (a sealed block with no connectors is silent — that's an intentional vault).
 * Zone adjacency across a connection is recorded to `level:adjacency` (connector joins carry no zone).
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
 * Blackboard: reads level:zones, level:rooms, level:connectors, level:protected; writes tiles +
 * level:adjacency; places doors.
 */
import {
  LEVEL_ZONES,
  LEVEL_ROOMS,
  LEVEL_ADJACENCY,
  LEVEL_CONNECTORS,
  LEVEL_PROTECTED,
} from '../blackboard-keys.js';
import { roomTiles, isChamber } from '../zone-tiles.js';
import { DIRECTIONS_4 } from '../../map/geometry.js';
import { createDoor } from '../../entities/furniture.js';

export const DEFAULTS = { maxConnections: 1, maxGap: 6, spacing: 2 };

// The orthogonal L from a to b, inclusive of both ends (4-connected). `vertical` runs the vertical leg
// first; the default horizontal-first matches the original single-orientation path, so unprotected
// levels carve exactly as before — the transpose is only tried to route around a protected footprint.
function lPath(a, b, vertical = false) {
  const tiles = [[a.x, a.y]];
  let x = a.x;
  let y = a.y;
  const stepX = () => {
    while (x !== b.x) {
      x += Math.sign(b.x - x);
      tiles.push([x, y]);
    }
  };
  const stepY = () => {
    while (y !== b.y) {
      y += Math.sign(b.y - y);
      tiles.push([x, y]);
    }
  };
  if (vertical) {
    stepY();
    stepX();
  } else {
    stepX();
    stepY();
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
  const protectedRects = blackboard[LEVEL_PROTECTED] ?? [];
  const connectorTiles = blackboard[LEVEL_CONNECTORS] ?? [];

  const W = level.width;
  const idx = (x, y) => y * W + x;
  const isFloor = (x, y) => level.tiles[y]?.[x] === 'floor';
  const isProtected = (x, y) =>
    protectedRects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const connectorSet = new Set(connectorTiles.map(([x, y]) => idx(x, y)));

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
    if (isProtected(x, y)) continue; // a protected (static) block exposes only its connectors, below
    if (DIRECTIONS_4.some(([dx, dy]) => !isFloor(x + dx, y + dy)))
      frontier.push({ x, y, zone: zid, comp: comp.get(tile) });
  }
  // Authored connectors are the only endpoints on a protected block; they carry no zone, and a
  // connector join is never doored (the static side owns its opening).
  for (const [x, y] of connectorTiles) {
    const tile = idx(x, y);
    if (comp.has(tile)) frontier.push({ x, y, zone: null, comp: comp.get(tile), connector: true });
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

  // A tile stitch is free to carve through: inside the stitched bounds and not a protected footprint
  // (a connector is exempt — it's the sanctioned opening). Walls are carvable; only protected blocks
  // are obstacles, so this is also what the BFS fallback pathfinds over.
  const carvable = (x, y) =>
    x >= bounds.x &&
    x < bounds.x + bounds.w &&
    y >= bounds.y &&
    y < bounds.y + bounds.h &&
    !(isProtected(x, y) && !connectorSet.has(idx(x, y)));

  // A breadth-first path from a to b over carvable tiles (4-connected, deterministic), for a connection
  // that must route around a protected footprint with more than two segments. Returns null if no such
  // path exists (a connector boxed in with no way out).
  const bfsPath = (a, b) => {
    if (!carvable(a.x, a.y) || !carvable(b.x, b.y)) return null;
    const goal = idx(b.x, b.y);
    const prev = new Map([[idx(a.x, a.y), -1]]);
    const queue = [idx(a.x, a.y)];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      if (cur === goal) break;
      const cx = cur % W;
      const cy = (cur - cx) / W;
      for (const [dx, dy] of DIRECTIONS_4) {
        const nx = cx + dx;
        const ny = cy + dy;
        const nk = idx(nx, ny);
        if (carvable(nx, ny) && !prev.has(nk)) {
          prev.set(nk, cur);
          queue.push(nk);
        }
      }
    }
    if (!prev.has(goal)) return null;
    const path = [];
    for (let k = goal; k !== -1; k = prev.get(k)) path.push([k % W, (k - (k % W)) / W]);
    return path.reverse();
  };

  // The path to carve for a connection. Horizontal-first L, then the transposed L (so protection-free
  // levels carve exactly as before), then a BFS route around a protected footprint; null only when even
  // BFS finds no carvable path. A connector tile on the path is allowed — it's the sanctioned opening.
  const blockedPath = (path) =>
    path.some(([x, y]) => isProtected(x, y) && !connectorSet.has(idx(x, y)));
  const routeOf = (a, b) => {
    const h = lPath(a, b);
    if (!blockedPath(h)) return h;
    const v = lPath(a, b, true);
    if (!blockedPath(v)) return v;
    return bfsPath(a, b);
  };

  const connect = ({ a, b }, path) => {
    let door = null;
    for (const [x, y] of path) {
      if (door == null && !isFloor(x, y)) door = [x, y]; // first dug (wall) tile of the gap
      if (level.tiles[y]?.[x] !== undefined) level.tiles[y][x] = 'floor';
      carved.add(idx(x, y));
    }
    // A connector join is never doored — the static side owns its opening's door treatment.
    if (door && registry && !a.connector && !b.connector)
      level.placeEntity(createDoor(registry, door[0], door[1]));
    if (a.zone != null && b.zone != null && a.zone !== b.zone) {
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
    const path = routeOf(cand.a, cand.b);
    if (!path) continue; // no route that spares the protected footprint
    if (path.some(([x, y]) => carved.has(idx(x, y)))) continue; // overlap ⇒ crossing
    if (!merging && near(path, spacing)) continue; // keep extras visually separate
    connect(cand, path);
    made++;
    if (components === 1 && made >= maxConnections) break;
  }

  // Fallback: if the gap budget left components unconnected, force-connect the nearest routeable pair
  // per remaining split so the level is always fully connected (short of a fully-sealed component).
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
          if (best && d >= best.d) continue;
          const path = routeOf(a, b);
          if (path) best = { a, b, d, path };
        }
      if (!best) break;
      connect({ a: best.a, b: best.b }, best.path);
    }
  }

  // Anything still split that *has* endpoints was connectable but couldn't be routed — a loud bug
  // (a sealed block with no endpoints is excluded, so an intentional hidden vault stays quiet).
  const strandedRoots = new Set(frontier.map((f) => find(f.comp)));
  if (strandedRoots.size > 1) {
    console.warn(
      `[stitch] ${strandedRoots.size} connectable sections left unjoined (no carvable route)`,
    );
  }

  blackboard[LEVEL_ADJACENCY] = adjacency;
}
