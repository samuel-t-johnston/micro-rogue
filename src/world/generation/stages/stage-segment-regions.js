/**
 * @file Structure stage: infers regions from a finished organic level's geometry — the segmentation
 * that "CA earns" (a cave has no moment during generation where a chamber could be tagged). Produces
 * the same zone/room contract that BSP tags at source, so population and finishing run unchanged. Last
 * structure stage of the CA pipeline. See docs/design/organic-map-generation.md and ADR-027.
 *
 * Algorithm (pure — consumes no RNG, tie-breaks by tile index):
 *   1. Chebyshev distance transform: D(x,y) = distance from each floor tile to the nearest wall (0 on
 *      walls). Two chamfer sweeps, O(tiles). A 1-wide neck has D=1; a cavern centre D=4+.
 *   2. Watershed the *chamber* floor (everything but the dug passage tiles below), in descending D. A
 *      tile with no labelled neighbour starts a region (a local maximum / core); otherwise it joins
 *      its neighbours'. A tile that first connects two basins is a **saddle**: merge them unless the
 *      shallower peak clears the saddle by more than `prominence` (keep separate iff min(peakA,peakB) −
 *      S > prominence). One integer decides whether a lumpy cavern reads as one chamber or several, and
 *      a spurious peak from a wall nub (near-zero prominence) is eaten on the first pass — no separate
 *      denoising. Saddle tiles are **divides**: they don't propagate a region (else a basin bleeds
 *      through a neck into its neighbour), and are assigned to a region only afterward.
 *   3. Passages: tiles a digger dug (`level:passageTiles`, from caBridge) are held out of the watershed
 *      so a deliberate bridge never merges the chambers it joins, then emitted as their own `passage`
 *      regions (their connected components). A watershed basin whose own peak never clears
 *      `passageThreshold` is likewise thin connective tissue, so it's a passage too.
 *
 * Region adjacencies (regions whose tiles touch) become `level:adjacency`; the narrowest (lowest-D)
 * boundary tile of each pair becomes a `level:chokepoint` (door / ambush candidate).
 *
 * Stage parameters (all optional):
 *   prominence       — saddle depth (in D units) that keeps two chambers distinct (default 0, tuned
 *                      against rendered CA output; a digger's smoother field may want more). The one
 *                      knob that matters, so it's per-stage.
 *   passageThreshold — a chamber basin with peak D ≤ this is tagged `passage`, not `chamber` (default 1).
 *
 * Blackboard:
 *   reads  level:bounds, level:passageTiles, tiles
 *   writes level:zones (kind chamber|passage, origin 'inferred'), level:rooms ("id,0" -> {tiles, rect,
 *          core}), level:adjacency ([[a,b]]), level:chokepoints ([{x,y,width}]).
 */
import { LEVEL_BOUNDS, LEVEL_PASSAGE_TILES } from '../blackboard-keys.js';
import { appendZones } from '../zone-tiles.js';
import { DIRECTIONS_4, DIRECTIONS_8 } from '../../map/geometry.js';

const DEFAULTS = { prominence: 0, passageThreshold: 1 };

// Backward / forward neighbour sets for the two chamfer sweeps (raster order).
const BACK = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
];
const FWD = [
  [1, 1],
  [0, 1],
  [-1, 1],
  [1, 0],
];

/**
 * Chebyshev distance from each floor tile to the nearest wall (0 on walls / outside the region), by
 * two chamfer sweeps. Walls and out-of-region count as 0, so floor next to either gets D=1. Exported
 * for testing.
 */
export function distanceTransform(level, bounds) {
  const big = level.width + level.height;
  const x1 = bounds.x + bounds.w;
  const y1 = bounds.y + bounds.h;
  const isFloor = (x, y) => level.tiles[y]?.[x] === 'floor';
  const inRegion = (x, y) => x >= bounds.x && x < x1 && y >= bounds.y && y < y1;
  const D = Array.from({ length: level.height }, () => new Array(level.width).fill(0));
  const get = (x, y) => (inRegion(x, y) ? D[y][x] : 0);

  for (let y = bounds.y; y < y1; y++)
    for (let x = bounds.x; x < x1; x++) D[y][x] = isFloor(x, y) ? big : 0;
  for (let y = bounds.y; y < y1; y++)
    for (let x = bounds.x; x < x1; x++) {
      if (!isFloor(x, y)) continue;
      let m = D[y][x];
      for (const [dx, dy] of BACK) m = Math.min(m, get(x + dx, y + dy) + 1);
      D[y][x] = m;
    }
  for (let y = y1 - 1; y >= bounds.y; y--)
    for (let x = x1 - 1; x >= bounds.x; x--) {
      if (!isFloor(x, y)) continue;
      let m = D[y][x];
      for (const [dx, dy] of FWD) m = Math.min(m, get(x + dx, y + dy) + 1);
      D[y][x] = m;
    }
  return D;
}

