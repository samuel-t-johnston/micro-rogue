// Finishing stage: places the up/down stairs furniture in their labelled rooms. The stairs carry a
// `transition` with a null destination — a coordinator wires it once multi-floor levels exist.
// See docs/design/procedural-3x3-dungeon.md.
import { createStairs } from '../../furniture.js';
import { centermostFloor } from '../zone-tiles.js';

export function run(level, stageConfig, blackboard, rng, registry) {
  const zones = blackboard['level:zones'] ?? [];
  const cs = blackboard['level:grid']?.cellSize ?? 10;

  for (const [label, dir] of [['stairs-up', 'up'], ['stairs-down', 'down']]) {
    const zone = zones.find(z => z.labels.includes(label));
    if (!zone) { console.warn(`[stairs] no ${label} zone; skipping`); continue; }
    const tile = centermostFloor(level, zone, cs);
    if (!tile) { console.warn(`[stairs] ${label} zone has no floor; skipping`); continue; }
    level.placeEntity(createStairs(registry, tile[0], tile[1], dir));
  }
}
