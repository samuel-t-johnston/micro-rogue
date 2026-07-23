/**
 * @file Structure stage: smooths CA noise (`caSeed`) into cave shapes with the classic majority rule —
 * a tile becomes wall if at least `wallThreshold` of its 8 neighbours are wall, iterated a few times.
 * Second stage of the CA pipeline; see docs/design/organic-map-generation.md.
 *
 * Pure and deterministic — consumes no RNG. Each iteration reads a snapshot and writes the whole region
 * synchronously (no in-place bleed). Out-of-region neighbours count as wall, and the region border is
 * held to wall, so caves stay closed at the edge. Fixed iteration count keeps this O(tiles).
 *
 * Stage parameters (all optional):
 *   iterations    — smoothing passes (default 4; 5–6 over-rounds and closes the necks segmentation
 *                   later looks for).
 *   wallThreshold — wall-neighbour count that turns a tile to wall (default 5).
 *
 * Reserved cells (`level:reserved`) are held to wall, matching `caSeed`, so the hole persists through
 * smoothing.
 *
 * Blackboard: reads level:bounds, level:reserved; writes tiles.
 *
 * Note: this currently only uses a "birth" threshold (wallThreshold) and not a "death" threshold (floorThreshold).
 * This could be added as an additional knob to allow for more control over the smoothing process.
 */
import { LEVEL_BOUNDS, LEVEL_RESERVED } from '../blackboard-keys.js';
import { isReserved } from './stage-reserve.js';
import { DIRECTIONS_8 } from '../../map/geometry.js';

export const DEFAULTS = { iterations: 4, wallThreshold: 5 };

/** Runs the CA smooth stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard) {
  const bounds = blackboard[LEVEL_BOUNDS] ?? { x: 0, y: 0, w: level.width, h: level.height };
  const iterations = stageConfig.iterations ?? DEFAULTS.iterations;
  const threshold = stageConfig.wallThreshold ?? DEFAULTS.wallThreshold;
  const reserved = blackboard[LEVEL_RESERVED] ?? [];

  const inside = (x, y) =>
    x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
  const onBorder = (x, y) =>
    x === bounds.x ||
    x === bounds.x + bounds.w - 1 ||
    y === bounds.y ||
    y === bounds.y + bounds.h - 1;

  for (let it = 0; it < iterations; it++) {
    const src = level.tiles.map((row) => row.slice());
    const isWall = (x, y) => !inside(x, y) || src[y][x] === 'wall';
    for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
        if (onBorder(x, y) || isReserved(x, y, reserved)) {
          level.tiles[y][x] = 'wall';
          continue;
        }
        let walls = 0;
        for (const [dx, dy] of DIRECTIONS_8) if (isWall(x + dx, y + dy)) walls++;
        level.tiles[y][x] = walls >= threshold ? 'wall' : 'floor';
      }
    }
  }
}