/** Runs the segment-regions stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard) {
  const bounds = blackboard[LEVEL_BOUNDS] ?? { x: 0, y: 0, w: level.width, h: level.height };
  const prominence = stageConfig.prominence ?? DEFAULTS.prominence;
  const passageThreshold = stageConfig.passageThreshold ?? DEFAULTS.passageThreshold;
  const W = level.width;
  const idx = (x, y) => y * W + x;

  const D = distanceTransform(level, bounds);

  // Passage tiles: the connective tissue a digger carved (caBridge). They're excluded from the chamber
  // watershed — treated as barriers — so a deliberate bridge never merges the two chambers it joins;
  // each dug run becomes its own `passage` region below. `prominence` then only splits genuinely lumpy
  // caverns. Absent (e.g. a pure-CA level with no bridges, or an audit over BSP) it's a plain watershed.
  const passageList = (blackboard[LEVEL_PASSAGE_TILES] ?? []).filter(
    ([x, y]) => level.tiles[y]?.[x] === 'floor',
  );
  const passageSet = new Set(passageList.map(([x, y]) => idx(x, y)));

  // Chamber floor (everything but the passages), deepest first; ties by tile index so the watershed is
  // a pure function of geometry.
  const floors = [];
  for (let y = bounds.y; y < bounds.y + bounds.h; y++)
    for (let x = bounds.x; x < bounds.x + bounds.w; x++)
      if (level.tiles[y][x] === 'floor' && !passageSet.has(idx(x, y))) floors.push([x, y]);
  floors.sort((a, b) => D[b[1]][b[0]] - D[a[1]][a[0]] || idx(a[0], a[1]) - idx(b[0], b[1]));

  // Union-find over region ids, each root carrying its peak D.
  const parent = [];
  const peak = [];
  const find = (r) => {
    while (parent[r] !== r) r = parent[r] = parent[parent[r]];
    return r;
  };
  const union = (a, b) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (peak[ra] < peak[rb] || (peak[ra] === peak[rb] && ra > rb)) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    peak[ra] = Math.max(peak[ra], peak[rb]);
  };

  // label: -1 unset, >=0 a region root, BOUNDARY a watershed divide (assigned to a region only at the
  // end, and crucially never propagated — otherwise a basin bleeds through a neck into its neighbour).
  const BOUNDARY = -2;
  const label = Array.from({ length: level.height }, () => new Array(W).fill(-1));
  const boundaryTiles = []; // divide tiles, assigned to a region only at the end
  for (const [x, y] of floors) {
    const regionRoots = [];
    let touchesBoundary = false;
    for (const [dx, dy] of DIRECTIONS_8) {
      const l = label[y + dy]?.[x + dx];
      if (l == null || l === -1) continue;
      if (l === BOUNDARY) touchesBoundary = true;
      else regionRoots.push(find(l));
    }
    const uniq = [...new Set(regionRoots)];
    if (uniq.length === 0) {
      // A tile touching only divide/unlabelled is itself part of the divide; otherwise it's a peak.
      if (touchesBoundary) {
        label[y][x] = BOUNDARY;
        boundaryTiles.push([x, y]);
      } else {
        const id = parent.length;
        parent.push(id);
        peak.push(D[y][x]);
        label[y][x] = id;
      }
      continue;
    }
    // First contact between two basins is their highest saddle; merge if the shallower peak doesn't
    // clear it by more than `prominence`.
    for (let i = 0; i < uniq.length; i++)
      for (let j = i + 1; j < uniq.length; j++) {
        const ri = find(uniq[i]);
        const rj = find(uniq[j]);
        if (ri !== rj && Math.min(peak[ri], peak[rj]) - D[y][x] <= prominence) union(ri, rj);
      }
    const roots = [...new Set(uniq.map(find))];
    if (roots.length === 1) {
      label[y][x] = roots[0];
    } else {
      label[y][x] = BOUNDARY;
      boundaryTiles.push([x, y]);
    }
  }

  // Resolve divide tiles into a region for the tile lists — outside-in (recorded deepest first), each
  // joining its highest-peak already-resolved neighbour. Thin divides converge in a pass or two.
  let pending = boundaryTiles.slice();
  while (pending.length) {
    const still = [];
    for (const [x, y] of pending) {
      let best = -1;
      for (const [dx, dy] of DIRECTIONS_8) {
        const l = label[y + dy]?.[x + dx];
        if (l == null || l < 0) continue;
        const r = find(l);
        if (best === -1 || peak[r] > peak[best] || (peak[r] === peak[best] && r < best)) best = r;
      }
      if (best === -1) still.push([x, y]);
      else label[y][x] = best;
    }
    if (still.length === pending.length) break;
    pending = still;
  }

  // A region from a tile list: its bounding rect and its deepest tile (the core — a strictly-interior
  // anchor for stairs/spawn), plus the peak D that decides chamber vs passage.
  const makeRegion = (tiles) => {
    let core = tiles[0];
    let coreD = -1;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of tiles) {
      if (D[y][x] > coreD || (D[y][x] === coreD && idx(x, y) < idx(core[0], core[1]))) {
        coreD = D[y][x];
        core = [x, y];
      }
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return { tiles, core, peak: coreD, rect: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
  };

  // Chamber regions: the watershed basins (over non-passage floor). A basin whose peak never clears
  // `passageThreshold` is itself thin connective tissue, so it's a passage too.
  const byRoot = new Map();
  for (const [x, y] of floors) {
    if (label[y][x] < 0) continue; // an isolated divide tile that never resolved (shouldn't happen)
    const r = find(label[y][x]);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push([x, y]);
  }
  const chamberRegions = [...byRoot.values()].map((tiles) => {
    const r = makeRegion(tiles);
    r.kind = r.peak <= passageThreshold ? 'passage' : 'chamber';
    return r;
  });

  // Passage regions: the connected components (8-connected) of the dug tiles.
  const passageRegions = connectedComponents(passageList).map((tiles) => {
    const r = makeRegion(tiles);
    r.kind = 'passage';
    return r;
  });

  // Stable zone ids by core position (row-major), like BSP numbers its rooms.
  const regions = [...chamberRegions, ...passageRegions];
  regions.sort((a, b) => idx(a.core[0], a.core[1]) - idx(b.core[0], b.core[1]));
  regions.forEach((r, id) => {
    r.id = id;
  });

  const zoneOf = new Map(); // tile index -> zone id
  const zones = [];
  const rooms = {};
  for (const r of regions) {
    for (const [x, y] of r.tiles) zoneOf.set(idx(x, y), r.id);
    zones.push({
      id: r.id,
      cells: [[r.id, 0]],
      rect: r.rect,
      labels: r.kind === 'chamber' ? ['room'] : ['passage'],
      kind: r.kind,
      origin: 'inferred',
    });
    rooms[`${r.id},0`] = { tiles: r.tiles, rect: r.rect, core: r.core };
  }

  // Adjacency + chokepoints: scan every floor tile's orthogonal neighbours (raster order, so ties are
  // deterministic). Regions that touch are adjacent; the narrowest (lowest-D) boundary tile of a pair
  // is its chokepoint — the natural door / ambush spot.
  const narrowest = new Map(); // "a,b" -> { x, y, d }
  for (let y = bounds.y; y < bounds.y + bounds.h; y++)
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      const a = zoneOf.get(idx(x, y));
      if (a == null) continue;
      for (const [dx, dy] of DIRECTIONS_4) {
        const b = zoneOf.get(idx(x + dx, y + dy));
        if (b == null || b === a) continue;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        const cur = narrowest.get(key);
        if (!cur || D[y][x] < cur.d) narrowest.set(key, { x, y, d: D[y][x] });
      }
    }
  const adjacency = [...narrowest.keys()]
    .map((k) => k.split(',').map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const chokepoints = [...narrowest.values()]
    .map((c) => ({ x: c.x, y: c.y, width: Math.max(1, 2 * c.d - 1) }))
    .sort((a, b) => idx(a.x, a.y) - idx(b.x, b.y));

  appendZones(blackboard, { zones, rooms, adjacency, chokepoints, section: stageConfig.section });
}

// Connected components (8-connected) of a tile list.
function connectedComponents(tiles) {
  const key = (x, y) => `${x},${y}`;
  const members = new Set(tiles.map(([x, y]) => key(x, y)));
  const seen = new Set();
  const comps = [];
  for (const [sx, sy] of tiles) {
    if (seen.has(key(sx, sy))) continue;
    const comp = [];
    const stack = [[sx, sy]];
    seen.add(key(sx, sy));
    while (stack.length) {
      const [x, y] = stack.pop();
      comp.push([x, y]);
      for (const [dx, dy] of DIRECTIONS_8) {
        const k = key(x + dx, y + dy);
        if (members.has(k) && !seen.has(k)) {
          seen.add(k);
          stack.push([x + dx, y + dy]);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}
