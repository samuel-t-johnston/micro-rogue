# Attribute System
Purpose: A flexible, registry-driven attribute system — the single, consistent way an entity's numeric
stats are defined, stored, resolved, and displayed. Built so a forking project can define its own set by
editing one content module (`data/attribute-set.js`).

> **Status: landed in v0.3.0 ("Level Up").** Replaced the earlier two-attribute resolver and the ad-hoc
> reads of `health`/`attacker`. Balance/progression values (pool-max coefficients, the level curve,
> per-level growth) are deliberately simple and tuned iteratively as features land — the system's job is
> to keep that tuning *out* of the engine mechanism, not to fix the numbers.

---

## 1. Goals and scope

**Goals**

- One consistent model for every numeric stat on every entity — player and creatures behave the same
  (the only sanctioned deviations from that philosophy are UX and input handling).
- Fork-friendly: a new attribute set is a content edit (one module), not an engine change.
- Centralize formula complexity behind standard resolvers so consumers don't re-derive stats.
- One way to read a stat — the typed accessors (§4), never a direct poke at a component field.

**Scope.** The system owns the *mechanism*: how an attribute is defined, stored, resolved, and
displayed. It does **not** own *balance* (XP amounts, the level curve, per-level rewards) or the
*consumers* that spend or gate on stats. Those are separate features that read through the accessors —
attack damage (`src/combat/attack-damage.js`), hunger (`src/world/systems/hunger.js`), level-up growth
(`src/world/systems/level-up.js`), turn cadence (`src/attributes/speed-sync.js`), ranged/throw miss
chance, and the salience monitor's HP condition. See §8 and Related systems.

## 2. Concepts

Four pieces, mirroring the engine's existing registry patterns (goals, senses, components):

- **Attribute definition** — the declaration of one attribute: identity (`name`, `shortLabel`,
  `longLabel`), its **flavor**, and its **resolve** formula. Definitions are code (formulas are
  functions), not serialized.
- **Attribute registry** (`src/attributes/attribute-registry.js`) — the catalog of definitions, keyed
  by name. The engine mechanism lives in `src/attributes/`; the **default ROGuE definition set is a
  separate content module** (`data/attribute-set.js`) that a fork replaces wholesale. This is the fork seam.
- **`attributes` component** — the per-entity *state*: the one mutable number each attribute owns on
  that entity. Plain data, serializes like any component.
- **Accessors** (`src/attributes/attribute-access.js`) — the typed API consumers call (§4). The only
  place stat math happens.

### Flavor vs. formula

Two orthogonal axes, and keeping them separate is what lets Level and Attack fit cleanly:

- **Flavor** = the *access interface*: how an attribute is stored and what operations it exposes.
  Every Score is accessed the same way as every other Score; Pools share a Pool interface; etc.
- **Formula** = the *implementation*: how the effective value is computed. Can be trivial (a stored
  base + equipment) or a function of other attributes (Level from XP; HP-max from CON).

A "derived" attribute is not a fourth flavor — it's a Score (or Pool) whose formula reads other
attributes instead of a stored base.

## 3. The `attributes` component

Flat map of `attributeName → the single mutable number that attribute owns`. Keys are **lowercase
kebab-case**; the user-facing `shortLabel`/`longLabel` in the definition carry any capitalized display
form (`STR`, `HP`).

```js
attributes: {
  str: 5, dex: 5, int: 5, con: 5, spd: 1,  // score bases
  attack: 1,                                // score base (unarmed)
  hpBase: 20, mpBase: 1,                     // pool raw bases
  xp: 0,                                     // accumulator value
}
```

- **Score** stores its `base`. **Pool** stores its `current` under `${name}`; its max is derived, and
  the flat per-entity **raw base** the max formula adds onto is stored under the companion key
  `${name}Base` (e.g. `hpBase`) — kept separate from the mutable current so taking damage never shrinks
  the max. **Accumulator** stores its `value`.
- **Derived attributes store nothing** — `level` and `attack`'s ability scaling are pure functions.
- **A missing key resolves to the definition's default.** Legacy entities, minimalist monsters, and a
  barrel that only has HP all work without carrying the full set — the codebase's tolerant-default ethos.
  (An absent pool *current* reads as full, which is why an undamaged entity stores only `${name}Base`.)

The registry (not the component) is the source of truth for each key's flavor — that's why the
component can be a flat number map with no per-entry type tag.

## 4. Access interfaces (per flavor)

Gameplay code always knows the flavor it's touching, so the primary API is typed — no flavor-parsing at
call sites. Calling the wrong family for an attribute's declared flavor throws (a programming error). All
clamp/derive logic lives here and nowhere else.

**Score** — `str`, `dex`, `int`, `con`, `spd`, `level`, `attack`

