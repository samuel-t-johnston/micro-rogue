# Loadouts

*How creatures spawn carrying gear, and how to wire up a new loadout.*

A **loadout** is the set of items a creature starts with in its inventory. Loadouts are assigned by a
generation stage *after* creatures are placed — deliberately kept separate from the creature factories,
so "what creatures exist" and "what they carry" stay independent. A creature then **wields** its
loadout through the `equip-weapon` / `equip-ammo` goals; the loadout stage only stocks the bag.

## The pieces

- **`entityTypeId`** — every prefab stamps this stable id (the [ENTITY_PREFABS](../../src/world/entities/entity-prefabs.js) key, e.g. `'orc'`, `'orcCommander'`). It's a content identity independent of the display `name`, so rules can target a type without keying on a renamable string.
- **Item tables** — [`src/world/entities/item-tables.js`](../../src/world/entities/item-tables.js). Generator functions `(rng) => ItemSpec[]` describing what to produce. Today they're static sets; the `rng` parameter is in place for random rolls later (loot drops, chest contents). Build specs with `item(type, count?)`:
  - For a **stackable** item (arrows, javelins), `count` sets the stack size.
  - For a **non-stackable** item, `count` is the number of separate copies.
  - Omit `count` for the prefab's own default (arrows already spawn as a stack of 20).
- **The loadout stage** — [`src/world/generation/stages/stage-loadout.js`](../../src/world/generation/stages/stage-loadout.js). Walks the placed creatures and, for each, applies the **first matching rule**, pushing the generated items into its inventory. Creatures with no inventory (e.g. the scuttler) and the player are skipped.
- **Filters** — predicates over a placed entity, exported from the stage: `byType(...ids)`, `byFaction(faction)`, `byName(name)`, `all()`. So you can arm "the orc commander" (`byType('orcCommander')`), "every orc" (`byFaction('orcs')`), "just Grug" (`byName('Grug')`), or "anything that reached the stage" (`all()`).
- **The equip goals** — `equip-weapon` picks the best *usable* weapon from inventory and wields it, and **stows a weapon that has become dead weight** (a bow whose ammo has run out — it scores below bare hands, so the creature drops to bare-handed melee rather than dry-firing); `equip-ammo` loads matching ammunition for a wielded ranged weapon. Both are eager (they fire with no enemy in sight, so a creature arms itself while idle) and both read the creature's own body via `context.self`. Put them above the combat goal in the stack — `equip-weapon` stowing the dry bow before `attack-in-range` runs is what keeps an out-of-ammo creature from proposing a shot it can't pay for.

## Add or change a loadout

1. **Define the items** in `item-tables.js`:

   ```js
   export const orcArcher = () => [item('bow'), item('arrow', 20)];
   ```

2. **Add a rule** to `DEFAULTS.rules` in `stage-loadout.js` (ordered, first match wins):

   ```js
   { filter: byType('orcCommander'), items: orcArcher },
   ```

3. **Make sure the stage runs** on the pipeline whose creatures you want armed. Add `{ type: 'loadout' }` after the creature-placing stage (`populate` or `placeStaticEntities`):

   ```js
   stages: [ /* … */ { type: 'populate' }, { type: 'loadout' } ]
   ```

4. **Give the creature the equip goals** so it wields the loadout — `equip-weapon` (and `equip-ammo` for a ranged weapon) above its `attack-in-range` goal (see [creature.md](creature.md)).

A pipeline can override the default rules by passing its own list: `{ type: 'loadout', rules: [...] }`.

## Worth knowing

- **The stage runs after placement and draws no RNG the placement stages depend on**, so adding it leaves their seeded determinism (and tests) untouched.
- **Loadouts go into inventory, not equipment slots** — the equip goals do the wielding. This exercises (and tests) the equip path, and means a creature spends a turn or two arming itself when first active; because the equip goals are eager, that happens while idle, before it engages.
- **The same item tables are intended to grow into loot drops and chest contents** (v0.4.0). Keep generators general.
