# Weapons

*Weapon-specific behaviour — range, ammunition, stacking, and the ranged attack flow.* 

Read [item.md](item.md) for the generic item recipe and [equipment.md](equipment.md) for slots and stat
modifiers first. The full design rationale lives in [docs/design/ranged-weapons.md](../design/ranged-weapons.md).

## How it works

A weapon is an equippable item ([equipment.md](equipment.md)) that also carries a **`weapon`**
component describing how it attacks. Melee and ranged are the same system — melee is just range 1.

**`weapon` component** — `weapon(range, { meleeRange, ammoType, breakChance, attackSprites })`:

- `range` — the maximum attack distance (Chebyshev). A dagger is 1; a bow is 15.
- `meleeRange` (default 1) — at or under this distance an attack is a **melee** swing: no ammo, the
  wiggle animation. Above it, out to `range`, it's a **ranged/reach** attack. A bow sets `meleeRange: 0`
  so it always fires (no free point-blank stab); the javelin keeps `meleeRange: 1` so it can stab
  adjacent foes without spending one.
- `ammoType` — what a ranged attack consumes: `null` = nothing (a reach weapon like the spear);
  `'self'` = the weapon throws itself (the javelin); any other tag = matching ammunition from the
  ammunition slot (the bow → `'arrow'`).
- `breakChance` (0..1) — for a self-thrown weapon, the odds it shatters on impact instead of landing.
- `attackSprites` — an 8-way compass map (`{ N, NE, … }`) of catalog sprite names for the flight
  animation; empty falls back to the melee wiggle. See [Animation](#animation).

**`ammunition` component** — on ammo items: `ammunition(ammoType, breakChance, attackSprites)`. Its
`ammoType` must match the firing weapon's. Arrows live in the **ammunition** equipment slot (a quiver).

**`stackable` component** — `stackable(maxStackSize, count)`. A stack is one entity with a `count`;
firing/throwing decrements it (and destroys it at 0). Arrows stack to 100, javelins to 5.

**Merging, splitting, combining** — [`src/world/entities/inventory-stacking.js`](../../src/world/entities/inventory-stacking.js):
- **Merge on pickup** is automatic. `addToInventory` pours a picked-up stack into existing below-max
  stacks of the same type before adding a new entry, so retrieved arrows/javelins refill the quiver.
  "Same type" = same `maxStackSize` and an equal `stackSignature` (all components except the volatile
  `stackable`/`item`/`position`).
- **Split** (inventory row, stacks of >1) takes a chosen 1..count−1 off into a new stack via a quantity
  stepper. **Stack all** (inventory row, when ≥2 below-max stacks of that type exist) consolidates one
  type into as few stacks as possible. Both are **free** (no turn) and operate only on carried items —
  unequip a stack first to split/combine it. No splitting on drop/throw/store: split first, then act.

**The resolver** — [`src/combat/weapons.js`](../../src/combat/weapons.js) is the single place that
answers "what can this actor do with its weapon", derived on demand (never cached), tolerating absent
data (an entity with no weapon, or an old item with no `weapon` component, reads as unarmed range-1
melee):

- `getWeaponStats(entity)` → `{ range, meleeRange, ammoType, breakChance, attackSprites }`.
- `getAttackCapability(entity)` → the minimal `{ range, meleeRange }` the tile resolver needs.
- `resolveAmmo(entity, ammoType)` → `{ stack, slot }` to consume from, or `null` (a misfire).

## The attack flow

One `attack` action (`{ type: 'attack', targetEntityId }`) covers every weapon;
[`executeAttack`](../../src/actions/action-types/action-attack.js) branches on the resolved weapon and
the distance to the target:

- **Melee** (`d ≤ meleeRange`): attribute-resolved damage, the wiggle, a combat sound.
- **Reach** (`meleeRange < d ≤ range`, no `ammoType`): damage along a clear line; nothing leaves the
  hand (the spear thrust).
- **Ranged** (`meleeRange < d ≤ range`, with `ammoType`): consume one unit ([`splitStack`](../../src/world/entities/stacking.js)
  peels a single projectile off the stack), fly it via the shared
  [`projectile-flight`](../../src/actions/core/projectile-flight.js) trace (same line/break/land
  mechanics as throwing — see [item.md](item.md) "Throwing"), and apply damage at the impact tile.
  When no usable ammo exists it **misfires**: a logged message and a **free action** (the turn isn't
  spent), so a dry quiver doesn't punish the player.

**Targeting is target-first.** Unlike throwing (item-first, with a cursor), a ranged attack is offered
directly on an enemy: [`resolveTileActions`](../../src/actions/core/resolve-tile-actions.js) lists
Attack for any creature within reach — melee when adjacent, or a clear straight line out to `range` —
so a tap on an in-range foe fires. The reach it uses comes from `getAttackCapability`, threaded in via
`selfState.attackCapability` (taps) and directly (the contextual menu).

## Animation

The flight animation picks `attackSprites[dir]` for the 8-way bearing to the target
(`cardinalDirection`) and plays a one-way **projectile** (ranged) or out-and-back **thrust** (reach);
a missing sprite falls back to the melee **wiggle**, so weapons are fully playable before art exists.
The flying sprite comes from the **ammo** for an external-ammo weapon (the bow stays in hand, the arrow
flies) and from the **weapon itself** otherwise (javelin, spear). Directional sprites are catalogued as
`<projectile>-<dir>` (e.g. `arrow-e`) and built with the `directionalAttackSprites` helper in
[`items.js`](../../src/world/entities/items.js). See [sprite-sheets.md](sprite-sheets.md).

## Add a new weapon

Follow the [item.md](item.md) recipe, then:

```js
registry.addComponent(entity, 'equippable', components.equippable(Slots.WEAPON));
registry.addComponent(entity, 'weapon', components.weapon(2, { meleeRange: 1 })); // a reach weapon
registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ attackDamage: 2 }));
```

- A **ranged** weapon adds `ammoType` (and, for self-thrown, `breakChance` + `stackable`).
- **Ammunition** is an item with an `ammunition` component, `equippable(Slots.AMMUNITION)`, and
  usually `stackable`.
- For flight art, add catalog entries `<name>-<dir>` and pass `directionalAttackSprites('<name>')` as
  the weapon's (or ammo's) `attackSprites`. Skip it and the weapon uses the wiggle.

