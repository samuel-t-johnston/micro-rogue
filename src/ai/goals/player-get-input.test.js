import { describe, it, expect, beforeEach } from 'vitest';
import { playerGetInput } from './player-get-input.js';
import { createLevel } from '../../world/level.js';
import { createBoulder, createChest } from '../../world/furniture.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';
import { components } from '../../world/components.js';

function makeLevel(w = 5, h = 5) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
  return level;
}

// Builds a context whose awaitInput yields the queued inputs in order.
function makeContext(level, inputs, { x = 2, y = 2 } = {}) {
  const queue = [...inputs];
  return {
    memory: {},
    selfState: { position: { x, y } },
    level,
    perception: { entities: [] },
    awaitInput: async () => queue.shift(),
    hasPendingInput: () => queue.length > 0,
  };
}

describe('playerGetInput', () => {
  let registry, level;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
  });

  it('moves into an open adjacent tile', async () => {
    const ctx = makeContext(level, [{ type: 'move', x: 3, y: 2 }]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'move', x: 3, y: 2 } });
  });

  it('does not consume the turn when tapping a blocked adjacent tile; keeps waiting', async () => {
    level.placeEntity(createBoulder(registry, 2, 1)); // blocks the tile above the player
    const ctx = makeContext(level, [
      { type: 'move', x: 2, y: 1 }, // blocked — should be ignored, not returned
      { type: 'move', x: 3, y: 2 }, // valid — this is what we expect back
    ]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'move', x: 3, y: 2 } });
  });

  it('attacks an adjacent creature (entity with health)', async () => {
    const creature = registry.createEntity();
    registry.addComponent(creature, 'position', components.position(2, 1));
    registry.addComponent(creature, 'health', components.health(5, 5));
    registry.addComponent(creature, 'blocksMovement', components.blocksMovement());
    level.placeEntity(creature);

    const ctx = makeContext(level, [{ type: 'move', x: 2, y: 1 }]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: creature.id } });
  });

  it('interacts with an adjacent openable/container instead of moving', async () => {
    const chest = createChest(registry, 2, 1);
    level.placeEntity(chest);
    const ctx = makeContext(level, [{ type: 'move', x: 2, y: 1 }]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'interact', targetEntityId: chest.id } });
  });
});
