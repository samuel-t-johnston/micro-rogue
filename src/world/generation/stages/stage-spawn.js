/**
 * @file Finishing stage: marks where the player arrives. Places an `entryPoint` entity on a room tile
 * in the `stairs-up` zone (the classic "arrive on the up-stairs" — it lands on the same centre tile
 * the stairs stage uses). The game scene reads it via resolveSpawn. See docs/design/procedural-3x3-dungeon.md.
 */
import { components } from '../../components.js';
import { centermostRoomTile } from '../zone-tiles.js';

/** Runs the spawn (entry-point) finishing stage (see the file overview). */
export function run(level, stageConfig, blackboard, rng, registry) {
  const zones = blackboard['level:zones'] ?? [];
  const rooms = blackboard['level:rooms'] ?? {};

  const zone = zones.find((z) => z.labels.includes('stairs-up')) ?? zones[0];
  if (!zone) {
    console.warn('[spawn] no zones; no entry point placed');
    return;
  }

  const tile = centermostRoomTile(zone, rooms);
  if (!tile) {
    console.warn('[spawn] entry zone has no room; no entry point placed');
    return;
  }

  const entry = registry.createEntity();
  registry.addComponent(entry, 'position', components.position(tile[0], tile[1]));
  registry.addComponent(entry, 'entryPoint', components.entryPoint());
  level.placeEntity(entry);
}
