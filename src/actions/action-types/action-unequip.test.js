import { describe, it, expect, beforeEach } from 'vitest';
import { executeUnequip } from './action-unequip.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createDagger } from '../../world/items.js';
import { components } from '../../world/components.js';
import { Slots, HUMANOID_SLOTS } from '../../../data/equipment-slots.js';

describe('executeUnequip', () => {
  let registry, actor, dagger;

  beforeEach(() => {
    registry = createEntityRegistry();
    actor = registry.createEntity();
    registry.addComponent(actor, 'inventory', components.inventory());
    registry.addComponent(actor, 'wearsEquipment', components.wearsEquipment(HUMANOID_SLOTS));

    dagger = createDagger(registry, null, null, actor.id);
    actor.components.get('wearsEquipment').slots[Slots.WEAPON] = dagger;
    dagger.components.get('item').location = {
      type: 'equipped',
      ownerId: actor.id,
      slot: Slots.WEAPON,
    };
  });

  it('moves the item from the slot into inventory', () => {
    executeUnequip(actor, { slot: Slots.WEAPON }, null, registry);
    expect(actor.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(null);
    expect(actor.components.get('inventory').items).toContain(dagger);
  });

  it('updates item.location to inventory with the actor id', () => {
    executeUnequip(actor, { slot: Slots.WEAPON }, null, registry);
    expect(dagger.components.get('item').location).toEqual({
      type: 'inventory',
      ownerId: actor.id,
    });
  });

  it('consumes a turn', () => {
    expect(executeUnequip(actor, { slot: Slots.WEAPON }, null, registry)).toBe(false);
  });

  it('returns false and does nothing for an empty slot', () => {
    const result = executeUnequip(actor, { slot: Slots.ARMOR }, null, registry);
    expect(result).toBe(false);
    expect(actor.components.get('inventory').items).not.toContain(dagger);
  });

  it('returns false and does nothing for an unknown slot', () => {
    const result = executeUnequip(actor, { slot: 'helmet' }, null, registry);
    expect(result).toBe(false);
    expect(actor.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(dagger);
  });
});
