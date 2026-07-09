# Attribute System
Purpose: Design for a flexible, registry-driven attribute system that replaces the proto-attribute
resolver (`src/attributes/attributes.js`) and the ad-hoc reads of `health`/`attacker`. Attributes are
the single, consistent way an entity's numeric stats are defined, stored, resolved, and displayed —
built so a forking project can define its own set by editing one content module.

> **Status: design, pre-implementation (v0.3.0 "Level Up").** This doc is the agreed shape before
> code. It supersedes the two-attribute resolver in `attributes.js`. Balance and progression tuning
> (XP payouts, the level curve, per-level rewards, how attributes scale with level) are **out of
> scope** here — they land with the roadmap's "attributes used in other systems" bullet.

---

## 1. Goals and non-goals

**Goals**

- One consistent model for every numeric stat on every entity — player and creatures behave the same
  (the only sanctioned deviations from that philosophy are UX and input handling).
- Fork-friendly: a new attribute set is a content edit (one module), not an engine change.
- Centralize formula complexity behind standard resolvers so consumers don't re-derive stats.
- Kill the current inconsistency where some code reads stats through `getAttribute` and other code
  pokes `health.current`/`health.max` directly.

**Non-goals (deferred)**

- Progression tuning: XP amounts, level curve, per-level rewards, stat-on-level-up.
- New-game stat allocation UI.
- MP consumption, Hunger decay/food, attribute-gated equip requirements, ranged/throw miss chance —
  these are *consumers* of the system, scheduled after it exists.
- Display/visibility settings (which attributes show on HUD vs. screen vs. hidden). The registry
  carries the metadata slots so this is an easy follow-up; the settings UI is not built now.

## 2. Concepts

Four pieces, mirroring the engine's existing registry patterns (goals, senses, components):

- **Attribute definition** — the declaration of one attribute: identity (`name`, `shortLabel`,
  `longLabel`), its **flavor**, and its **resolve** formula. Definitions are code (formulas are
  functions), not serialized.
- **Attribute registry** — the catalog of definitions, keyed by name. The engine mechanism lives in
  `src/attributes/`; the **default ROGuE definition set is a separate content module** (proposed
  `data/attribute-set.js`) that a fork replaces wholesale. This is the fork seam.
- **`attributes` component** — the per-entity *state*: the one mutable number each attribute owns on
  that entity. Plain data, serializes like any component.
- **Accessors** — the typed API consumers call (§4). The only place stat math happens.

### Flavor vs. formula

Two orthogonal axes, and keeping them separate is what lets Level and Attack fit cleanly:

- **Flavor** = the *access interface*: how an attribute is stored and what operations it exposes.
  Every Score is accessed the same way as every other Score; Pools share a Pool interface; etc.
- **Formula** = the *implementation*: how the effective value is computed. Can be trivial (a stored
  base + equipment) or a function of other attributes (Level from XP; HP-max from CON).

A "derived" attribute is not a fourth flavor — it's a Score (or Pool) whose formula reads other
attributes instead of a stored base.

## 3. The `attributes` component

Flat map of `attributeName → the single mutable number that attribute owns`:

Attribute **names (keys) are lowercase kebab-case**; the user-facing `shortLabel`/`longLabel` in the
definition carry any capitalized display form (`STR`, `HP`). Only consistency truly matters, and
lowercase keys keep the metadata clean since it drives user-facing display.

```js
attributes: {
  str: 10, dex: 9, int: 8, con: 11, spd: 10,  // score bases
  hp: 20, hpBase: 8, mp: 5,                     // pool CURRENT values + a raw base (hpBase)
  hunger: 100, xp: 0,                           // pool current, accumulator value
}
```

- **Score** stores its `base`. **Pool** stores its `current`; its max is derived, but the flat
  per-entity **raw base** the max formula adds onto is stored under the companion key `${name}Base`
  (e.g. `hpBase`) — kept separate from the mutable current so taking damage never shrinks the max.
  **Accumulator** stores its `value`.
- **Derived attributes store nothing** — `Level` and `attack` have no entry; they are pure functions.
- **A missing key resolves to the definition's default.** Legacy entities, minimalist monsters, and
  a barrel that only has HP all work without carrying the full set. This matches the codebase's
  tolerant-default ethos.

