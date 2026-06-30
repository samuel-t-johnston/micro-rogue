# Ranged Weapons Design

Purpose: add ranged attacks to the engine — a short-reach **spear**, a thrown **javelin**, and a
**bow** that fires **arrow** ammunition — and, in doing so, promote weapons from "an equippable with a
damage modifier" to a first-class concept with range, ammunition, and directional attack art.

This document is the agreed plan. It records the decisions, the data model, the execution flow, and a
step-by-step implementation breakdown. NPC ranged behaviour (a ranged AI goal, the orc commander's
loadout) is explicitly **out of scope here** and lands as an immediate follow-up once this
infrastructure exists.

> **As-built status.** Implemented as designed (steps 1–11). The player can wield the spear, javelin,
> and bow with ammo, stacking — including merge-on-pickup and the inventory split / stack-all actions
> (§7) — and the save v6→v7 migration. Notes where the build refined the plan:
>
> - **Bow `meleeRange: 0`** (always fires; no point-blank stab) — resolved from the §2 open question.
> - **Spear stays on the melee wiggle** by choice (its 1-tile reach makes a thrust sprite barely
>   distinct); arrow and javelin flight use the real directional Utumno sprites.
> - **`flightStyle` seam not built** — thrust-vs-projectile is still inferred from `ammoType`; see §9.
> - **Player-facing how-to:** [docs/howto/weapons.md](../howto/weapons.md).
>
> The **NPC ranged goal + orc-commander loadout** (the named follow-up) is not yet built.

---

## 1. Motivation and the "weapons are special now" decision

Until now a weapon was nothing but an `equippable(WEAPON)` item carrying
`attributeModifiers({ attackDamage })`, and `executeAttack` was unconditionally melee. Ranged combat
adds concerns that apply **only to weapons** — range, ammunition, break chance, and per-direction
attack sprites — and lumping those onto the generic item/equippable machinery would smear
weapon-specific data across components that other items share.

So we introduce a dedicated **`weapon`** component (and a sibling **`ammunition`** component, and a
general **`stackable`** component). Weapons remain `equippable` + `attributeModifiers` as before; the
new components are **purely additive**. Nothing about existing armor, potions, or scrolls changes.

The guiding ECS rule still holds (see `docs/howto/component.md`): components are **plain serializable
data**, behaviour lives in systems. The new components store data only; a new resolver
(`src/combat/weapons.js`) and the attack handler do the work.

---

## 2. The weapons

| Weapon | Slot | `range` | `meleeRange` | `ammoType` | `breakChance` | Notes |
|---|---|---|---|---|---|---|
| Spear | weapon | 2 | 1 | `null` | 0 | Reach weapon. Nothing leaves the hand; d2 is a thrust. |
| Javelin | weapon | 15 | 1 | `'self'` | (some) | Melee at d1 (no consume); thrown beyond. Stacks (small). |
| Bow | weapon | 15 | 0 | `'arrow'` | n/a | Always fires an arrow (no point-blank stab). Bow never flies. |
| Dagger | weapon | 1 | 1 | `null` | 0 | Unchanged behaviour; gains `weapon({ range: 1 })`. |
| Sword | weapon | 1 | 1 | `null` | 0 | Likewise. |

| Ammo | Slot | `ammoType` | `breakChance` | Notes |
|---|---|---|---|---|
| Arrow | ammunition | `'arrow'` | (some) | Stackable (large, ~100). Carries directional attack sprites. |

"Unarmed" (no weapon equipped) is **range 1, meleeRange 1, no ammo** — the resolver's default when a
creature has no weapon item, so existing fist-fighting monsters keep working untouched.

### `range` vs `meleeRange`

For a target at Chebyshev distance `d` from the attacker:

