import { describe, it, expect, beforeEach } from 'vitest';
import { executeDrop } from './action-drop.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { consumable, equippable } from '../../test-support/fixtures.js';
import { components } from '../../world/entities/components.js';
import { Slots } from '../../../data/equipment-slots.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

describe('executeDrop', () => {
  let registry, level, actor, potion;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
    actor = registry.createEntity();
    registry.addComponent(actor, 'position', components.position(3, 4));
    registry.addComponent(actor, 'inventory', components.inventory());

    potion = consumable(registry, { ownerId: actor.id });
    actor.components.get('inventory').items.push(potion);
  });

  it('removes the item from the actor inventory', () => {
    executeDrop(actor, { itemEntityId: potion.id }, level, registry);
    expect(actor.components.get('inventory').items).not.toContain(potion);
  });

  it('places the item on the level at the actor position', () => {
    executeDrop(actor, { itemEntityId: potion.id }, level, registry);
    expect(potion.components.get('position')).toEqual({ x: 3, y: 4 });
    expect(level.entities).toContain(potion);
    expect(level.getEntitiesAt(3, 4)).toContain(potion);
  });

  it('updates item.location to map', () => {
    executeDrop(actor, { itemEntityId: potion.id }, level, registry);
    expect(potion.components.get('item').location).toEqual({ type: 'map' });
  });

  it('consumes a turn', () => {
    expect(executeDrop(actor, { itemEntityId: potion.id }, level, registry)).toBe(false);
  });

  it('drops equippable items just like consumables', () => {
    const dagger = equippable(registry, { slot: Slots.WEAPON, ownerId: actor.id });
    actor.components.get('inventory').items.push(dagger);
    executeDrop(actor, { itemEntityId: dagger.id }, level, registry);
    expect(actor.components.get('inventory').items).not.toContain(dagger);
    expect(level.getEntitiesAt(3, 4)).toContain(dagger);
  });

  it('returns false and does nothing when item not in inventory', () => {
    const result = executeDrop(actor, { itemEntityId: 9999 }, level, registry);
    expect(result).toBe(false);
    expect(actor.components.get('inventory').items).toContain(potion);
  });

  it('returns false and does nothing when actor has no inventory', () => {
    const bare = registry.createEntity();
    registry.addComponent(bare, 'position', components.position(1, 1));
    const result = executeDrop(bare, { itemEntityId: potion.id }, level, registry);
    expect(result).toBe(false);
    expect(level.entities).not.toContain(potion);
  });
});