```
getScore(entity, name) → number            // effective: resolve(base) + equipment mods
setScoreBase(entity, name, value)           // char creation, allocation
adjustScoreBase(entity, name, delta) → base // incremental (level-up growth)
```

**Pool** — `hp`, `mp`, `hunger`

```
getPool(entity, name) → { current, max }    // max derived; current clamped to [0, max] on read
adjustPool(entity, name, delta) → { current, max }   // damage/heal/spend; clamps, persists current
setPoolCurrent(entity, name, value)         // e.g. fill to max
hasPool(entity, name) → boolean             // stores current OR base — presence test for targeting
```

**Accumulator** — `xp`

```
getAccumulator(entity, name) → number
addToAccumulator(entity, name, amount) → number   // monotonic; amount ≥ 0
```

**Generic (display/iteration only)** — `listAttributes(entity)` and `describeAttribute(entity, name)`
(`{ name, flavor, shortLabel, longLabel, value?/current?/max? }`). The character screen and HUD are the
only consumers that don't know the flavor in advance, so they get one generic reader and switch on
`flavor` exactly once, in the renderer. A universal `getAttribute` is deliberately **not** provided: if
the caller must parse a flavor-tagged blob to use the result, the uniform getter bought nothing.

## 5. Resolve model: on-demand, poll-not-listen

- Effective values are **computed on read, never cached or stored** — no bonus to "remember to remove"
  on unequip/death. Equipment modifiers are summed from worn items' `attributeModifiers` by a shared
  helper; formulas call the public accessors to read other attributes (e.g. the `hp`-max formula reads
  `getScore(entity, 'con')`).
- **Formulas must be acyclic.** `level` → `xp`, `hp`.max → `con`, `spd` → `dex`, `attack` scaling →
  `str`/`dex` form a small DAG. No memo is needed at these depths; a cycle is a bug, not a supported case.
- **Reacting to change is by polling, not events.** A calc-on-demand system has no natural "changed"
  signal, and the engine intentionally has no component-subscription layer (ADR-018). The turn loop
  gives a clean poll point: consumers that must react (the level-up crossing, `syncSpeed`, the salience
  monitor's HP-drop condition, the HUD) sample at the turn boundary and diff against a remembered
  baseline — the watermark pattern in [state-change-alerts.md](state-change-alerts.md).

## 6. The default ROGuE attribute set

Defined in `data/attribute-set.js`.

| Name (key) | Flavor | Stored | Resolve formula | Short / Long |
|---|---|---|---|---|
| `str` | Score | base | base + equip | STR / Strength |
| `dex` | Score | base | base + equip | DEX / Dexterity |
| `int` | Score | base | base + equip | INT / Intelligence |
| `con` | Score | base | base + equip | CON / Constitution |
| `spd` | Score | base | base + equip + 0.01·`dex` | SPD / Speed |
| `level` | Score (derived) | — | `levelForXp(xp)` | Lvl / Level |
| `attack` | Score | base (unarmed) | base + equip `attack` mods | Atk / Attack |
| `hp` | Pool | current + base | max = `hpBase` + equip + 2·`con` | HP / Health |
| `mp` | Pool | current + base | max = `mpBase` + equip + 2·`int` | MP / Mana |
| `hunger` | Pool | current | max = 20·`con` | Hun / Hunger |
| `xp` | Accumulator | value | identity | XP / Experience |

Notes:

- **`attack` is a mode-independent stored-base Score.** The stored base is the entity's *unarmed*
  damage; equipment `attack` modifiers add on top. The **STR/DEX ability scaling is deliberately NOT in
  this resolver** — whether a strike scales on STR (melee) or DEX (ranged) is an action-time fact (it
  turns on whether the strike spends ammunition), not entity state. The damage code owns that:
  `resolveAttackDamage` (`src/combat/attack-damage.js`) = `max(1, floor(getScore('attack') +
  governing_score / 2))`. Keeping `attack` mode-independent is why one weapon carries one `attack`
  modifier that applies to both a javelin's stab and its throw.
- **Pool max = raw base + equipment + 2·governing score.** HP scales on `con`, MP on `int`; Hunger has
  no base (max = 20·`con`). The `2·` coefficient and base values are balance knobs, tuned in place.
- **`mp` is inert**: MP isn't spent by any system yet. It resolves and displays; that's the current cut.
- **`hunger` decays** once per turn-consuming player action, ticked from the game scene's `handleTurnEnd`
  (not the `upkeep` hook, which fires on free actions too). `src/world/systems/hunger.js` drains 1/turn,
  announces threshold crossings and eating, and bites for damage at empty; the `satiate` effect (food)
  refills it. Only the player is ticked today, though any creature can carry the pool.
- **`spd` drives turn order.** Its resolved value is synced into the `turnTaker.speed` field the turn
  manager reads (`src/attributes/speed-sync.js`), so the turn module stays ignorant of attributes. The
  sync polls each entity at its turn boundary and seeds it at construction; speed is floored at
  `MIN_SPEED` so a debuff can't freeze an entity out of the queue. Base is on a ~1.0 scale (1 action/
  round); the `0.01·dex` term is a small nimbleness bonus.

