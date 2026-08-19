# Loot Tables

*How to give a creature death drops, and how entity tables work in practice.*

When a creature dies, `onDeath` (in [death.js](../../src/combat/death.js)) rolls its **loot table** and
drops the results on its tile. Loot is content: the tables live in
[data/tables/loot.js](../../data/tables/loot.js), and the mechanism — weighted, nestable, RNG-driven
spec generators — is [entity-tables](../design/entity-tables.md).

## The pieces

- **`entityTypeId`** — every creature prefab stamps this stable id (`'orc'`, `'goblin'`, …). Loot is
  bound to the type by it, the same way loadouts are ([loadouts.md](loadouts.md)).
- **A table** — `table(id, description, { rolls, rows })`. `rolls` (default `1`) is how many times one
  death rolls the table; each roll picks one **row** by weight.
- **A row** — `row(weight, gen)`. `weight` is a number, or `(ctx) => number` for depth-scaled odds.
  `gen` is `(ctx) => spec[]` — usually `() => [item('sword')]`, or `nothing` for "no drop", or
  `ref('otherTable')` to delegate to another table.
- **A spec** — `item(type, count?)`, a prefab id plus optional count (stack size for stackables, copies
  for non-stackables). Tables emit *specs*, not entities; the death path places them.
- **The catalog** — every table is registered in [data/tables/index.js](../../data/tables/index.js)
  (`TABLES`) and installed once via `useTables(TABLES)`. `ref(id)` resolves against it.

## Add loot to a creature

1. **Write the table** in `data/tables/loot.js` and export it:

   ```js
   export const goblinLoot = table('goblinLoot', 'What a goblin drops', {
     rows: [
       row(8, nothing),               // usually nothing
       row(2, () => [item('grapes')]),
       row(1, ref('potions')),        // a nested table
     ],
   });
   ```

2. **Register it** in `data/tables/index.js` so `ref` (and the catalog) can see it:

   ```js
   import { goblinLoot } from './loot.js';
   export const TABLES = { /* … */ goblinLoot };
   ```

3. **Bind it to the creature type** in `loot.js`'s `LOOT_BY_TYPE`:

   ```js
   const LOOT_BY_TYPE = { /* … */ goblin: goblinLoot };
   ```

That's it — a creature whose `entityTypeId` isn't in the map simply drops nothing.

## Worth knowing

- **Determinism.** One roll spends a fixed number of RNG draws (one for a ranged `rolls`, then one per
  roll; nested tables recurse). Weight functions must be **pure** — read `ctx`, never roll. See the
  [determinism contract](../design/entity-tables.md#4-determinism-contract).
- **Which RNG.** Loot rolls on the persistent **gameplay** stream, so a run's drops are reproducible and
  saved. The caller passes the RNG in; a table never reaches for one itself.
- **Context.** `gen` and weight functions receive `ctx` with `{ rng, registry, source, depth }` — e.g.
  `row(({ depth }) => Math.max(0, depth - 2), () => [item('sword')])` makes swords likelier deeper down.
- **Zero, one, or many.** A row can emit several specs, and `rolls: [1, 3]` picks several rows — so one
  table can drop nothing, a single item, or a pile.
- **Only items today.** Loot specs are items; the same table shape will grow creature/furniture specs
  for spawn tables and floor population (the [unification follow-up](../design/entity-tables.md#8-follow-up--unification-and-other-seams)).
