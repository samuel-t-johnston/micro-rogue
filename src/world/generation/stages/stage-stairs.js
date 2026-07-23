/**
 * @file Finishing stage: places stairs furniture in their labelled rooms. The stairs carry a
 * `transition` with a null destination — the transit map wires ports to destinations at travel time.
 * See docs/design/procedural-3x3-dungeon.md and docs/howto/dungeon-layout.md.
 *
 * Stage parameters (optional):
 *   stairs — [[label, direction], …] pairs to place (default up + down). A leaf/branch floor can pass
 *            e.g. `[['stairs-up','up']]` to place only an up-stair. Each direction becomes the stair's
 *            port; the transit map keys its edges off those port names.
 */
import { createStairs } from '../../entities/furniture.js';
import { centermostRoomTile } from '../zone-tiles.js';
import { LEVEL_ZONES, LEVEL_ROOMS } from '../blackboard-keys.js';

export const DEFAULTS = {
  stairs: [
    ['stairs-up', 'up'],
    ['stairs-down', 'down'],
  ],
};

/** Runs the stairs finishing stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const rooms = blackboard[LEVEL_ROOMS] ?? {};

  for (const [label, dir] of stageConfig.stairs ?? DEFAULTS.stairs) {
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