Register the factory in [`entity-prefabs.js`](../../src/world/entities/entity-prefabs.js) like any item.

## Worth knowing

- **Damage is attribute-resolved, like all gear.** Damage is the `attack` score (base + the weapon's
  `attributeModifiers`, [equipment.md](equipment.md)) plus an ability bonus of half the governing score
  — DEX for a ranged strike, STR for melee — floored, min 1 (`resolveAttackDamage`,
  [attack-damage.js](../../src/combat/attack-damage.js)). "Ranged" means the strike spends ammo, so a
  spear's reach and a javelin's point-blank stab scale on STR. Arrows deliberately carry no modifiers,
  and the score sums **all** equipment slots, so any modifier on ammo would also boost melee —
  intentional non-special-casing, documented in the design doc.
- **Stacking is one entity with a count.** `splitStack` peels units off a stack; `inventory-stacking.js`
  merges on pickup and powers the Split / Stack all inventory actions (see above).
- **Old saves are migrated.** Save v7 backfills a range-1 `weapon` component onto pre-existing
  weapon-slot items and adds the ammunition slot to humanoid loadouts; the resolver also tolerates the
  un-migrated shape. See the design doc and [saving.md](saving.md).
- **Thrust vs. projectile is currently inferred from `ammoType`.** A no-ammo weapon thrusts; an
  ammo weapon flies one-way. The seam to make that an independent per-weapon choice (`flightStyle`) is
  noted in the design doc and commented in `action-attack.js`.
