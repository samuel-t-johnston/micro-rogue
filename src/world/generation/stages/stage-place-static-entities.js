/**
 * @file Population stage for static layouts: instantiates the authored entities a static/randomStatic
 * stage stashed on the blackboard (`static:entities`). Each spec is `{ type, x, y }`; `chest` also
 * carries `contents` (item type names). Placement is exact and deterministic — no RNG. `stairsUp`
 * doubles as the player's entry point. See docs/howto/static-map-layouts.md.
 */
import { ENTITY_PREFABS } from '../../entities/entity-prefabs.js';
import { components } from '../../entities/components.js';

// The up-stairs and dungeon exit double as the player's arrival tile, so static placement tags them
// with entryPoint. This is a placement concern, not part of the prefab's identity, so it lives here.
const ENTRY_POINT_TYPES = new Set(['stairsUp', 'dungeonExit']);

function spawn(registry, type, x, y) {
  const prefab = ENTITY_PREFABS[type];
  if (!prefab) throw new Error(`Unknown static entity type "${type}"`);
  const entity = prefab.make(registry, x, y);
  if (ENTRY_POINT_TYPES.has(type)) {
    registry.addComponent(entity, 'entryPoint', components.entryPoint());
  }
  return entity;
}

function placeChest(level, registry, spec) {
  const chest = ENTITY_PREFABS.chest.make(registry, spec.x, spec.y);
  const inventory = chest.components.get('inventory');
  for (const itemType of spec.contents ?? []) {
    const prefab = ENTITY_PREFABS[itemType];
    if (!prefab || prefab.kind !== 'item') throw new Error(`Unknown chest item type "${itemType}"`);
    inventory.items.push(prefab.make(registry, null, null, chest.id));
  }
  level.placeEntity(chest);
}

/** Runs the place-static-entities population stage (see the file overview). */
export function run(level, stageConfig, blackboard, rng, registry) {
  for (const spec of blackboard['static:entities'] ?? []) {
    if (spec.type === 'chest') {
      placeChest(level, registry, spec);
      continue;
    }
    level.placeEntity(spawn(registry, spec.type, spec.x, spec.y));
  }
}
