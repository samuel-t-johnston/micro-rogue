import { describe, it, expect, beforeEach } from 'vitest';
import { executeSplit } from './action-split.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { stackable } from '../../test-support/fixtures.js';
import { components } from '../../world/entities/components.js';

describe('executeSplit', () => {
  let registry, actor;

  beforeEach(() => {
    registry = createEntityRegistry();
    actor = registry.createEntity();
    registry.addComponent(actor, 'inventory', components.inventory());
  });

  function giveStack(count) {
    const stack = stackable(registry, { ownerId: actor.id, count });
    actor.components.get('inventory').items.push(stack);
    return stack;
  }

  it('splits a quantity off into a new inventory stack and is a free action', () => {
    const stack = giveStack(20);
    const free = executeSplit(actor, { itemEntityId: stack.id, quantity: 5 }, null, registry);

    expect(free).toBe(true);
    const inv = actor.components.get('inventory').items;
    expect(inv).toHaveLength(2);
    expect(stack.components.get('stackable').count).toBe(15);
    const created = inv.find((it) => it !== stack);
    expect(created.components.get('stackable').count).toBe(5);
    expect(created.components.get('item').location).toEqual({
      type: 'inventory',
      ownerId: actor.id,
    });
  });

  it('does nothing when the quantity is not below the stack count', () => {
    const stack = giveStack(5);
    executeSplit(actor, { itemEntityId: stack.id, quantity: 5 }, null, registry);
    expect(actor.components.get('inventory').items).toEqual([stack]);
    expect(stack.components.get('stackable').count).toBe(5);
  });

  it('does nothing for a quantity below 1', () => {
    const stack = giveStack(5);
    executeSplit(actor, { itemEntityId: stack.id, quantity: 0 }, null, registry);
    expect(actor.components.get('inventory').items).toEqual([stack]);
  });

  it('does nothing when the item is not in the actor inventory (e.g. equipped)', () => {
    const stack = stackable(registry, { ownerId: actor.id }); // not pushed into inventory
    const free = executeSplit(actor, { itemEntityId: stack.id, quantity: 2 }, null, registry);
    expect(free).toBe(true);
    expect(actor.components.get('inventory').items).toHaveLength(0);
  });
});
