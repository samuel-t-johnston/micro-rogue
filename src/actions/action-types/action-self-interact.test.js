import { describe, it, expect, beforeEach } from 'vitest';
import { executeSelfInteract } from './action-self-interact.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { createLevel } from '../../world/level.js';
import { createPotion } from '../../world/items.js';

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
    const potion = createPotion(registry, 2, 2);
    level.placeEntity(potion);

    const result = await executeSelfInteract(actor, {}, level, registry, dialogController);

    expect(result).toBe(false);
    expect(level.entities).not.toContain(potion);
    expect(actor.components.get('inventory').items).toContain(potion);
  });

  it('returns true (free action) when multiple items are present and the dialog is cancelled', async () => {
    level.placeEntity(createPotion(registry, 2, 2));
    level.placeEntity(createPotion(registry, 2, 2));

    expect(await executeSelfInteract(actor, {}, level, registry, dialogController)).toBe(true);
  });

  it('does not pick up items from a different tile', async () => {
    const potion = createPotion(registry, 3, 2);
    level.placeEntity(potion);

    await executeSelfInteract(actor, {}, level, registry, dialogController);

    expect(level.entities).toContain(potion);
  });
});
