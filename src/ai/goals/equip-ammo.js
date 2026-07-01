import { Slots } from '../../../data/equipment-slots.js';
import { getWeaponStats } from '../../combat/weapons.js';

/**
 * NPC goal: loads ammunition for an equipped weapon that needs it. If the wielded weapon consumes
 * external ammo (a bow → 'arrow') and the quiver doesn't already hold the matching type, it equips a
 * matching stack from inventory. Sits just below equip-weapon so the weapon is chosen first, then its
 * ammo; both run eagerly, arming the creature before it engages. Weapons that need no quiver — null
 * (unarmed/melee) or 'self' (a self-thrown javelin) — return null, as does an already-loaded quiver.
 */
export const equipAmmo = {
  evaluate(context) {
    const wears = context.self.components.get('wearsEquipment');
    const inventory = context.self.components.get('inventory');
    if (!wears || !inventory) return null;

    const { ammoType } = getWeaponStats(context.self);
    if (ammoType == null || ammoType === 'self') return null;

    const current = wears.slots[Slots.AMMUNITION];
    if (current?.components.get('ammunition')?.ammoType === ammoType) return null;

    const match = inventory.items.find(
      (item) => item.components.get('ammunition')?.ammoType === ammoType,
    );
    if (!match) return null;

    return { action: { type: 'equip', itemEntityId: match.id } };
  },
};
