import { describe, it, expect, beforeEach } from 'vitest';
import { executeConsume } from './action-consume.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { createHealingPotion, createPotionOfPain } from '../../world/entities/items.js';
import { components } from '../../world/entities/components.js';

describe('executeConsume', () => {
  let registry, actor, potion;

  beforeEach(() => {
    registry = createEntityRegistry();
    actor = registry.createEntity();
    registry.addComponent(actor, 'inventory', components.inventory());
    registry.addComponent(actor, 'attributes', components.attributes({ hp: 10, hpBase: 20, con: 0 })); // maxHP = hpBase

    potion = createHealingPotion(registry, null, null, actor.id);
    actor.components.get('inventory').items.push(potion);
  });

  it('applies the healing effect to the actor', () => {
    executeConsume(actor, { itemEntityId: potion.id }, null, registry);
    expect(actor.components.get('attributes').hp).toBe(20);
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
    actor.components.get('attributes').hp = 18;
    executeConsume(actor, { itemEntityId: potion.id }, null, registry);
    expect(actor.components.get('attributes').hp).toBe(20);
  });

  it('potion of pain damages the actor', () => {
    const pain = createPotionOfPain(registry, null, null, actor.id);
    const dmg = pain.components.get('consumable').params.amount;
    actor.components.get('inventory').items.push(pain);
    const before = actor.components.get('attributes').hp;
    executeConsume(actor, { itemEntityId: pain.id }, null, registry);
    expect(actor.components.get('attributes').hp).toBe(before - dmg);
  });

  it('a lethal potion of pain kills the consumer', () => {
    const level = createLevel();
    const pain = createPotionOfPain(registry, null, null, actor.id);
    actor.components.get('inventory').items.push(pain);
    actor.components.get('attributes').hp = 1; // below the pain potion's damage — lethal
    executeConsume(actor, { itemEntityId: pain.id }, level, registry);
    expect(registry.getEntity(actor.id)).toBeNull();
  });

  it('returns false and does nothing when item not in inventory', () => {
    const result = executeConsume(actor, { itemEntityId: 9999 }, null, registry);
    expect(result).toBe(false);
    expect(actor.components.get('inventory').items).toContain(potion);
    expect(actor.components.get('attributes').hp).toBe(10);
  });

  it('returns false and does nothing when item is not consumable', () => {
    const rock = registry.createEntity();
    registry.addComponent(rock, 'item', components.item({ type: 'inventory', ownerId: actor.id }));
    actor.components.get('inventory').items.push(rock);
    const result = executeConsume(actor, { itemEntityId: rock.id }, null, registry);
    expect(result).toBe(false);
    expect(actor.components.get('inventory').items).toContain(rock);
    expect(actor.components.get('attributes').hp).toBe(10);
  });
});