The registry (not the component) is the source of truth for each key's flavor — that's why the
component can be a flat number map with no per-entry type tag.

## 4. Access interfaces (per flavor)

Gameplay code always knows the flavor it's touching, so the primary API is typed — no flavor-parsing
at call sites. Calling the wrong family for an attribute's declared flavor throws (a programming
error). All clamp/derive logic lives here and nowhere else.

**Score** — `str`, `dex`, `int`, `con`, `spd`, `level`, `attack`

```
getScore(entity, name) → number          // effective: resolve(base) + equipment mods
setScoreBase(entity, name, value)         // char creation, allocation, level-up rewards
```

**Pool** — `hp`, `mp`, `hunger`

```
getPool(entity, name) → { current, max }  // max derived; current clamped to [0, max] on read
adjustPool(entity, name, delta) → { current, max }   // damage/heal/spend; clamps, persists current
setPoolCurrent(entity, name, value)       // e.g. fill to max on level-up
```

**Accumulator** — `xp`

```
getAccumulator(entity, name) → number
addToAccumulator(entity, name, amount) → number   // monotonic; amount ≥ 0
```

**Generic (display/iteration only)**

```
listAttributes(entity) → name[]
describeAttribute(entity, name) → { name, flavor, shortLabel, longLabel, value?, current?, max? }
```

The character screen and HUD are the *only* consumers that don't know the flavor in advance, so they
get one generic reader and switch on `flavor` exactly once, in the renderer. Everything else uses the
typed accessors. A universal `getAttribute` is deliberately **not** provided: if the caller must
parse a flavor-tagged blob to use the result, the uniform getter bought nothing.

## 5. Resolve model: on-demand, poll-not-listen

- Effective values are **computed on read, never cached or stored** — the property the current
  resolver already has (no bonus to "remember to remove" on unequip/death). Equipment modifiers are
  summed from worn items' `attributeModifiers` by a shared helper; formulas call the public accessors
  to read other attributes (e.g. the `hp`-max formula calls `getScore(entity, 'con')`).
- **Formulas must be acyclic.** `level` → `xp`, `hp`.max → `con`, `attack` → `str`/`dex` are a small DAG. No memo
  needed at these depths; a cycle is a bug, not a supported case.
- **Reacting to change is by polling, not events.** A calc-on-demand system has no natural "changed"
  signal, and the engine intentionally has no component-subscription layer (ADR-018). The turn loop
  gives a clean poll point: consumers that must react (auto-move HP-drop cancel, the level-up
  crossing, the in-menu salience alert, the HUD) sample at the turn boundary and diff against a
  remembered baseline. This is the same watermark pattern as
  [state-change-alerts.md](state-change-alerts.md); the HP-drop condition there is a first customer of
  `getPool(entity, 'hp')`.

## 6. The default ROGuE attribute set

| Name (key) | Flavor | Stored | Resolve formula (initial) | Short / Long |
|---|---|---|---|---|
| `str` | Score | base | base + equip | STR / Strength |
| `dex` | Score | base | base + equip | DEX / Dexterity |
| `int` | Score | base | base + equip | INT / Intelligence |
| `con` | Score | base | base + equip | CON / Constitution |
| `spd` | Score | base | base + equip + 0.01·`dex` | SPD / Speed |
| `level` | Score (derived) | — | tier(`xp`) | Lvl / Level |
| `attack` | Score | base (unarmed) | base + equip `attack` mods | Atk / Attack |
| `hp` | Pool | current + base | max = `hpBase` + equip + 2·`con` | HP / Health |
| `mp` | Pool | current + base | max = `mpBase` + equip + 2·`int` | MP / Mana |
| `hunger` | Pool | current | max = 10·`con` | Hun / Hunger |
| `xp` | Accumulator | value | identity | XP / Experience |

Notes:

