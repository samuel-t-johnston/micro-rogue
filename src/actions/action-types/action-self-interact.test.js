import { describe, it, expect, beforeEach } from 'vitest';
import { executeSelfInteract } from './action-self-interact.js';
import { createEntityRegistry } from '../../engine/core/entity-component-system.js';
import { createLevel } from '../../world/map/level.js';
import { consumable } from '../../test-support/fixtures.js';
import { createStairs } from '../../world/entities/furniture.js';

function makeLevel() {
  const level = createLevel();
  level.width = 5;
  level.height = 5;
  level.tiles = Array.from({ length: 5 }, () => Array(5).fill('floor'));
  return level;
}

describe('executeSelfInteract', () => {
  let registry, level, actor, dialogController;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
    actor = registry.createEntity();
    registry.addComponent(actor, 'position', { x: 2, y: 2 });
    registry.addComponent(actor, 'inventory', { items: [] });
    dialogController = { showItemList: async () => ({ confirmed: false, taken: [] }) };
  });

  it('returns true (free action) when no items are present', async () => {
    expect(await executeSelfInteract(actor, {}, level, registry, dialogController)).toBe(true);
  });

  it('picks up the item and returns false when exactly one item is present', async () => {
    const potion = consumable(registry, { x: 2, y: 2 });
    level.placeEntity(potion);

    const result = await executeSelfInteract(actor, {}, level, registry, dialogController);

    expect(result).toBe(false);
    expect(level.entities).not.toContain(potion);
    expect(actor.components.get('inventory').items).toContain(potion);
  });

  it('returns true (free action) when multiple items are present and the dialog is cancelled', async () => {
    level.placeEntity(consumable(registry, { x: 2, y: 2 }));
    level.placeEntity(consumable(registry, { x: 2, y: 2 }));

    expect(await executeSelfInteract(actor, {}, level, registry, dialogController)).toBe(true);
  });

  it('does not pick up items from a different tile', async () => {
    const potion = consumable(registry, { x: 3, y: 2 });
    level.placeEntity(potion);

    await executeSelfInteract(actor, {}, level, registry, dialogController);

    expect(level.entities).toContain(potion);
  });

  it('requests a transition (and consumes the turn) when standing on stairs', async () => {
    const stairs = createStairs(registry, 2, 2, 'down');
    level.placeEntity(stairs);
    let requested = null;
    level.onTransition = (entity) => {
      requested = entity;
    };

    const result = await executeSelfInteract(actor, {}, level, registry, dialogController);

    expect(result).toBe(false); // turn consumed
    expect(requested).toBe(stairs);
  });

  it('ignores stairs when no transition handler is wired (returns free action)', async () => {
    level.placeEntity(createStairs(registry, 2, 2, 'down'));
    // no level.onTransition

    expect(await executeSelfInteract(actor, {}, level, registry, dialogController)).toBe(true);
  });
});
