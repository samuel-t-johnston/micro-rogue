/**
 * @file Loot tables — content: what creatures leave behind when they die. Definitions are plain data
 * (the `table`/`row`/`ref`/`nothing` helpers), mirroring how pipelines and item generators are
 * authored. The death path (src/combat/death-loot.js) resolves a dying creature to a table by its
 * `entityTypeId`, rolls it on the gameplay RNG stream, and drops the resulting item specs on the
 * corpse tile. See src/world/tables/entity-table.js for the roll semantics.
 *
 * This binding-by-type map is the prototype seam; when floor/chest population is unified onto tables
 * (roadmap v0.5.0) this can grow into loadout-style filter rules (byFaction, byName, …).
 */
import { table, row, ref, nothing } from '../../src/world/tables/entity-table.js';
import { item } from '../../src/world/entities/item-tables.js';

/** A small potion pool a couple of loot tables share, to show table nesting. */
export const potions = table('potions', 'A rolled potion', {
  rows: [row(3, () => [item('healingPotion')]), row(1, () => [item('potionOfPain')])],
});

export const orcLoot = table('orcLoot', 'What an orc drops', {
  rolls: [1, 2], // a small pile, not a single item
  rows: [
    row(6, nothing), // most rolls yield nothing — loot is a treat, not a guarantee
    row(3, () => [item('meat')]),
    // Deeper orcs carry better steel: the sword row's weight climbs with depth, the dagger's holds.
    row(3, () => [item('dagger')]),
    row(
      ({ depth }) => Math.max(0, depth - 2),
      () => [item('sword')],
    ),
    row(2, ref('potions')),
  ],
});

export const goblinLoot = table('goblinLoot', 'What a goblin drops', {
  rows: [row(8, nothing), row(2, () => [item('grapes')]), row(1, ref('potions'))],
});

export const orcCommanderLoot = table('orcCommanderLoot', 'What an orc commander drops', {
  rolls: [2, 3], // a leader is worth looting
  rows: [
    row(2, nothing),
    row(3, () => [item('arrow', 10)]),
    row(2, () => [item('meat')]),
    row(3, ref('potions')),
    row(
      ({ depth }) => 1 + depth,
      () => [item('sword')],
    ),
  ],
});

// Which creature type rolls which table. Absent types drop nothing (the current behavior), so adding
// loot to a creature is one line here plus a table above.
const LOOT_BY_TYPE = {
  orc: orcLoot,
  goblin: goblinLoot,
  orcCommander: orcCommanderLoot,
};

/** Resolves a dying entity to its loot table, or null if its type has none. */
export function lootTableFor(entity) {
  return LOOT_BY_TYPE[entity.components.get('entityTypeId')] ?? null;
}