- **`attack` is a mode-independent stored-base Score.** The stored base is the entity's *unarmed*
  damage (a goblin's claws differ from a fist); equipment `attack` modifiers add on top. The **STR/DEX
  ability scaling is deliberately NOT in this resolver** — whether a strike scales on STR (melee) or DEX
  (ranged) is an action-time fact (it turns on whether the strike spends ammunition), not entity state.
  The damage code owns that: `resolveAttackDamage` (src/combat/attack-damage.js) = `getScore(attack) +
  floor(governing_score / 2)`, min 1. Keeping `attack` mode-independent is why one weapon carries one
  `attack` modifier that applies to both a javelin's stab and its throw.
- **Pool max = raw base + equipment + 2·governing score.** HP scales on `con`, MP on `int`; the base
  is the flat per-entity floor stored under `hpBase`/`mpBase`. The `2·` coefficient and the base values
  are still balance knobs — the core scores (`con`/`int`) currently sit on the old ~10 scale, so HP/MP
  run high until the progression-tuning pass rebalances them. Hunger has no base (max = 10·`con`).
- **`mp` is inert at first**: MP isn't spent yet. It resolves and displays; that's the first cut.
- **`hunger` decays** once per turn-consuming player action, ticked from the game scene's
  `handleTurnEnd` (not the `upkeep` hook — that fires on free actions too, e.g. examining a tile).
  `src/world/systems/hunger.js` drains 1/turn, announces threshold crossings (hungry <40%, starving
  <20%, dying at 0) and eating (less hungry / full / stuffed), and bites for 1 damage at a 50% chance
  on an empty stomach — which can kill via the damage effect. The `satiate` effect (food) refills it.
  Only the player is ticked today, though any creature can carry the pool.
- **`spd` drives turn order.** Its resolved value is synced into the `turnTaker.speed` field the turn
  manager reads (`src/attributes/speed-sync.js`), so the turn module stays ignorant of attributes. The
  sync polls each entity at its turn boundary (game-scene `onTurnStart`) and seeds it at construction;
  speed is floored at `MIN_SPEED` so a debuff can't freeze an entity out of the queue. Base is on a
  ~1.0 scale (1 action/round); the `0.01·dex` term is a small nimbleness bonus. The ability-score bases
  (`str`/`dex`/`int`/`con`) still sit on the old ~10 scale pending the progression-tuning rebalance,
  which is why `dex`'s contribution is presently ~0.1 at default.

## 7. Removing the `has('health')` overload

`has('health')` is currently doing double duty as an implicit "is a damageable creature" contract.
That's an accidental coupling — a destructible barrel could have HP and not be a creature; a creature
concept shouldn't ride on a stat component. We tag concepts with dedicated components (we already have
`creature`). Two current call sites mean two *different* things and split accordingly:

- **`resolve-tile-actions.js`** (`occupants.find(has('health'))`) means **"a valid attack target"** →
  becomes **`isDamageable(entity)`** (`src/combat/targeting.js`), the one shared definition of
  attackable, also used by the attack action and the ranged-impact hit test. It resolves to
  **`hasPool(entity, 'hp')`** — a check on the pool's *presence*, not a stored current: once pools split
  into a stored current (`hp`) and a raw base (`hpBase`), an undamaged creature carries only `hpBase`
  (its current defaults to full), so a raw `hasStoredAttribute(entity, 'hp')` would wrongly read a
  full-health creature as unattackable. The damage/heal effect guards key on `hasPool(subject, 'hp')`
  directly (they adjust the pool rather than ask "is this a target").
- **`describe-tile.js`** (rank + name-casing) means **"is a creature/actor"** → keys on the existing
  `creature` component.

`death.js` routing stays keyed on the `hp` pool reaching 0 via `adjustPool`, not on a marker.

## 8. Consumers to update

Every direct stat read moves behind an accessor:

- `effects/effect-types/effect-heal.js`, `effect-damage.js` → `adjustPool(subject, 'hp', ±amount)`
  (the clamp-at-0/max logic they hand-roll becomes `adjustPool`'s job; death still fires from the
  effect when the pool hits 0).
- `actions/action-types/action-attack.js` → `getScore(actor, 'attack')` (rename from the
  `Attributes.ATTACK_DAMAGE` / `attackDamage` constant to the `attack` attribute).
- `ui/widgets/hud.js` → `getPool(player, 'hp')` (and whichever attributes the HUD shows).
- `ui/menus/character-menu.js` (new stats screen) → `listAttributes` + `describeAttribute`.
- `world/map/resolve-tile-actions.js`, `describe-tile.js` → the split in §7.
- Item `attributeModifiers` are unchanged in shape (a flat map keyed by attribute name); their keys
  follow attribute renames (`attackDamage` → `attack`).

