/**
 * @file Structure stage: makes a smoothed CA level (`caSmooth`) fully connected. Finds the floor
 * components, discards the small ones, and bridges the survivors so the level is traversable. Third
 * stage of the CA pipeline, before `segmentRegions`. See docs/design/organic-map-generation.md.
 *
 * Bridges are carved with the shared goal-biased walker at high `sobriety`, so they read as deliberate
 * tunnels rather than wander. The bridge graph is a Euclidean MST over the survivors' representative
 * tiles — minimal total tunnelling — and, like the walker's own guarantee, every bridge arrives, so
 * the result is one connected region. Bridges are plain floor (no zones); `segmentRegions` later reads
 * them as `passage` from their width.
 *
 * Runs before segmentation: segment first and the bridges arrive with no region assignment and the
 * region graph is silently wrong.
 *
 * Complexity is O(tiles) for the raster work (component find, prune, representatives read each
 * component's *own* tiles, never all tiles per component) plus O(survivors²) for the small MST — see
 * ADR-028 and the op-count test beside this file.
 *
 * Stage parameters (all optional):
 *   minComponentSize — floor components smaller than this are pruned to wall (default 30). The single
 *                      largest is always kept, so the level is never wiped.
 *   sobriety         — bridge walker P(step toward target) (default 0.85 — bridges read as deliberate).
 *   momentum         — bridge walker P(repeat heading) on a wander step (default 0.5).
 *   maxStepsFactor   — bridge walker step budget multiple before its straight-line fallback (default 4).
 *
 * Blackboard: reads level:bounds; writes tiles.
 */
import { LEVEL_BOUNDS, LEVEL_PASSAGE_TILES } from '../blackboard-keys.js';
import { DIRECTIONS_4, euclideanMst, squaredDistance } from '../../map/geometry.js';
import { carveWalk } from '../walk.js';

const DEFAULTS = { minComponentSize: 30, sobriety: 0.85, momentum: 0.5, maxStepsFactor: 4 };

// The floor tile of a component nearest its centroid — a guaranteed-interior bridge endpoint (a raw
// centroid can land on wall in a bent component). Reads only the component's own tiles.
function representative(tiles) {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of tiles) {
    sx += x;
    sy += y;
  }
  const centroid = { x: sx / tiles.length, y: sy / tiles.length };
  let best = tiles[0];
  let bestD = Infinity;
  for (const [x, y] of tiles) {
    const d = squaredDistance({ x, y }, centroid);
    if (d < bestD) {
      bestD = d;
      best = [x, y];
    }
  }
  return { x: best[0], y: best[1] };
}

/** Runs the CA bridge stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const bounds = blackboard[LEVEL_BOUNDS] ?? { x: 0, y: 0, w: level.width, h: level.height };
  const minSize = stageConfig.minComponentSize ?? DEFAULTS.minComponentSize;
  const opts = {
    sobriety: stageConfig.sobriety ?? DEFAULTS.sobriety,
    momentum: stageConfig.momentum ?? DEFAULTS.momentum,
    maxStepsFactor: stageConfig.maxStepsFactor ?? DEFAULTS.maxStepsFactor,
  };

  const isFloor = (x, y) => level.tiles[y]?.[x] === 'floor';

  // Connected floor components (4-connected) within the region, each collected as its tile list.
  const seen = new Set();
  const components = [];
  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      const k = `${x},${y}`;
      if (!isFloor(x, y) || seen.has(k)) continue;
      const tiles = [];
      const stack = [[x, y]];
      seen.add(k);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        tiles.push([cx, cy]);
        for (const [dx, dy] of DIRECTIONS_4) {
          const nx = cx + dx;
          const ny = cy + dy;
          const nk = `${nx},${ny}`;
          if (isFloor(nx, ny) && !seen.has(nk)) {
            seen.add(nk);
            stack.push([nx, ny]);
          }
        }
      }
      components.push(tiles);
    }
  }
  if (components.length === 0) return;

  // Keep components at or above the size floor; if none qualify, keep the single largest so the level
  // is never wiped. Prune the rest to wall.
  components.sort((a, b) => b.length - a.length);
  let keepers = components.filter((c) => c.length >= minSize);
  if (keepers.length === 0) keepers = [components[0]];
  const kept = new Set(keepers);
  for (const comp of components) {
    if (!kept.has(comp)) for (const [x, y] of comp) level.tiles[y][x] = 'wall';
  }
  if (keepers.length < 2) return;

  // Bridge the survivors along an MST of their representatives; each bridge arrives in its target. The
  // tiles a bridge digs (not the existing floor it passes through) are the level's connective tissue —
  // published so segmentRegions can tag them `passage`.
  const reps = keepers.map(representative);
  const passageTiles = blackboard[LEVEL_PASSAGE_TILES] ?? [];
  for (const { a, b } of euclideanMst(reps)) {
    const targetTiles = new Set(keepers[b].map(([x, y]) => `${x},${y}`));
    passageTiles.push(...carveWalk(level, reps[a], reps[b], targetTiles, opts, rng));
  }
  blackboard[LEVEL_PASSAGE_TILES] = passageTiles;
}
