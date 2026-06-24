import { describe, it, expect, beforeEach } from 'vitest';
import { executePickup } from './action-pickup.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { createHealingPotion } from '../../world/entities/items.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

describe('executePickup', () => {
  let registry, level, actor, potion;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();

    actor = registry.createEntity();
    registry.addComponent(actor, 'position', { x: 2, y: 2 });
    registry.addComponent(actor, 'inventory', { items: [] });

    potion = createHealingPotion(registry, 2, 2);
    level.placeEntity(potion);
  });

  it('removes the item from the level', () => {
    executePickup(actor, { itemEntityId: potion.id }, level, registry);
    expect(level.entities).not.toContain(potion);
  });

  it('updates item.location to inventory with the actor id', () => {
    executePickup(actor, { itemEntityId: potion.id }, level, registry);
    expect(potion.components.get('item').location).toEqual({
      type: 'inventory',
      ownerId: actor.id,
    });
  });

  it('adds the item to the actor inventory', () => {
    executePickup(actor, { itemEntityId: potion.id }, level, registry);
    expect(actor.components.get('inventory').items).toContain(potion);
  });

  it('returns false (consumes a turn)', () => {
    expect(executePickup(actor, { itemEntityId: potion.id }, level, registry)).toBe(false);
  });

  it('returns false and leaves the item on the level when item not found', () => {
    const result = executePickup(actor, { itemEntityId: 9999 }, level, registry);
    expect(result).toBe(false);
    expect(level.entities).toContain(potion);
  });

  it('returns false and leaves the item on the level when actor has no inventory', () => {
    const bare = registry.createEntity();
    registry.addComponent(bare, 'position', { x: 2, y: 2 });
    const result = executePickup(bare, { itemEntityId: potion.id }, level, registry);
    expect(result).toBe(false);
    expect(level.entities).toContain(potion);
  });
});
