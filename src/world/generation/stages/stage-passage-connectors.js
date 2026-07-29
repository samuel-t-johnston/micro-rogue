/**
 * @file Structure stage: exposes passage tissue as `stitch` connectors, so a district that is only
 * connective corridor — a `kind:'passage'` zone with no chamber — can still be joined to the rest of
 * the level. `stitch` deliberately ignores passages by default (they read as tunnels, not rooms, so a
 * corridor-only component is otherwise stranded), so this is **opt-in**: a pipeline adds it only when it
 * wants passage tissue connectable, and pipelines that don't are unchanged. It reuses the connector
 * mechanism the static stage introduced (see docs/howto/static-map-layouts.md and
 * docs/design/organic-map-generation.md) — a connector join carries no door or zone adjacency.
 *
 * Stage parameters (optional):
 *   section — restrict to passages of this district id (default all). Passage zones carry the `section`
 *             `segmentRegions` stamped, so a composed floor can expose just one district's corridors.
 *
 * Blackboard: reads level:zones, level:rooms; appends frontier passage tiles to level:connectors.
 */
import { LEVEL_ZONES, LEVEL_ROOMS, LEVEL_CONNECTORS } from '../blackboard-keys.js';
import { roomTiles } from '../zone-tiles.js';
import { DIRECTIONS_4 } from '../../map/geometry.js';
import { isFloorTile } from '../../map/tile-registry.js';

/** Runs the passage-connectors stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard) {
  const zones = blackboard[LEVEL_ZONES] ?? [];
  const rooms = blackboard[LEVEL_ROOMS] ?? {};
  const section = stageConfig.section;
  const isFloor = (x, y) => isFloorTile(level.tiles[y]?.[x]);

  const connectors = (blackboard[LEVEL_CONNECTORS] ?? []).slice();
  const seen = new Set(connectors.map(([x, y]) => `${x},${y}`));
  for (const zone of zones) {
    if (zone.kind !== 'passage') continue;
    if (section != null && zone.section !== section) continue;
    for (const [x, y] of roomTiles(zone, rooms)) {
      // Frontier tiles only (floor next to a non-floor) — the tiles a corridor can actually attach to.
      if (!isFloor(x, y)) continue;
      if (!DIRECTIONS_4.some(([dx, dy]) => !isFloor(x + dx, y + dy))) continue;
      const key = `${x},${y}`;
      if (!seen.has(key)) {
        seen.add(key);
        connectors.push([x, y]);
      }
    }
  }
  blackboard[LEVEL_CONNECTORS] = connectors;
}
