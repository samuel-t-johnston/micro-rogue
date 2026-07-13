import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { humanoid } from '../../test-support/fixtures.js';
import { createSpear, createDagger, createBow, createArrow } from '../../world/entities/items.js';
import { executeEquip } from '../../actions/action-types/action-equip.js';
import { equipWeapon } from './equip-weapon.js';
import { Slots } from '../../../data/equipment-slots.js';

// Builds an unarmed humanoid carrying the given weapon factories in inventory.
const armed = (registry, ...weaponFactories) => {
  const unit = humanoid(registry);
  const inventory = unit.components.get('inventory');
  for (const make of weaponFactories) inventory.items.push(make(registry, null, null, unit.id));
  return unit;
};

describe('equip-weapon goal', () => {
  let registry;
  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('equips a weapon from inventory when unarmed', () => {
    const unit = armed(registry, createSpear);
    const spear = unit.components.get('inventory').items[0];
    expect(equipWeapon.evaluate({ selfEntity: unit })).toEqual({
      action: { type: 'equip', itemEntityId: spear.id },
    });
  });

  it('returns null once the best weapon is already equipped', () => {
    const unit = armed(registry, createSpear);
    const spear = unit.components.get('inventory').items[0];
    executeEquip(unit, { itemEntityId: spear.id }, null, registry);
    expect(unit.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(spear);
    expect(equipWeapon.evaluate({ selfEntity: unit })).toBeNull();
  });

  it('picks the highest-damage weapon among several', () => {
    const unit = armed(registry, createDagger, createSpear); // dagger +1, spear +2
    const spear = unit.components.get('inventory').items[1];
    expect(equipWeapon.evaluate({ selfEntity: unit })).toEqual({
      action: { type: 'equip', itemEntityId: spear.id },
    });
  });

  it('returns null when inventory holds no weapon', () => {
    const unit = humanoid(registry);
    expect(equipWeapon.evaluate({ selfEntity: unit })).toBeNull();
  });

  // Equips a weapon from inventory and returns the entity (for follow-up assertions).
  const equipFromInventory = (unit, make) => {
    const item = make(registry, null, null, unit.id);
    unit.components.get('inventory').items.push(item);
    executeEquip(unit, { itemEntityId: item.id }, null, registry);
    return item;
  };

  it('stows an equipped bow once its ammo is gone', () => {
    const unit = humanoid(registry);
    equipFromInventory(unit, createBow); // no arrows anywhere → the bow can never fire
    expect(equipWeapon.evaluate({ selfEntity: unit })).toEqual({
      action: { type: 'unequip', slot: Slots.WEAPON },
    });
  });

  it('does not stow a bow while arrows remain in the quiver', () => {
    const unit = humanoid(registry);
    equipFromInventory(unit, createBow);
    equipFromInventory(unit, createArrow); // loads the ammunition slot
    expect(equipWeapon.evaluate({ selfEntity: unit })).toBeNull();
  });

  it('does not re-equip a dry bow sitting in inventory', () => {
    const unit = humanoid(registry);
    unit.components.get('inventory').items.push(createBow(registry, null, null, unit.id));
    expect(equipWeapon.evaluate({ selfEntity: unit })).toBeNull();
  });

  it('equips a usable weapon over a dry equipped bow', () => {
    const unit = humanoid(registry);
    equipFromInventory(unit, createBow); // dry → worth less than bare hands
    const spear = createSpear(registry, null, null, unit.id);
    unit.components.get('inventory').items.push(spear);
    expect(equipWeapon.evaluate({ selfEntity: unit })).toEqual({
      action: { type: 'equip', itemEntityId: spear.id },
    });
  });
});