- `d ≤ meleeRange` → **melee mode**: never consumes ammo; melee/wiggle animation. Requires only
  adjacency-style reach (no clear-line check — you're next to it).
- `meleeRange < d ≤ range` → **ranged/reach mode**: consumes ammo per `ammoType`; projectile (or
  thrust) animation; requires a clear straight line to the target (see §6).
- `d > range` → not attackable; the tile offers move/look as usual.

`meleeRange` defaults to **1**, which makes most weapons fall out correctly. The spear is the
instructive case: `meleeRange 1, range 2, ammoType null` means d1 is a plain melee wiggle, d2 is a
non-consuming reach thrust (an animation difference only), and nothing is ever expended.

The **bow opts out** with `meleeRange: 0`: it always fires an arrow, even point-blank (the d1 shot
consumes ammo and can misfire per §5) — no free melee stab. `meleeRange: 0` is a deliberately
supported value (`0 ≤ meleeRange ≤ range`), so any weapon can be made "ranged at every distance" the
same way; the bow is just the first to use it.

---

## 3. New components

Added to `src/world/entities/components.js` in alphabetical order; created only via the factory.

```js
// Marks an item as ammunition for a ranged weapon. ammoType must match the firing weapon's ammoType.
// breakChance (0..1) is the odds the projectile shatters on impact instead of landing to be retrieved.
// attackSprites maps an 8-way compass direction (N, NE, E, SE, S, SW, W, NW — the keys cardinalDirection
// returns) to a sprite-catalog name; the flying projectile draws the one nearest its flight vector.
ammunition(ammoType, breakChance = 0, attackSprites = {}) {
  return { ammoType, breakChance, attackSprites };
},

// A stack of identical items represented as one entity with a count. maxStackSize is the cap (data,
// for a future merge/split UI); count is the live quantity. Decrementing to 0 destroys the entity.
stackable(maxStackSize = 1, count = 1) {
  return { maxStackSize, count };
},

// Marks an item as a weapon. range is the max attack distance (Chebyshev). meleeRange (≤ range) is the
// distance at/under which an attack is a no-ammo melee. ammoType: null = consumes nothing (melee/reach
// only); 'self' = the weapon throws itself (javelin); any other tag = consumes matching ammunition from
// the ammunition slot (bow → 'arrow'). breakChance (0..1) applies to a self-thrown weapon's flight.
// attackSprites: 8-way compass → sprite name for the projectile/thrust; empty falls back to a wiggle.
weapon(range = 1, { meleeRange = 1, ammoType = null, breakChance = 0, attackSprites = {} } = {}) {
  return { range, meleeRange, ammoType, breakChance, attackSprites };
},
```

Notes:
- `attackSprites` is a single object keyed by compass direction rather than eight loose fields —
  same serialized footprint, far less repetition, and it lines up with `cardinalDirection`'s output so
  there's exactly one direction vocabulary in the codebase.
- All three are plain JSON, so they serialize through the existing flat-registry snapshot with no
  special handling (see §8).

### New equipment slot

`data/equipment-slots.js`:

```js
export const Slots = Object.freeze({
  WEAPON: 'weapon',
  ARMOR: 'armor',
  AMMUNITION: 'ammunition',
});

export const HUMANOID_SLOTS = Object.freeze([Slots.WEAPON, Slots.ARMOR, Slots.AMMUNITION]);
```

Adding `AMMUNITION` to `HUMANOID_SLOTS` gives newly-created humanoids a quiver slot. It is per-entity
data, so an old save's humanoids would otherwise lack the slot and never be able to equip ammo — a real
degradation we fix with a save migration. See §8 *Migration*.

---

## 4. The weapons resolver — `src/combat/weapons.js`

A new module is the single definition site for "what can this actor do with its equipped weapon",
shared by the tile-action resolver, the attack handler, and (later) the NPC goal. It keeps
`getAttribute`-style derivation: read the equipped weapon on demand, never cache.

```js
getEquippedWeapon(entity)        // → the weapon item entity in the WEAPON slot, or null
getWeaponStats(entity)           // → { range, meleeRange, ammoType, breakChance, attackSprites }
                                 //   defaults to unarmed { range:1, meleeRange:1, ammoType:null, … }
getAttackCapability(entity)      // → { range, meleeRange } — the small capabilities object passed to
                                 //   resolveTileActions (see §6). Deliberately minimal/expandable.
resolveAmmo(entity, ammoType)    // → { source, item } for consumption, or null when none is usable
```

`resolveAmmo` encodes the three ammo modes:
- `ammoType === null` → returns a sentinel meaning "no consumption" (spear, dagger).
- `ammoType === 'self'` → the equipped weapon stack itself is the ammo.
- otherwise → the item in the **AMMUNITION** slot, **only if** its `ammunition.ammoType` matches.
  A missing quiver or a mismatched type returns `null`, which drives the misfire message (§5).

---

## 5. Attack execution — one handler, three modes

We keep the single `attack` action (`{ type: 'attack', targetEntityId }`) so the UI and the NPC goal
need no new action type. `executeAttack` branches on the resolved weapon and the target's distance:

1. **Melee** (`d ≤ meleeRange`): unchanged from today — `getAttribute(ATTACK_DAMAGE)`, attacker
   `wiggle` toward the target, combat sound, `damage` effect. No ammo, no flight.

2. **Reach, non-consuming** (`meleeRange < d ≤ range`, `ammoType === null` — the spear): same damage
   application as melee, but a **thrust** animation (out-and-back along the line, using the weapon's
   `attackSprites`, wiggle fallback). Nothing leaves the hand; nothing lands.

3. **Ranged, consuming** (`meleeRange < d ≤ range`, `ammoType` set — javelin/bow):
   - `resolveAmmo`. If it returns `null` → **misfire**: log a player-facing message ("You have no
     arrows." / "Your quiver holds the wrong ammunition.") and **return `true` (free action — the
     turn is not consumed)**. This is what makes the mechanic discoverable without punishing the
     player. No animation, no damage.
   - Otherwise: **decrement** the ammo stack by one (`stackable.count--`; destroy the entity at 0,
     clearing the slot if it was equipped). Produce **one** flying item (count 1) — see §7.
   - Trace the flight (shared with throw, §6), apply the `damage` effect at the impact tile, play the
     one-way **projectile** animation (ammo's `attackSprites` for the bow, weapon's for the javelin;
     wiggle fallback), then **break or land** the flown item per its `breakChance`.
   - Return `false` (turn consumed).

Damage for every mode comes from the existing attribute resolver
(`getAttribute(actor, ATTACK_DAMAGE)`), i.e. unarmed base + worn `attributeModifiers`. **Arrows ship
with no `attributeModifiers`** (ranged damage = base + weapon modifier). We do **not** special-case
the resolver to forbid ammo from contributing stats — if a future "+1 arrows" wants in, it works
through the same path; today's arrows simply contribute nothing. (See §8 for the one subtlety this
creates.)

