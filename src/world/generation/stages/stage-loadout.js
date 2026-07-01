/**
 * @file Loadout stage: fills already-placed creatures' inventories from item tables. It runs after the
 * creatures exist on the level (after `populate` or `placeStaticEntities`), collects them via the
 * registry, and for each one applies the first matching rule's item generator — pushing the generated
 * items into the creature's inventory. The equip-weapon / equip-ammo goals do the wielding later; this
 * stage only stocks the bag. See docs/howto/loadouts.md and src/world/entities/item-tables.js.
 *
 * Running after placement (rather than at spawn time) keeps "what creatures exist" separate from "what
 * they carry", lets one rule set arm creatures placed by any means, and — because it draws no RNG that
 * the placement stages depend on — leaves their seeded determinism untouched.
 */
import { ENTITY_PREFABS } from '../../entities/entity-prefabs.js';
import { orcArcher, orcSkirmisher } from '../../entities/item-tables.js';

// Creature filters — predicates over a placed entity, composed into loadout rules. Exported so
// pipelines and tests can build their own rule sets. A type filter keys on the stable `entityTypeId`
// (never the display `name`); `byName`/`byFaction` cover "just the orc commander named Grug" and
// "every orc" respectively, and `all` arms anything that reaches the stage.
export const byType =
  (...ids) =>
  (e) =>
    ids.includes(e.components.get('entityTypeId'));
export const byFaction = (faction) => (e) => (e.components.get('faction') ?? []).includes(faction);
export const byName = (name) => (e) => e.components.get('name') === name;
export const all = () => () => true;

// Default rules: ordered, first match wins. Orcs carry a spear; the commander carries the bow kit.
// Exported so a pipeline can reuse or override them (via stageConfig.rules).
export const DEFAULTS = {
  rules: [
    { filter: byType('orcCommander'), items: orcArcher },
    { filter: byType('orc'), items: orcSkirmisher },
  ],
};

// Instantiates one item spec straight into `inventory`. A stackable spec is a single entity whose
// `count` is overridden when given; a non-stackable spec with count N is N separate entities. Items
// are created with the creature as host (the entityId path), which sets their inventory location;
// the host array push mirrors how the chest-fill code in the placement stages adds contained items.
function addLoadoutItem(inventory, creatureId, { type, count }, registry) {
  const prefab = ENTITY_PREFABS[type];
  if (!prefab || prefab.kind !== 'item') throw new Error(`Unknown loadout item type "${type}"`);

  const entity = prefab.make(registry, null, null, creatureId);
  const stackable = entity.components.get('stackable');
  if (stackable) {
    if (count != null) stackable.count = count;
    inventory.items.push(entity);
    return;
  }

  inventory.items.push(entity);
  for (let i = 1; i < (count ?? 1); i++) {
    inventory.items.push(prefab.make(registry, null, null, creatureId));
  }
}

/** Runs the loadout stage (see the file overview). */
export function run(level, stageConfig = {}, blackboard, rng, registry) {
  const rules = stageConfig.rules ?? DEFAULTS.rules;

  for (const creature of registry.getEntitiesWith('creature')) {
    // The player travels between floors inside the same registry; never arm it here. Creatures with
    // no inventory (e.g. the scuttler) simply have nowhere to carry a loadout.
    if (creature.components.has('playerControlled')) continue;
    const inventory = creature.components.get('inventory');
    if (!inventory) continue;

    const rule = rules.find((r) => r.filter(creature));
    if (!rule) continue;
    for (const spec of rule.items(rng)) addLoadoutItem(inventory, creature.id, spec, registry);
  }
}
