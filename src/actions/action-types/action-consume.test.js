import { describe, it, expect, beforeEach } from 'vitest';
import { executeConsume } from './action-consume.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { consumable } from '../../test-support/fixtures.js';
import { components } from '../../world/entities/components.js';

describe('executeConsume', () => {
  let registry, actor, potion;

  beforeEach(() => {
    registry = createEntityRegistry();
    actor = registry.createEntity();
    registry.addComponent(actor, 'inventory', components.inventory());
    registry.addComponent(
      actor,
      'attributes',
      components.attributes({ hp: 10, hpBase: 20, con: 0 }),
    ); // maxHP = hpBase

    potion = consumable(registry, { effect: 'heal', amount: 10, ownerId: actor.id });
    actor.components.get('inventory').items.push(potion);
  });

  it('applies the healing effect to the actor', () => {
    const amount = potion.components.get('consumable').params.amount;
    const before = actor.components.get('attributes').hp;
    executeConsume(actor, { itemEntityId: potion.id }, null, registry);
    expect(actor.components.get('attributes').hp).toBe(Math.min(before + amount, 20)); // maxHP = 20
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
    const amount = potion.components.get('consumable').params.amount;
    actor.components.get('attributes').hp = 20 - amount + 1; // one point short of a full heal → overshoots
    executeConsume(actor, { itemEntityId: potion.id }, null, registry);
    expect(actor.components.get('attributes').hp).toBe(20); // capped at maxHP
  });

  it('potion of pain damages the actor', () => {
    const pain = consumable(registry, { effect: 'damage', amount: 5, ownerId: actor.id });
    const dmg = pain.components.get('consumable').params.amount;
    actor.components.get('inventory').items.push(pain);
    const before = actor.components.get('attributes').hp;
    executeConsume(actor, { itemEntityId: pain.id }, null, registry);
    expect(actor.components.get('attributes').hp).toBe(before - dmg);
  });

  it('a lethal potion of pain kills the consumer', () => {
    const level = createLevel();
    const pain = consumable(registry, { effect: 'damage', amount: 5, ownerId: actor.id });
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

  // ACTION-1 (B3): consuming one unit of a *stacked* consumable decrements the stack instead of
  // destroying the whole entity. Latent today (no shipped consumable is stackable) but a fork adding
  // stackable food would lose the whole stack on one bite.
  it('decrements a stacked consumable instead of destroying the whole stack', () => {
    const food = registry.createEntity();
    registry.addComponent(food, 'item', components.item({ type: 'inventory', ownerId: actor.id }));
    registry.addComponent(food, 'consumable', components.consumable('heal', { amount: 2 }));
    registry.addComponent(food, 'stackable', components.stackable(10, 5));
    food.components.get('stackable').count = 3;
    actor.components.get('inventory').items.push(food);

    executeConsume(actor, { itemEntityId: food.id }, null, registry);

    expect(registry.getEntity(food.id)).not.toBeNull(); // survives — the stack is decremented
    expect(food.components.get('stackable').count).toBe(2);
    expect(actor.components.get('inventory').items).toContain(food); // still in inventory
  });

  it('destroys a stacked consumable when its last unit is consumed', () => {
    const food = registry.createEntity();
    registry.addComponent(food, 'item', components.item({ type: 'inventory', ownerId: actor.id }));
    registry.addComponent(food, 'consumable', components.consumable('heal', { amount: 2 }));
    registry.addComponent(food, 'stackable', components.stackable(10, 5));
    food.components.get('stackable').count = 1; // last unit
    actor.components.get('inventory').items.push(food);

    executeConsume(actor, { itemEntityId: food.id }, null, registry);

    expect(registry.getEntity(food.id)).toBeNull(); // last unit → destroyed
    expect(actor.components.get('inventory').items).not.toContain(food);
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
