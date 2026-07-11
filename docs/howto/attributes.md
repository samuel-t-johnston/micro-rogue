# Attributes

*Reading, writing, and defining an entity's numeric stats. For the **why** — flavors vs. formulas, why
the accessors are typed, the `has('health')` split — read [the attribute system design](../design/attribute-system.md).
For how stats grow on level-up, see [tuning-level-up-growth.md](tuning-level-up-growth.md). This is the
day-to-day how-to.*

## How it works

An entity's stats live in one flat **`attributes` component** (a plain `name → number` map). What each
key *means* — how it resolves, how it displays — lives in the **registry**, not on the entity:

- **Definitions** live in [`data/attribute-set.js`](../../data/attribute-set.js) — the content module a
  fork replaces to define its own stats. Each declares a `name`, a **flavor**, display labels, and a
  resolve formula.
- **The registry** ([`attribute-registry.js`](../../src/attributes/attribute-registry.js)) catalogs them
  and is the extension seam (`registerAttribute` to add/override).
- **The accessors** ([`attribute-access.js`](../../src/attributes/attribute-access.js)) are the **only**
  place stat math happens. Gameplay code never reads the component directly.

Three **flavors** ([`attribute-flavors.js`](../../src/attributes/attribute-flavors.js)) — the access
interface an attribute exposes:

| Flavor | For | Stores | Reads with |
|---|---|---|---|
| **Score** | STR, DEX, INT, CON, SPD, `level`, `attack` | a `base` (or nothing, if derived) | `getScore` |
| **Pool** | HP, MP, Hunger | a `current` + a raw base under `${name}Base` | `getPool` / `adjustPool` |
| **Accumulator** | XP | a monotonic `value` | `getAccumulator` / `addToAccumulator` |

Effective values are **computed on read, never cached** — a score is `resolve(base) + equipment mods`;
a pool's `max` is derived and its `current` clamped to it. A **missing key resolves to the definition's
default**, so a minimalist creature (or a barrel with only HP) needs no full stat block.

## Read and write a stat

Always through the typed accessor for the attribute's flavor — calling the wrong family throws (it's a
programming error you want to hear about). All take the entity first.

```js
import { getScore, adjustScoreBase, getPool, adjustPool, getAccumulator } from '.../attribute-access.js';

getScore(player, 'str');                 // → effective STR (base + equipment)
adjustScoreBase(player, 'str', +1);      // level-up growth: bump the stored base

const { current, max } = getPool(player, 'hp');
adjustPool(player, 'hp', -3);            // damage (negative) / heal (positive); clamps to [0, max]
setPoolCurrent(player, 'hunger', getPool(player, 'hunger').max); // fill to full

getAccumulator(player, 'xp');            // → total XP
addToAccumulator(killer, 'xp', reward);  // monotonic; amount ≥ 0
```

- **Damage/heal** is `adjustPool(entity, 'hp', ±amount)` — the effect handlers do exactly this, and
  death fires when the pool hits 0 (no separate "is dead" flag).
- **"Is this a valid attack target?"** is `hasPool(entity, 'hp')` (via `isDamageable` in
  [`targeting.js`](../../src/combat/targeting.js)) — presence of the pool, *not* a stored current, since
  a full-health creature stores only `hpBase`. Don't use `hasStoredAttribute` for this.
- **Attack damage** isn't a raw `getScore('attack')`: the STR/DEX ability bonus is an *action-time*
  fact (melee vs. ranged), so it's layered on in [`attack-damage.js`](../../src/combat/attack-damage.js)
  via `resolveAttackDamage(actor, { isRanged })`. Use that for damage.

## Give an entity a stat block

Attach an `attributes` component seeded from the entity's stat block (see
[`player.js`](../../src/world/entities/player.js) / [`creatures.js`](../../src/world/entities/creatures.js)):

```js
registry.addComponent(entity, 'attributes', components.attributes({
  str: 5, dex: 5, int: 5, con: 5, spd: 1,  // score bases
  attack: 1,                                // unarmed base
  hpBase: 20, mpBase: 1,                    // pool RAW bases (not current — see below)
  xp: 0,
}));
```

- **Seed a pool's base under `${name}Base`, not `${name}`.** `hpBase` is the flat floor the max formula
  adds onto (`max = hpBase + equip + 2·con`); the mutable `current` is stored under `hp` and left
  **unseeded** so it reads as full on spawn. Storing `hp` directly would set a partial current.
  (Hunger is the exception — [`player.js`](../../src/world/entities/player.js) seeds its current with
  `setPoolCurrent` so `hasPool('hunger')` is true and the drain/satiate guards find it.)
- **Omit anything on the default** — a missing key resolves to the definition's `default`; only seed
  what differs.
- **If `spd` matters**, call `syncSpeed(entity)` after attaching both `attributes` and `turnTaker` so
  the derived speed reaches the turn queue ([`speed-sync.js`](../../src/attributes/speed-sync.js)).

## Add a new attribute

The fork seam. Add a definition to `ATTRIBUTE_SET` in [`data/attribute-set.js`](../../data/attribute-set.js)
(registration order = display order); no engine change needed.

```js
// A Score: stored base + equipment, plus a formula reading another attribute.
{ name: 'luck', flavor: Flavors.SCORE, shortLabel: 'Lck', longLabel: 'Luck',
  default: 1, resolve: ({ base, mods }) => base + mods },

// A Pool: resolveMax is REQUIRED; store its current under `luck`, its base under `luckBase`.
{ name: 'stamina', flavor: Flavors.POOL, shortLabel: 'Sta', longLabel: 'Stamina',
  resolveMax: ({ base, mods, score }) => base + mods + 2 * score('con') },
```

- **Formulas are pure functions of a resolve context** (`base`, `mods`, and `score()`/`pool()`/
  `accumulated()` to read *other* attributes) and **must stay acyclic** — a cycle is a bug, not a
  supported case.
- **Derived attributes store nothing** — give `level`/`attack`-style attributes a `resolve` that reads
  other attributes and don't seed a base on entities.
- **Display**: the HUD and the character Stats screen read via the generic `describeAttribute` /
  `listAttributes`; a new attribute shows up there once entities store it (which sheet it lands on is a
  curated list, not automatic — see the stats screen).
- **Saves**: adding a definition and seeding it on prefabs is *additive* (old entities fall back to the
  default). But if you seed it onto **existing** saved entities, that's a save-affecting change — bump
  `SAVE_VERSION`, add a migration + fixture + test, per [saving.md](saving.md).

## Worth knowing

- **Never poke the component.** `entity.components.get('attributes').hp` bypasses clamping and the max
  formula. Always go through an accessor.
- **Poll-not-listen.** There's no "attribute changed" event (the engine has no component-subscription
  layer). Systems that must react — level-up, `syncSpeed`, the salience monitor's HP-drop check, the HUD
  — sample at the turn boundary and diff a remembered watermark. See
  [state-change-alerts.md](../design/state-change-alerts.md).
- **`hasPool` vs. `hasStoredAttribute`.** `hasPool(e, 'hp')` = "has HP at all" (current or base),
  the gameplay presence test. `hasStoredAttribute` = "stores this exact key", for display/enumeration
  only — it misses a full-health creature that stores only `hpBase`.
- **Pools clamp non-destructively.** Unequipping a +HP item while full doesn't delete the overflow; it
  "returns" if the item goes back on, because current is only clamped on *read*.
