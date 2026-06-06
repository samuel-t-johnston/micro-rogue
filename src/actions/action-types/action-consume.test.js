import { describe, it, expect, beforeEach } from 'vitest';
import { executeConsume } from './action-consume.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createHealingPotion, createPotionOfPain } from '../../world/items.js';
import { components } from '../../world/components.js';

describe('executeConsume', () => {
  let registry, actor, potion;

  beforeEach(() => {
    registry = createEntityRegistry();
    actor = registry.createEntity();
    registry.addComponent(actor, 'inventory', components.inventory());
    registry.addComponent(actor, 'health', components.health(10, 20));

    potion = createHealingPotion(registry, null, null, actor.id);
    actor.components.get('inventory').items.push(potion);
  });

  it('applies the healing effect to the actor', () => {
    executeConsume(actor, { itemEntityId: potion.id }, null, registry);
    expect(actor.components.get('health').current).toBe(20);
  });

  it('removes the item from the actor inventory', () => {
    executeConsume(actor, { itemEntityId: potion.id }, null, registry);
    expect(actor.components.get('inventory').items).not.toContain(potion);
  });

  it('destroys the item entity', () => {
    const id = potion.id;
    executeConsume(actor, { itemEntityId: potion.id }, null, registry);
    expect(registry.getEntity(id)).toBeNull();
  });

  it('consumes a turn', () => {
    expect(executeConsume(actor, { itemEntityId: potion.id }, null, registry)).toBe(false);
  });

  it('clamps healing at health.max — no overheal', () => {
    actor.components.get('health').current = 18;
    executeConsume(actor, { itemEntityId: potion.id }, null, registry);
    expect(actor.components.get('health').current).toBe(20);
  });

  it('potion of pain damages the actor', () => {
    const pain = createPotionOfPain(registry, null, null, actor.id);
    actor.components.get('inventory').items.push(pain);
    executeConsume(actor, { itemEntityId: pain.id }, null, registry);
    expect(actor.components.get('health').current).toBe(5);
  });

  it('potion of pain clamps damage at 0', () => {
    const pain = createPotionOfPain(registry, null, null, actor.id);
    actor.components.get('inventory').items.push(pain);
    actor.components.get('health').current = 3;
    executeConsume(actor, { itemEntityId: pain.id }, null, registry);
    expect(actor.components.get('health').current).toBe(0);
  });

  it('returns false and does nothing when item not in inventory', () => {
    const result = executeConsume(actor, { itemEntityId: 9999 }, null, registry);
    expect(result).toBe(false);
    expect(actor.components.get('inventory').items).toContain(potion);
    expect(actor.components.get('health').current).toBe(10);
  });

  it('returns false and does nothing when item is not consumable', () => {
    const rock = registry.createEntity();
    registry.addComponent(rock, 'item', components.item({ type: 'inventory', ownerId: actor.id }));
    actor.components.get('inventory').items.push(rock);
    const result = executeConsume(actor, { itemEntityId: rock.id }, null, registry);
    expect(result).toBe(false);
    expect(actor.components.get('inventory').items).toContain(rock);
    expect(actor.components.get('health').current).toBe(10);
  });
});
