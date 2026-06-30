import { describe, it, expect, beforeEach } from 'vitest';
import { executeStackAll } from './action-stack-all.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createArrow } from '../../world/entities/items.js';
import { components } from '../../world/entities/components.js';

describe('executeStackAll', () => {
  let registry, actor;

  beforeEach(() => {
    registry = createEntityRegistry();
    actor = registry.createEntity();
    registry.addComponent(actor, 'inventory', components.inventory());
  });

  function giveArrows(count) {
    const arrows = createArrow(registry, null, null, actor.id);
    arrows.components.get('stackable').count = count;
    actor.components.get('inventory').items.push(arrows);
    return arrows;
  }

  it('consolidates like stacks and is a free action', () => {
    const a = giveArrows(10);
    giveArrows(10);
    const free = executeStackAll(actor, { itemEntityId: a.id }, null, registry);

    expect(free).toBe(true);
    const inv = actor.components.get('inventory').items;
    expect(inv).toHaveLength(1);
    expect(inv[0].components.get('stackable').count).toBe(20);
  });

  it('does nothing when the item is not in the actor inventory', () => {
    const arrows = createArrow(registry, null, null, actor.id); // not pushed
    const free = executeStackAll(actor, { itemEntityId: arrows.id }, null, registry);
    expect(free).toBe(true);
    expect(actor.components.get('inventory').items).toHaveLength(0);
  });
});
