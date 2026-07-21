/**
 * @file Structure stage: cordons off rectangles for a *later* stage to fill. Publishes
 * `level:reserved`; organic generators (`caSeed`/`caSmooth`) keep reserved cells as wall, so a cave can
 * be grown around a hole that a BSP section then fills (and `stitch` joins). See
 * docs/design/organic-map-generation.md (§ composition).
 *
 * Stage parameters:
 *   rects — [{x,y,w,h}] rectangles to reserve (appended to anything already reserved).
 *
 * Blackboard: appends to level:reserved.
 */
import { LEVEL_RESERVED } from '../blackboard-keys.js';

/** Whether (x, y) falls inside any of the reserved rects. The single definition consumers share. */
export const isReserved = (x, y, rects) =>
  rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

/** Runs the reserve stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard) {
  const rects = stageConfig.rects ?? [];
  blackboard[LEVEL_RESERVED] = [...(blackboard[LEVEL_RESERVED] ?? []), ...rects];
}
