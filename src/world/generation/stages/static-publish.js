/**
 * @file Shared handoff from a loaded static layout to the blackboard, used by both the `static` and
 * `randomStatic` structure stages. Accumulates authored entities, merges authored rooms into the zone
 * graph (with the stage's `section`), and — when the block is embedded (`bounds`) — publishes its
 * connector tiles and its footprint as protected, so `stitch` can join it without cutting into it. See
 * docs/howto/static-map-layouts.md.
 */
import { appendZones } from '../zone-tiles.js';
import { STATIC_ENTITIES, LEVEL_CONNECTORS, LEVEL_PROTECTED } from '../blackboard-keys.js';

/** Writes a `loadStaticLayout` result onto the blackboard. Accumulates, so multiple blocks compose. */
export function publishStatic(blackboard, { entities, zones, rooms, connectors }, stageConfig) {
  blackboard[STATIC_ENTITIES] = [...(blackboard[STATIC_ENTITIES] ?? []), ...entities];
  if (zones.length) appendZones(blackboard, { zones, rooms, section: stageConfig.section });
  if (connectors.length) {
    blackboard[LEVEL_CONNECTORS] = [...(blackboard[LEVEL_CONNECTORS] ?? []), ...connectors];
  }
  // The footprint is protected only when embedded — a standalone static level owns the whole grid and
  // never runs `stitch`, so there is nothing to guard against.
  if (stageConfig.bounds) {
    blackboard[LEVEL_PROTECTED] = [...(blackboard[LEVEL_PROTECTED] ?? []), stageConfig.bounds];
  }
}
