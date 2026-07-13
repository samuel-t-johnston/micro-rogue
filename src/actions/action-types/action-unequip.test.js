import { describe, it, expect, beforeEach } from 'vitest';
import { executeUnequip } from './action-unequip.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { humanoid, equippable } from '../../test-support/fixtures.js';
import { Slots } from '../../../data/equipment-slots.js';

describe('executeUnequip', () => {
  let registry, actor, dagger;

  beforeEach(() => {
    registry = createEntityRegistry();
    actor = humanoid(registry);

    dagger = equippable(registry, { slot: Slots.WEAPON, ownerId: actor.id });
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
