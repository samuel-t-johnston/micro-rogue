/**
 * @file Death loot: rolls a dying creature's loot table and drops the resulting item specs on its
 * corpse tile. Called from the onDeath hook (src/combat/death.js). Loot draws from the persistent
 * `gameplay` RNG stream — the same stream combat and AI share — so a given run's drops are reproducible
 * and part of the save state. See data/tables/loot.js and src/world/tables/entity-table.js.
 */
import { ENTITY_PREFABS } from '../world/entities/entity-prefabs.js';
import { placeItemOnMap } from '../world/entities/placement.js';
import { rollTable } from '../world/tables/entity-table.js';
import { rng } from '../engine/core/rng.js';
import { lootTableFor } from '../../data/tables/loot.js';

// Turns one item spec into placed map entities at (x, y). A stackable spec is a single entity whose
// `count` overrides the prefab default; a non-stackable spec with count N drops N separate copies on
// the tile. Mirrors the loadout stage's addLoadoutItem, but resting on the floor instead of in a bag.
function dropSpec({ type, count }, level, registry, x, y) {
  const prefab = ENTITY_PREFABS[type];
  if (!prefab || prefab.kind !== 'item') throw new Error(`loot: unknown item type "${type}"`);

  const entity = prefab.make(registry, x, y);
  const stackable = entity.components.get('stackable');
  if (stackable) {
    if (count != null) stackable.count = count;
    placeItemOnMap(registry, level, entity, x, y);
    return;
  }
  placeItemOnMap(registry, level, entity, x, y);
  for (let i = 1; i < (count ?? 1); i++) {
    placeItemOnMap(registry, level, prefab.make(registry, x, y), x, y);
  }
}

/**
 * Rolls `entity`'s loot table (if its type has one) and drops the results on its tile. A no-op for
 * creatures with no table or no position, so it's safe to call for every death.
 */
export function dropLoot(entity, level, registry) {
  const lootTable = lootTableFor(entity);
  if (!lootTable) return;
  const pos = entity.components.get('position');
  if (!pos || !level) return;

  const ctx = {
    rng: rng.stream('gameplay'),
    registry,
    source: entity,
    depth: level.depth ?? 1,
  };
  for (const spec of rollTable(lootTable, ctx)) dropSpec(spec, level, registry, pos.x, pos.y);
}
