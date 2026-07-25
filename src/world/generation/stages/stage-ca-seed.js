/**
 * @file Structure stage: seeds a cellular-automata level with random wall/floor noise — the raw input
 * `caSmooth` shapes into caves. First stage of the CA pipeline; see docs/design/organic-map-generation.md.
 *
 * Owns the tile grid when none exists yet (standalone): sizes it to `level:bounds` and fills it. When
 * `level.tiles` is already populated it seeds in place (embedded — another stage built the enclosing
 * box). The region border is forced to wall so caves never open onto the level edge.
 *
 * Stage parameters (all optional):
 *   width, height — grid size in tiles (default 48 × 32). Ignored if bounds.
 *   bounds        — {x,y,w,h}: seed within this sub-rectangle of a larger, in-progress level.
 *   wallChance    — P(an interior tile starts as wall) (default 0.62). The ≥5 smoothing rule erodes a
 *                   wall minority, so walls must start in the majority to survive: ~0.55 leaves one
 *                   dominant cavern plus specks, ~0.62 breaks into several distinct caverns (~⅓ floor),
 *                   and much above ~0.64 the caves get cramped and twisty. Tune per pipeline.
 *
 * Reserved rects (`level:reserved`, from the `reserve` stage) are held as wall, so the cave grows
 * around a hole a later section fills.
 *
 * Blackboard:
 *   reads  level:reserved
 *   writes tiles; level:bounds -> { x, y, w, h } (so the rest of the CA pipeline knows the region).
 */
import { LEVEL_BOUNDS, LEVEL_RESERVED } from '../blackboard-keys.js';
import { isReserved } from './stage-reserve.js';

export const DEFAULTS = { width: 48, height: 32, wallChance: 0.62 };

/** Runs the CA seed stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng) {
  const bounds = stageConfig.bounds ?? {
    x: 0,
    y: 0,
    w: stageConfig.width ?? DEFAULTS.width,
    h: stageConfig.height ?? DEFAULTS.height,
  };
  const wallChance = stageConfig.wallChance ?? DEFAULTS.wallChance;
  const reserved = blackboard[LEVEL_RESERVED] ?? [];

  if (!level.tiles.length) {
    level.width = bounds.x + bounds.w;
    level.height = bounds.y + bounds.h;
    level.tiles = Array.from({ length: level.height }, () =>
      Array.from({ length: level.width }, () => 'wall'),
    );
  }

  const onBorder = (x, y) =>
    x === bounds.x ||
    x === bounds.x + bounds.w - 1 ||
    y === bounds.y ||
    y === bounds.y + bounds.h - 1;

  for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
      if (level.tiles[y]?.[x] === undefined) continue;
      level.tiles[y][x] =
        onBorder(x, y) || isReserved(x, y, reserved) || rng.random() < wallChance
          ? 'wall'
          : 'floor';
    }
  }

  blackboard[LEVEL_BOUNDS] = bounds;
}
