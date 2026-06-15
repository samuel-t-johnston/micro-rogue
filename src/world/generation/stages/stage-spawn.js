// Finishing stage: marks where the player arrives. Places an `entryPoint` entity on a floor tile in
// the `stairs-up` zone (the classic "arrive on the up-stairs"); the game scene reads it via
// resolveSpawn. Kept separate from the stairs stage so the arrival point can move independently
// later. See docs/design/procedural-3x3-dungeon.md.
import { components } from '../../components.js';
import { centermostFloor } from '../zone-tiles.js';

export function run(level, stageConfig, blackboard, rng, registry) {
  const zones = blackboard['level:zones'] ?? [];
  const cs = blackboard['level:grid']?.cellSize ?? 10;

  const zone = zones.find(z => z.labels.includes('stairs-up')) ?? zones[0];
  if (!zone) { console.warn('[spawn] no zones; no entry point placed'); return; }

  const tile = centermostFloor(level, zone, cs);
  if (!tile) { console.warn('[spawn] entry zone has no floor; no entry point placed'); return; }

  const entry = registry.createEntity();
  registry.addComponent(entry, 'position', components.position(tile[0], tile[1]));
  registry.addComponent(entry, 'entryPoint', components.entryPoint());
  level.placeEntity(entry);
}