## 7. `has('health')` is gone; concepts have their own components

`has('health')` used to double as an implicit "is a damageable creature" contract — an accidental
coupling (a destructible barrel could have HP and not be a creature). Concepts are tagged with dedicated
components instead. The two former call sites meant two different things and split accordingly:

- **"A valid attack target"** → `isDamageable(entity)` (`src/combat/targeting.js`), the one shared
  definition of attackable (used by the tile-action resolver, the attack action, and the ranged-impact
  hit test). It resolves to `hasPool(entity, 'hp')` — a check on the pool's *presence*, not a stored
  current, so a full-health creature (which stores only `hpBase`) still reads as attackable. The
  damage/heal effect guards key on `hasPool(subject, 'hp')` directly.
- **"Is a creature/actor"** (rank + name-casing in `describe-tile.js`) → the existing `creature`
  component.

`death.js` routing stays keyed on the `hp` pool reaching 0 via `adjustPool`, not on a marker.

## 8. Where stats are read

Every stat read goes through an accessor — notable consumers:

- `effects/effect-types/effect-heal.js`, `effect-damage.js` → `adjustPool(subject, 'hp', ±amount)`
  (death still fires from the effect when the pool hits 0); `effect-satiate.js` → the `hunger` pool.
- `actions/action-types/action-attack.js` → `resolveAttackDamage` → `getScore(actor, 'attack')` + ability.
- `ui/widgets/hud.js` → `getPool(player, 'hp')` and the shown attributes; the character stats screen →
  `describeAttribute` / the curated sheet.
- `world/map/resolve-tile-actions.js`, `describe-tile.js` → the split in §7.
- Item `attributeModifiers` are a flat map keyed by attribute name (`attack`, `hp`, …), summed by the
  resolver.

## 9. Migration record

The old model spread attribute state across `health {current, max}` and `attacker {damage}` plus
`attributeModifiers` on items. The **v7 → v8** migration folded entity state into the `attributes`
component (append-only, with a fixture save and test, per AGENTS.md):

- `attacker.damage` → `attributes.attack` (the unarmed base). The `attacker` component stayed as the
  bare "can take the attack action" marker (§11).
- `health.current` → `attributes.hp` (pool current).
- `health.max` → seeded so the effective max was unchanged at migration time: `con` (and the max
  formula's parameters) set so `f(con) + equip` reproduced the stored max, then `health` removed.
- Seeded the other scores (`str`/`dex`/`int`/`con`/`spd`) and `xp: 0` from prefab defaults; item
  `attributeModifiers` keys `attackDamage` → `attack`.

Creature/player factories stopped calling `components.health` / passing `damage` to `attacker` and now
attach an `attributes` component seeded from their stat block. (Later save-affecting features — level-up
growth, etc. — added their own migrations; `SAVE_VERSION` is past v8 now.)

## 10. Decisions and adjustable defaults

- **HP-max formula & scale** *(adjustable)*. `max = hpBase + equip + 2·con`; the coefficient and bases
  are balance knobs tuned in place, kept out of the migration so the system stayed decoupled from balance.
- **Pool clamp policy when max drops** (e.g. unequip a +HP item while full) *(adjustable)*.
  Non-destructive clamp-on-read: overflow "returns" if the item goes back on.
- **`attacker` retained** as the "can take the attack action" marker, distinct from having an `attack`
  score. Nothing currently gates on `has('attacker')`; it's kept as the semantic marker and can be
  dropped if it stays unused.
- **Naming: lowercase kebab-case keys** (`hp`, `attack`, `hunger`); display capitalization lives in
  `shortLabel`/`longLabel`. Item `attributeModifiers` keys follow suit.

## Related systems

- **Level-up growth** — `src/world/systems/level-up.js` + the `levelUp` component: a turn-boundary watch
  diffs each entity's derived Level against a per-component watermark and allocates points across a
  declared attribute split. See [tuning-level-up-growth.md](../howto/tuning-level-up-growth.md).
- **Creature level-scaling** — the `scaleCreatures` map-gen stage
  (`src/world/generation/stages/stage-scale-creatures.js`): creatures authored at level 1 with a
  `dynamic: false` levelUp spec are booted to a per-floor level (sets `xp` to match, then runs the shared
  `applyLevelUps` allocator).
- **Turn cadence** — `src/attributes/speed-sync.js` (§6).
- **Attack damage** — `src/combat/attack-damage.js` (§6).
- **State-change alerts** — [state-change-alerts.md](state-change-alerts.md): the salience monitor's
  HP-drop condition reads `getPool(entity, 'hp')` and is a poll-not-listen consumer (§5).
