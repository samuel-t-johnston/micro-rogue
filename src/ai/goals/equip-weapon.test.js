import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createOrc } from '../../world/entities/creatures.js';
import { createSpear, createDagger, createBow, createArrow } from '../../world/entities/items.js';
import { executeEquip } from '../../actions/action-types/action-equip.js';
import { equipWeapon } from './equip-weapon.js';
import { Slots } from '../../../data/equipment-slots.js';

// Builds an unarmed orc carrying the given weapon factories in inventory.
const armedOrc = (registry, ...weaponFactories) => {
  const orc = createOrc(registry, 0, 0);
  const inventory = orc.components.get('inventory');
  for (const make of weaponFactories) inventory.items.push(make(registry, null, null, orc.id));
  return orc;
};

describe('equip-weapon goal', () => {
  let registry;
  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('equips a weapon from inventory when unarmed', () => {
    const orc = armedOrc(registry, createSpear);
    const spear = orc.components.get('inventory').items[0];
    expect(equipWeapon.evaluate({ self: orc })).toEqual({
      action: { type: 'equip', itemEntityId: spear.id },
    });
  });

  it('returns null once the best weapon is already equipped', () => {
    const orc = armedOrc(registry, createSpear);
    const spear = orc.components.get('inventory').items[0];
    executeEquip(orc, { itemEntityId: spear.id }, null, registry);
    expect(orc.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(spear);
    expect(equipWeapon.evaluate({ self: orc })).toBeNull();
  });

  it('picks the highest-damage weapon among several', () => {
    const orc = armedOrc(registry, createDagger, createSpear); // dagger +1, spear +2
    const spear = orc.components.get('inventory').items[1];
    expect(equipWeapon.evaluate({ self: orc })).toEqual({
      action: { type: 'equip', itemEntityId: spear.id },
    });
  });

  it('returns null when inventory holds no weapon', () => {
    const orc = createOrc(registry, 0, 0);
    expect(equipWeapon.evaluate({ self: orc })).toBeNull();
  });

  // Equips a weapon from inventory and returns the entity (for follow-up assertions).
  const equipFromInventory = (orc, make) => {
    const item = make(registry, null, null, orc.id);
    orc.components.get('inventory').items.push(item);
    executeEquip(orc, { itemEntityId: item.id }, null, registry);
    return item;
  };

  it('stows an equipped bow once its ammo is gone', () => {
    const orc = createOrc(registry, 0, 0);
    equipFromInventory(orc, createBow); // no arrows anywhere → the bow can never fire
    expect(equipWeapon.evaluate({ self: orc })).toEqual({
      action: { type: 'unequip', slot: Slots.WEAPON },
    });
  });

  it('does not stow a bow while arrows remain in the quiver', () => {
    const orc = createOrc(registry, 0, 0);
    equipFromInventory(orc, createBow);
    equipFromInventory(orc, createArrow); // loads the ammunition slot
    expect(equipWeapon.evaluate({ self: orc })).toBeNull();
  });

  it('does not re-equip a dry bow sitting in inventory', () => {
    const orc = createOrc(registry, 0, 0);
    orc.components.get('inventory').items.push(createBow(registry, null, null, orc.id));
    expect(equipWeapon.evaluate({ self: orc })).toBeNull();
  });

  it('equips a usable weapon over a dry equipped bow', () => {
    const orc = createOrc(registry, 0, 0);
    equipFromInventory(orc, createBow); // dry → worth less than bare hands
    const spear = createSpear(registry, null, null, orc.id);
    orc.components.get('inventory').items.push(spear);
    expect(equipWeapon.evaluate({ self: orc })).toEqual({
      action: { type: 'equip', itemEntityId: spear.id },
    });
  });
});