## 9. Migration

The old model spreads attribute state across `health {current, max}` and `attacker {damage}`, plus
`attributeModifiers` on items. The new model consolidates entity state into the `attributes`
component. This is a save-breaking reshape: **bump `SAVE_VERSION` (currently 7 → 8), add an
append-only migration, ship a fixture save at v7 and a test** (per AGENTS.md).

Per-entity mapping in the migration (walk `save.entities`):

- `attacker.damage` → `attributes.attack` (the unarmed base). **The `attacker` component stays** as
  the "can take the attack action" marker (now data-less, or with `damage` dropped); we keep it and
  review whether it still earns its keep as implementation proceeds (§11).
- `health.current` → `attributes.hp` (pool current).
- `health.max` → seed the `hp`-max formula so the entity's **effective max is unchanged at migration
  time**: set `con` (and/or the formula's parameters) so `f(con) + equip` reproduces the stored max.
  Then remove `health`. Because the max formula's scale is a placeholder (§6), the honest first cut is
  a trivial formula (e.g. `maxHP = con`) with `con` seeded to the old max — accepting that con's scale
  is a placeholder to be re-tuned alongside the level curve. This keeps the *system* migration
  decoupled from *balance*, which is the separate effort.
- Seed the other score attributes (`str`/`dex`/`int`/`con`/`spd`) and `xp: 0` from the entity's prefab defaults.
- Item `attributeModifiers` keys: `attackDamage` → `attack`.

Creatures/player factories (`creatures.js`, `player.js`) stop calling `components.health` and stop
passing `damage` to `attacker`; they attach an `attributes` component seeded from their stat block and
keep a bare `attacker` marker where an entity can attack.

## 10. Phasing

Ordering follows the roadmap, migration-first so behavior is preserved before new stats arrive:

1. **Registry + resolver + typed accessors + default definition module** (pure, TDD). Formulas read
   existing data where possible; no save change yet.
2. **`attributes` component**; route the *existing* consumers (combat, effects, HUD) through the
   accessors with behavior identical — still reading migrated-in-place values.
3. **The `SAVE_VERSION` fold** (§9): `health`/`attacker` → `attributes`; fixture + migration test;
   `has('health')` split (§7).
4. **Seed the full stat block** on player + creatures (STR…SPD, XP).
5. **XP on kill → derive & display Level.** Level-up *rewards/crossings* deferred to tuning.
6. **Character stats screen + HUD** via the generic display reader.
7. Downstream (tuning bullet): level curve, per-level effects, MP/Hunger gameplay, equip
   requirements, miss chance, new-game allocation.
   - **Level-up attribute growth landed** (`levelUp` component + `src/world/systems/level-up.js`):
     a turn-boundary watch diffs each leveling entity's derived Level against a per-component
     watermark and allocates points across a declared attribute split. `dynamic: false` entities
     keep the spec but don't grow as they earn XP — the seam the creature spawn-scaling feature will
     use to boost a monster to a target level at spawn. See docs/howto/tuning-level-up-growth.md.

## 11. Decisions and adjustable defaults

All four are decided; 1 and 2 are deliberately cheap to change later.

1. **HP-max formula & scale** *(decided, adjustable later)*. Start with the trivial `maxHP = con`,
   `con` seeded to old maxes — a placeholder scale to be re-tuned in the progression pass, keeping the
   system migration out of balance.
2. **Pool clamp policy when max drops** (e.g. unequip a +HP item while full) *(decided, adjustable
   later)*. Non-destructive clamp-on-read: overflow "returns" if the item goes back on. Revisit if it
   feels wrong in play.
3. **`attacker` retained.** It stays as the "can take the attack action" marker, distinct from having
   an `attack` attribute. Review whether it still does anything real as systems are wired up; drop it
   only if nothing depends on it.
4. **Naming: lowercase kebab-case keys** (`hp`, `attack`, `hunger`). Display capitalization lives in
   `shortLabel`/`longLabel`. The item `attributeModifiers` keys and the migration follow suit.
