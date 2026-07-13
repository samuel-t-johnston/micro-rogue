import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { humanoid } from '../../test-support/fixtures.js';
import { createBow, createArrow, createSpear } from '../../world/entities/items.js';
import { executeEquip } from '../../actions/action-types/action-equip.js';
import { equipAmmo } from './equip-ammo.js';
import { Slots } from '../../../data/equipment-slots.js';

// Builds a humanoid, optionally wielding a weapon and carrying items in inventory.
const setup = (registry, { equip, carry = [] } = {}) => {
  const unit = humanoid(registry);
  const inventory = unit.components.get('inventory');
  if (equip) {
    const weapon = equip(registry, null, null, unit.id);
    inventory.items.push(weapon);
    executeEquip(unit, { itemEntityId: weapon.id }, null, registry);
  }
  for (const make of carry) inventory.items.push(make(registry, null, null, unit.id));
  return unit;
};

describe('equip-ammo goal', () => {
  let registry;
  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('equips matching ammo when a bow is wielded', () => {
    const unit = setup(registry, { equip: createBow, carry: [createArrow] });
    const arrow = unit.components.get('inventory').items[0];
    expect(equipAmmo.evaluate({ selfEntity: unit })).toEqual({
      action: { type: 'equip', itemEntityId: arrow.id },
    });
  });

  it('returns null when no weapon needs external ammo', () => {
    const unit = setup(registry, { equip: createSpear, carry: [createArrow] });
    expect(equipAmmo.evaluate({ selfEntity: unit })).toBeNull();
  });

  it('returns null when unarmed', () => {
    const unit = setup(registry, { carry: [createArrow] });
    expect(equipAmmo.evaluate({ selfEntity: unit })).toBeNull();
  });

  it('returns null when the quiver already holds the right ammo', () => {
    const unit = setup(registry, { equip: createBow, carry: [createArrow] });
    const arrow = unit.components.get('inventory').items[0];
    executeEquip(unit, { itemEntityId: arrow.id }, null, registry);
    expect(unit.components.get('wearsEquipment').slots[Slots.AMMUNITION]).toBe(arrow);
    expect(equipAmmo.evaluate({ selfEntity: unit })).toBeNull();
  });

  it('returns null when no matching ammo is carried', () => {
    const unit = setup(registry, { equip: createBow });
    expect(equipAmmo.evaluate({ selfEntity: unit })).toBeNull();
  });
});
