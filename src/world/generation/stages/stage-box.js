/**
 * @file Structure stage: lays down the full-map grid as solid wall and publishes it as `level:bounds`.
 * It's the "canvas" that composition needs — with the whole grid established up front, later structure
 * stages can each carve their own `bounds` sub-rectangle into it (a BSP wing here, a cave there)
 * instead of one stage owning and sizing the grid. A single-section pipeline doesn't need it (the
 * structure stage sizes the grid itself). See docs/design/organic-map-generation.md (§ composition).
 *
 * Stage parameters (all optional):
 *   width, height — full map size in tiles (default 48 × 32).
 *
 * Blackboard: writes level:bounds -> { x: 0, y: 0, w: width, h: height }; fills level.tiles with wall.
 */
import { LEVEL_BOUNDS } from '../blackboard-keys.js';

export const DEFAULTS = { width: 48, height: 32 };

/** Runs the box stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard) {
  const width = stageConfig.width ?? DEFAULTS.width;
  const height = stageConfig.height ?? DEFAULTS.height;
  level.width = width;
  level.height = height;
  level.tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => 'wall'));
  blackboard[LEVEL_BOUNDS] = { x: 0, y: 0, w: width, h: height };
}
