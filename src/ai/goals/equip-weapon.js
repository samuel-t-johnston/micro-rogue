import { Slots } from '../../../data/equipment-slots.js';
import { resolveAmmo } from '../../combat/weapons.js';

// A weapon item's attack modifier (0 if it carries none) — the "best weapon" yardstick.
const damageOf = (item) => item?.components.get('attributeModifiers')?.attack ?? 0;

// Whether `item` can currently attack at all for `self`. A weapon that fires external ammo (a bow) is
// usable only while matching ammo is reachable — already in the quiver (resolveAmmo) or carried in
// inventory to load. Melee weapons (no ammoType) and self-thrown weapons ('self') are always usable.
// This is what lets a bow that has run dry be recognised as dead weight (see evaluate).
function weaponUsable(self, item) {
  const ammoType = item.components.get('weapon')?.ammoType ?? null;
  if (ammoType == null || ammoType === 'self') return true;
  if (resolveAmmo(self, ammoType)) return true;
  return self.components
    .get('inventory')
    .items.some((i) => i.components.get('ammunition')?.ammoType === ammoType);
}

/**
 * NPC goal: keeps the best usable weapon wielded. From its own inventory it equips the highest-damage
 * weapon it can actually use, if that beats what's in hand. And when the wielded weapon has become dead
 * weight — a bow whose ammo has run out — it stows it, so the creature falls back to bare-handed melee
 * (which attack-in-range and chase then drive) instead of standing there dry-firing. Eager: it arms a
 * creature while idle, before it ever engages.
 *
 * Scoring a dry ranged weapon below bare hands is the whole trick. It stops the goal both from equipping
 * a spent bow out of the bag and from leaving one equipped — and that second part matters for more than
 * tidiness: a bow reports range 15 regardless of ammo, so a still-equipped dry bow would have
 * attack-in-range propose a shot the creature can't pay for, which misfires as a *free* action and spins
 * the turn loop. Stowing it (this goal sits above attack-in-range) closes that off. Returns null once the
 * best choice is already in effect.
 */
export const equipWeapon = {
  evaluate(context) {
    const self = context.selfEntity;
    const inventory = self.components.get('inventory');
    const wears = self.components.get('wearsEquipment');
    if (!inventory || !wears) return null;

    // Best *usable* weapon to wield from inventory; an unusable one (a dry bow) is no candidate.
    let best = null;
    for (const item of inventory.items) {
      if (item.components.get('equippable')?.slot !== Slots.WEAPON) continue;
      if (!weaponUsable(self, item)) continue;
      if (!best || damageOf(item) > damageOf(best)) best = item;
    }

    // Bare hands score 0; an equipped weapon scores its damage while usable, and below bare hands (-1)
    // once it can't fire — so stowing the dry weapon wins.
    const equipped = wears.slots[Slots.WEAPON];
    const equippedValue = equipped ? (weaponUsable(self, equipped) ? damageOf(equipped) : -1) : 0;

    if (best && damageOf(best) > equippedValue) {
      return { action: { type: 'equip', itemEntityId: best.id } };
    }
    if (equipped && equippedValue < 0) {
      return { action: { type: 'unequip', slot: Slots.WEAPON } };
    }
    return null;
  },
};
