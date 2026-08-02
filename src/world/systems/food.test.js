import { describe, it, expect } from 'vitest';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { components } from '../entities/components.js';
import { selectEasyEatFood } from './food.js';

// A player-shaped host with an inventory; food items are added via addFood below.
function player(registry) {
  const p = registry.createEntity();
  registry.addComponent(p, 'inventory', components.inventory());
  return p;
}

// Adds an item to the owner's inventory. `nutrition` sets the satiate amount; `isFood` tags it (a
// non-food consumable is how we prove the selector ignores potions and the like).
function addItem(registry, owner, { name, nutrition, isFood = true }) {
  const item = registry.createEntity();
  registry.addComponent(item, 'name', components.name(name));
  registry.addComponent(
    item,
    'consumable',
    components.consumable('satiate', { amount: nutrition }),
  );
  if (isFood) registry.addComponent(item, 'food', components.food());
  owner.components.get('inventory').items.push(item);
  return item;
}

describe('selectEasyEatFood', () => {
  it('returns null when the player carries no food', () => {
    const reg = createEntityRegistry();
    const p = player(reg);
    addItem(reg, p, { name: 'Healing Potion', nutrition: 0, isFood: false });
    expect(selectEasyEatFood(p)).toBeNull();
  });

  it('returns null for a null player', () => {
    expect(selectEasyEatFood(null)).toBeNull();
  });

  it('picks the food with the least satiation', () => {
    const reg = createEntityRegistry();
    const p = player(reg);
    addItem(reg, p, { name: 'Meat', nutrition: 150 });
    const grapes = addItem(reg, p, { name: 'Grapes', nutrition: 50 });
    addItem(reg, p, { name: 'Bread', nutrition: 100 });
    expect(selectEasyEatFood(p)).toBe(grapes);
  });

  it('ignores non-food consumables even when they restore less', () => {
    const reg = createEntityRegistry();
    const p = player(reg);
    addItem(reg, p, { name: 'Scroll of Healing', nutrition: 15, isFood: false });
    const bread = addItem(reg, p, { name: 'Bread', nutrition: 100 });
    expect(selectEasyEatFood(p)).toBe(bread);
  });

  it('breaks a nutrition tie toward the earlier inventory item', () => {
    const reg = createEntityRegistry();
    const p = player(reg);
    const first = addItem(reg, p, { name: 'Grapes', nutrition: 50 });
    addItem(reg, p, { name: 'More Grapes', nutrition: 50 });
    expect(selectEasyEatFood(p)).toBe(first);
  });
});
