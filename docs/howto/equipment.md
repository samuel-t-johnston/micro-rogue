# Equipment

*Equipment-specific item behaviour — slots, wearing, and stat modifiers. Read [item.md](item.md) first for the generic item recipe; weapons add range/ammunition/animation on top of this — see [weapons.md](weapons.md).*

## How it works

Equipment is built from three pieces plus a resolver:

**`equippable` component** — on the item; names the slot it goes in. Slot names come from the `Slots` enum in [`data/equipment-slots.js`](../../data/equipment-slots.js) — never bare strings, so a typo crashes at import time.

**`wearsEquipment` component** — on the wearer; defines its named slots, each holding an item entity reference or `null`. `HUMANOID_SLOTS` (weapon, armor, ammunition) is the default loadout; an entity can declare any subset/superset.

**equip / unequip actions** — [`action-equip.js`](../../src/actions/action-types/action-equip.js), [`action-unequip.js`](../../src/actions/action-types/action-unequip.js). Equipping into an occupied slot is an **atomic swap**: the displaced item returns to inventory, logged as its own unequip before the equip.

**`attributeModifiers` + the attribute resolver** — the item's stat contributions (e.g. `{ attackDamage: 1 }`) are stored as data; [`getAttribute`](../../src/attributes/attributes.js) computes an entity's effective stat as **base + sum of worn modifiers, derived on demand**. Nothing is added to or subtracted from stored stats on equip/unequip.

## Add a new equippable item

Follow the [item.md](item.md) recipe, then add the equipment components:

```js
registry.addComponent(entity, 'item', components.item(location));
registry.addComponent(entity, 'equippable', components.equippable(Slots.ARMOR));
registry.addComponent(entity, 'attributeModifiers', components.attributeModifiers({ HP: 5 }));
```

Need a slot that doesn't exist yet? Add it to the `Slots` enum (and `HUMANOID_SLOTS` if humanoids should have it) in [`data/equipment-slots.js`](../../data/equipment-slots.js).

## Worth knowing

- **Stats are derived, never stored.** Because `getAttribute` recomputes from worn gear each read, there is no bonus to "remember to remove" when gear comes off, an item is destroyed, or the wearer dies — the next read simply doesn't see it. Don't reintroduce add-on-equip / subtract-on-unequip bookkeeping.
- **Slot names go through the enum.** Reference `Slots.WEAPON`, not `'weapon'`.
- **Still fairly thin.** Slots are `weapon`, `armor`, and `ammunition`; equippables are the dagger/sword/spear/javelin/bow (weapon), leather armor (armor), and arrows (ammunition); only `attackDamage` / `HP` attributes are wired into the resolver. Conventions for multi-slot items, set bonuses, etc. are not established — extend deliberately rather than assuming a pattern.
- **`getAttribute` sums every slot.** The resolver adds `attributeModifiers` across all worn slots, including ammunition — so a stat on equipped ammo would also boost melee. Arrows carry none on purpose; see [weapons.md](weapons.md).
