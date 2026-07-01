import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createOrcCommander } from '../../world/entities/creatures.js';
import { createBow, createArrow, createSpear } from '../../world/entities/items.js';
import { executeEquip } from '../../actions/action-types/action-equip.js';
import { equipAmmo } from './equip-ammo.js';
import { Slots } from '../../../data/equipment-slots.js';

// Builds a commander, optionally wielding a weapon and carrying items in inventory.
const setup = (registry, { equip, carry = [] } = {}) => {
  const cmd = createOrcCommander(registry, 0, 0);
  const inventory = cmd.components.get('inventory');
  if (equip) {
    const weapon = equip(registry, null, null, cmd.id);
    inventory.items.push(weapon);
    executeEquip(cmd, { itemEntityId: weapon.id }, null, registry);
  }
  for (const make of carry) inventory.items.push(make(registry, null, null, cmd.id));
  return cmd;
};

describe('equip-ammo goal', () => {
  let registry;
  beforeEach(() => {
    registry = createEntityRegistry();
  });

  it('equips matching ammo when a bow is wielded', () => {
    const cmd = setup(registry, { equip: createBow, carry: [createArrow] });
    const arrow = cmd.components.get('inventory').items[0];
    expect(equipAmmo.evaluate({ selfEntity: cmd })).toEqual({
      action: { type: 'equip', itemEntityId: arrow.id },
    });
  });

  it('returns null when no weapon needs external ammo', () => {
    const cmd = setup(registry, { equip: createSpear, carry: [createArrow] });
    expect(equipAmmo.evaluate({ selfEntity: cmd })).toBeNull();
  });

  it('returns null when unarmed', () => {
    const cmd = setup(registry, { carry: [createArrow] });
    expect(equipAmmo.evaluate({ selfEntity: cmd })).toBeNull();
  });

  it('returns null when the quiver already holds the right ammo', () => {
    const cmd = setup(registry, { equip: createBow, carry: [createArrow] });
    const arrow = cmd.components.get('inventory').items[0];
    executeEquip(cmd, { itemEntityId: arrow.id }, null, registry);
    expect(cmd.components.get('wearsEquipment').slots[Slots.AMMUNITION]).toBe(arrow);
    expect(equipAmmo.evaluate({ selfEntity: cmd })).toBeNull();
  });

  it('returns null when no matching ammo is carried', () => {
    const cmd = setup(registry, { equip: createBow });
    expect(equipAmmo.evaluate({ selfEntity: cmd })).toBeNull();
  });
});
