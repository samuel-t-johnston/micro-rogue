import { describe, it, expect, beforeEach } from 'vitest';
import { executeEquip } from './action-equip.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { humanoid, equippable } from '../../test-support/fixtures.js';
import { components } from '../../world/entities/components.js';
import { Slots } from '../../../data/equipment-slots.js';

describe('executeEquip', () => {
  let registry, actor, dagger;

  beforeEach(() => {
    registry = createEntityRegistry();
    actor = humanoid(registry);

    dagger = equippable(registry, { slot: Slots.WEAPON, ownerId: actor.id });
    actor.components.get('inventory').items.push(dagger);
  });

  it('moves the item from inventory into the matching slot', () => {
    executeEquip(actor, { itemEntityId: dagger.id }, null, registry);
    expect(actor.components.get('inventory').items).not.toContain(dagger);
    expect(actor.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(dagger);
  });

  it('updates item.location to equipped with slot and owner', () => {
    executeEquip(actor, { itemEntityId: dagger.id }, null, registry);
    expect(dagger.components.get('item').location).toEqual({
      type: 'equipped',
      ownerId: actor.id,
      slot: Slots.WEAPON,
    });
  });

  it('consumes a turn', () => {
    expect(executeEquip(actor, { itemEntityId: dagger.id }, null, registry)).toBe(false);
  });

  it('swaps the previously equipped item back to inventory', () => {
    const oldDagger = equippable(registry, { slot: Slots.WEAPON, ownerId: actor.id });
    actor.components.get('wearsEquipment').slots[Slots.WEAPON] = oldDagger;
    oldDagger.components.get('item').location = {
      type: 'equipped',
      ownerId: actor.id,
      slot: Slots.WEAPON,
    };

    executeEquip(actor, { itemEntityId: dagger.id }, null, registry);

    expect(actor.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(dagger);
    expect(actor.components.get('inventory').items).toContain(oldDagger);
    expect(oldDagger.components.get('item').location).toEqual({
      type: 'inventory',
      ownerId: actor.id,
    });
  });

  it('returns false and does nothing when item not in inventory', () => {
    const result = executeEquip(actor, { itemEntityId: 9999 }, null, registry);
    expect(result).toBe(false);
    expect(actor.components.get('wearsEquipment').slots[Slots.WEAPON]).toBe(null);
  });

  it('returns false and does nothing when item is not equippable', () => {
    const rock = registry.createEntity();
    registry.addComponent(rock, 'item', components.item({ type: 'inventory', ownerId: actor.id }));
    actor.components.get('inventory').items.push(rock);

    const result = executeEquip(actor, { itemEntityId: rock.id }, null, registry);
    expect(result).toBe(false);
    expect(actor.components.get('inventory').items).toContain(rock);
  });
});