---

## 6. Targeting, tile actions, and line-of-sight

Ranged attack is **target-first and immediate**: you tap an enemy within range and it attacks — no
targeting cursor (that stays Throw's item-first flow). This requires the tile-action resolver, which
is currently positional and weapon-blind, to learn the attacker's reach.

`resolveTileActions(level, playerPos, tile)` →
`resolveTileActions(level, playerPos, tile, capability)` where `capability = { range, meleeRange }`
(from `getAttackCapability`, defaulting to `{ range: 1, meleeRange: 1 }` so callers that don't pass it
behave exactly as before). The Attack row is offered for a creature with `health` when:

- `d ≤ meleeRange` (melee — no line check needed), **or**
- `meleeRange < d ≤ range` **and the straight line to the target is clear** (no wall/fixture/creature
  strictly between attacker and target).

The two callers — `player-get-input` (tap → primary action) and the contextual long-press menu — both
pass the capability, so taps and the menu stay in lockstep, as they do today.

**Distance** is Chebyshev (`chebyshevDistance`), matching the existing adjacency model. The
**clear-line** check reuses the same Bresenham line (`lineTiles`) and blocker test that throw's
`traceFlight` uses, so "can I shoot it" and "where does the shot stop" can never disagree.

A note on FOV: targeting-cursor actions (Throw) are gated to visible tiles by the cursor itself.
Ranged attack is gated instead by `range` + clear line; in practice an enemy you can see and have a
clear line to is what you can shoot. The bow's "15, within vision" reduces to: you can only tap an
enemy you can see, and the clear-line check enforces the rest.

---

## 7. Stacking, and splitting one unit off a stack

A stack is **one entity with a `stackable.count`**. A weapon or ammunition slot holds that single
(possibly stacked) entity, so a quiver of 100 arrows or a bundle of 5 javelins occupies one slot.

- **Arrows**: `stackable(100, count)`, equipped in the ammunition slot.
- **Javelins**: `stackable(5, count)`, equipped in the weapon slot. A small cap keeps them from being
  a strictly-better infinite spear while still avoiding a re-equip tax after every throw.

**Consuming one** (firing an arrow / throwing a javelin):

1. Decrement the equipped stack's `count`. If it hits 0, destroy the entity and null the slot.
2. The thing that *flies and lands* is always a **single** item. Two cases:
   - count was 1 (last one): reuse the equipped entity itself as the projectile (remove from slot,
     fly, land/break) — no clone needed, mirrors throwing a single item.
   - count was >1: **clone one unit** — a new entity with `count: 1` and copies of the source's
     plain-data components (`name`, `renderable`, `item`, `weapon`/`ammunition`, `stackable`) — which
     becomes the projectile while the source stack keeps the rest.

**One split helper, shared.** The "take N off a stack as a new entity" operation is the same primitive
the user-facing stack split needs, so it lives once as a general helper and the ranged/throw path calls
it with `N = 1`:

```js
// Splits `n` units off `source` into a new entity (count n); decrements source by n, destroying it
// (and clearing its slot) if it empties. Copies the source's plain-data components into the clone.
// The ranged/throw path calls splitStack(source, 1, registry); the split UI calls it with n>1.
splitStack(source, n, registry) // → the new count-n entity
```

It only ever copies serializable component data (no entity-reference components live on an ammo item),
so a structured copy per component suffices. The "last of stack" optimization (reuse the source entity
itself when `count === n`) lives inside `splitStack`, so callers don't special-case it.

**Merge and the split/stack-all UI.** `src/world/entities/inventory-stacking.js` is the complement to
`splitStack`:

- **Merge on pickup.** `addToInventory(inventory, item, registry)` pours a picked-up stack into
  existing below-max stacks of the same type before creating a new entry, fully absorbing and
  destroying the incoming entity when it fits. All three pickup paths route through it (auto/manual
  pickup, the multi-item floor dialog, and taking from a container).
- **Stack identity.** Two stacks merge iff both are `stackable` with the same `maxStackSize` and an
  equal `stackSignature` — every component except the volatile `stackable`/`item`/`position` (count,
  location, coordinates). Correct for arrows/javelins today and safe for future per-instance data
  (dissimilar instances simply won't merge).
- **Inventory actions** (`Split`, `Stack all`), both **free** (no turn cost) and inventory-only — an
  equipped stack must be unequipped first, which falls out naturally since equipped items live in
  equipment slots, not `inventory.items`. *Split* (`action-split.js`) takes 1..count−1 off via a
  quantity stepper; *Stack all* (`action-stack-all.js`) consolidates one item type (pour smallest into
  largest, destroy emptied stacks). There is deliberately no split-on-drop/throw/store — split first,
  then act.

---

## 8. Serialization and the `getAttribute` subtlety

**Serialization** needs no new mechanism. The flat-registry snapshot already serializes every entity's
components as data and rewrites entity references in `inventory.items` / `wearsEquipment.slots`
(see `src/save/core/serialize.js`). The new components are plain data; the new ammunition slot is just
another slot key holding an entity ref or `null`; a stacked entity is one normal entity with an extra
number. Nothing about the new components *forces* a schema bump — but two changes degrade pre-existing
saves, so we ship one migration to keep them whole.

### Migration (SAVE_VERSION 6 → 7)

Old saves predate this work, so they contain humanoids without a quiver and weapons without a `weapon`
component. A single migration step (one fixture at v6 + a test that loads it and asserts the
post-migration shape, per `AGENTS.md`) repairs both:

1. **Backfill the ammunition slot.** For every entity whose `wearsEquipment.slots` carries the humanoid
   loadout (`weapon` + `armor`) but no `ammunition` key, add `ammunition: null`. Without this an old
   player can never equip arrows. We key on the existing slot shape rather than a "humanoid" marker
   (there isn't one) so any equipment-wearer that matches gets the quiver.
2. **Backfill the `weapon` component.** For every item with `equippable(WEAPON)` that lacks a `weapon`
   component, add `weapon({ range: 1 })` — restoring the "every weapon-slot item is a weapon" invariant
   the new resolver and any future weapon code can rely on. This is for consistency: an old dagger
   already behaves as range-1 melee because the resolver defaults to unarmed when the component is
   absent (see below), so the game is correct either way; the migration just makes the data match.

**Belt-and-suspenders.** Independently of the migration, `getWeaponStats` **tolerates a missing
`weapon` component** and falls back to the unarmed defaults (`range 1, meleeRange 1, ammoType null`),
and the stacking logic treats a **missing `stackable`** as `count 1`. So a save that somehow slips the
migration, or a hand-built entity, never crashes — it just reads as a plain melee weapon / single item.
The migration upgrades the data; the resolver defaults guarantee safety without it.

This bumps `SAVE_VERSION` to **7** (and is the reason for the bump — the components alone wouldn't
require it).

**The `getAttribute` subtlety.** `getAttribute` sums `attributeModifiers` across **all**
`wearsEquipment.slots`. Once the ammunition slot exists, any `attributeModifiers` on equipped ammo
would be added to the wearer's stats **always, even for melee**. We accept this by **not putting
`attributeModifiers` on arrows** (per §5) rather than by special-casing the resolver. The behaviour is
documented here so that if someone later adds a stat-bearing ammo and is surprised it boosts melee
swings, the fix is a deliberate per-slot resolution policy, not a patch.

---

## 9. Animation

There is no projectile animation today (throw resolves its flight instantly). We add one, using the
existing detached-animation pattern and the `animations.play(spec)` hook; it remains **fire-and-forget**
— game state (damage, death, item landing) resolves immediately and the animation only chases it, per
`docs/design/ux-design.md`.

- **Projectile (one-way)** — javelin/bow ranged attacks, and **Throw** (folded in now): a detached
  sprite flies from the attacker's tile to the impact tile over a short duration. Throw uses the
  thrown item's **base** renderable sprite (no directional variants). Ranged attacks use the
  appropriate `attackSprites` entry — the bow draws the **arrow's** sprite (the bow stays in hand),
  the javelin draws the **weapon's** sprite.
- **Thrust (out-and-back)** — the spear: the same directional sprite extends toward the target and
  retracts; nothing lands.
- **Direction**: `cardinalDirection(attacker, target)` picks one of the 8 compass keys; the projectile
  draws `attackSprites[dir]`.
- **Fallback**: if the needed sprite (or any of `attackSprites`) is missing, fall back to the melee
  attacker **wiggle** toward the target — so the feature is fully playable before art exists.

Art (the Utumno sheet) is slotted in at the end by adding catalog entries and filling `attackSprites`;
no code changes are needed to adopt it, thanks to the glyph/wiggle fallbacks.

### Three independent animation decisions (and one future seam)

`animateAttack` makes three separate choices; it's worth being clear which are data-driven and which
are currently inferred:

1. **Animate vs. wiggle — fully per-weapon, even per-direction.** Driven purely by whether
   `attackSprites[dir]` exists; a missing entry falls back to the melee wiggle. The spear wiggles only
   because its `attackSprites` is empty — nothing about reach weapons forces it.
2. **Which sprite flies — tied to ammo type (correctly).** External ammo (not `null`/`'self'`) draws
   the **ammo's** sprites (bow → arrow); otherwise the **weapon's own** (javelin, spear). This mirrors
   what physically leaves the hand, so coupling it to `ammoType` is right.
3. **Thrust (out-and-back) vs. one-way projectile — currently inferred from `ammoType`.** The branch
   is `ammoType == null ? thrust : projectile`. This is the one coupling that may chafe later: a
   no-ammo **magic staff** should fire a one-way bolt (not retract), and some ammo weapon might still
   want a thrust.

**Future seam.** When a weapon needs to break decision (3) from `ammoType`, add an optional
`flightStyle: 'thrust' | 'projectile'` to the `weapon` component, defaulting from `ammoType` so
existing weapons are unchanged, and have `animateAttack` read it instead of inferring. One factory
field plus one line; no save migration needed (absent → derive the current default). The branch in
`animateAttack` is commented as this seam. Not built now — nothing yet needs the distinction.

---

## 10. Shared flight refactor (dedup)

`executeThrow` already implements trace → impact → effect → break-or-land with bounce-back. The
consuming-ranged path needs the same. We **extract** the reusable pieces from `action-throw.js` into a
shared module (e.g. `src/actions/core/projectile-flight.js`): `traceFlight`, `stopsFlight`,
`tileHoldsItem`, `landItem`, and the break roll. Throw and ranged attack both call it, so "same LOS
and breaking mechanics as a throw" is true by construction rather than by parallel maintenance.

---

## 11. Testing plan

Test-first where logic is pure (per `AGENTS.md`):

- **`weapon`/`ammunition`/`stackable` factories** — shape and defaults (unarmed default, `meleeRange`
  default).
- **weapons resolver** — `getWeaponStats` default-unarmed; `resolveAmmo` for null / self / matching /
  mismatched / empty-quiver.
- **`resolveTileActions`** — Attack offered at `d ≤ meleeRange`; offered at `meleeRange < d ≤ range`
  only with a clear line; not offered when blocked or `d > range`; melee unchanged with no capability
  argument.
- **`executeAttack`** — melee unchanged; reach (spear) deals damage and consumes nothing; ranged
  decrements the stack and lands/breaks one unit; **misfire** logs and returns `true` (free) without
  decrementing or animating; last-of-stack reuses the entity, count>1 clones one.
- **stacking** — decrement to 0 destroys and clears the slot; clone-one copies components with
  `count: 1` and leaves the source stack intact.
- **shared flight** — the extracted module keeps throw's existing tests green (regression), and the
  ranged path exercises the same trace/land/break.
- **save migration (6 → 7)** — a v6 fixture (a humanoid with a weapon+armor loadout and an equipped
  dagger) loads and asserts the post-migration shape: the player gains `ammunition: null`, the dagger
  gains `weapon({ range: 1 })`, and unrelated entities are untouched.

Not unit-tested (per `AGENTS.md`): animation feel (projectile duration, thrust retract), sprite
direction selection visuals — verified by eye.

---

## 12. Implementation steps

Ordered so the tree stays green and each step is independently reviewable.

1. **Components + slot.** Add `weapon`, `ammunition`, `stackable` factories; add `AMMUNITION` to
   `Slots`/`HUMANOID_SLOTS`. Tests for factory shapes.
2. **Weapons resolver.** `src/combat/weapons.js` (`getEquippedWeapon`, `getWeaponStats`,
   `getAttackCapability`, `resolveAmmo`) + tests.
3. **Shared flight refactor.** Extract `projectile-flight.js` from `action-throw.js`; throw delegates
   to it; existing throw tests stay green.
4. **Stacking helper.** General `splitStack(source, n, registry)` primitive (the ranged path calls it
   with `n = 1`; built for the later split UI) + tests. No merge, no split UI yet.
5. **Tile actions.** Thread `capability` into `resolveTileActions` and its two callers; Chebyshev +
   clear-line offer logic + tests.
6. **Attack handler.** Branch `executeAttack` into melee / reach / ranged (consume, fly, land/break,
   misfire-free-action) + tests. Damage path unchanged.
7. **Items + prefabs.** `createSpear`, `createJavelin`, `createBow`, `createArrow` in `items.js`;
   register in `entity-prefabs.js`; give dagger/sword a `weapon({ range: 1 })`. Glyph-only for now.
8. **Save migration (6 → 7).** Add the migration step (ammunition-slot + `weapon`-component backfill),
   `SAVE_VERSION = 7`, a v6 fixture, and its load test. Ship alongside step 7 so the new dagger/sword
   shape and old saves agree.
9. **Animation.** Projectile (one-way) + thrust (out-and-back) via `animations.play`, directional via
   `cardinalDirection`, wiggle fallback; fold the one-way projectile into Throw.
10. **Temporary map placement** for manual testing (spear/javelin/bow/arrows reachable), per the
    roadmap's "temporary map adjustments for testing."
11. **Art pass.** Catalog entries from the Utumno sheet; fill `attackSprites`; bump the
    service-worker cache version for the new assets.
12. **Docs + roadmap.** Update `equipment.md`/`item.md` (the weapon/ammunition/stackable additions),
    check off the roadmap items, and note this doc as as-built.

Follow-up (separate chunk): NPC ranged goal + orc-commander loadout (bow + arrows).
