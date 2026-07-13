import { describe, it, expect, beforeEach } from 'vitest';
import { executeStackAll } from './action-stack-all.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { stackable } from '../../test-support/fixtures.js';
import { components } from '../../world/entities/components.js';

describe('executeStackAll', () => {
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

  it('consolidates like stacks and is a free action', () => {
    const a = giveStack(10);
    giveStack(10);
    const free = executeStackAll(actor, { itemEntityId: a.id }, null, registry);

    expect(free).toBe(true);
    const inv = actor.components.get('inventory').items;
    expect(inv).toHaveLength(1);
    expect(inv[0].components.get('stackable').count).toBe(20);
  });

  it('does nothing when the item is not in the actor inventory', () => {
    const stack = stackable(registry, { ownerId: actor.id }); // not pushed
    const free = executeStackAll(actor, { itemEntityId: stack.id }, null, registry);
    expect(free).toBe(true);
    expect(actor.components.get('inventory').items).toHaveLength(0);
  });
});
