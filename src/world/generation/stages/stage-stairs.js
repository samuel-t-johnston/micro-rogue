/**
 * @file Finishing stage: places the up/down stairs furniture in their labelled rooms. The stairs
 * carry a `transition` with a null destination — a coordinator wires it once multi-floor levels exist.
 * See docs/design/procedural-3x3-dungeon.md.
 */
import { createStairs } from '../../furniture.js';
import { centermostRoomTile } from '../zone-tiles.js';

/** Runs the stairs finishing stage (see the file overview). */
export function run(level, stageConfig, blackboard, rng, registry) {
  const zones = blackboard['level:zones'] ?? [];
  const rooms = blackboard['level:rooms'] ?? {};

  for (const [label, dir] of [
    ['stairs-up', 'up'],
    ['stairs-down', 'down'],
  ]) {
    const zone = zones.find((z) => z.labels.includes(label));
    if (!zone) {
      console.warn(`[stairs] no ${label} zone; skipping`);
      continue;
    }
    const tile = centermostRoomTile(zone, rooms);
    if (!tile) {
      console.warn(`[stairs] ${label} zone has no room; skipping`);
      continue;
    }
    level.placeEntity(createStairs(registry, tile[0], tile[1], dir));
  }
}
