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
    selfState: { position: { x, y }, factions: [] },
    level,
    perception: { entities: [] },
    awaitInput: async () => queue.shift(),
    hasPendingInput: () => queue.length > 0,
  };
}

const tap = (x, y) => ({ type: 'tap', x, y });

describe('playerGetInput', () => {
  let registry, level;

  beforeEach(() => {
    registry = createEntityRegistry();
    level = makeLevel();
  });

  it('interprets a tap on an open adjacent tile as a move', async () => {
    const ctx = makeContext(level, [tap(3, 2)]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'move', x: 3, y: 2 } });
  });

  it('ignores a tap on a blocked adjacent tile and keeps waiting', async () => {
    level.placeEntity(createBoulder(registry, 2, 1)); // blocks the tile above the player
    const ctx = makeContext(level, [tap(2, 1), tap(3, 2)]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'move', x: 3, y: 2 } });
  });

  it('interprets a tap on an adjacent creature as an attack', async () => {
    const creature = registry.createEntity();
    registry.addComponent(creature, 'position', components.position(2, 1));
    registry.addComponent(creature, 'health', components.health(5, 5));
    registry.addComponent(creature, 'blocksMovement', components.blocksMovement());
    level.placeEntity(creature);

    const ctx = makeContext(level, [tap(2, 1)]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'attack', targetEntityId: creature.id } });
  });

  it('interprets a tap on an adjacent chest as interact', async () => {
    const chest = createChest(registry, 2, 1);
    level.placeEntity(chest);
    const ctx = makeContext(level, [tap(2, 1)]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'interact', targetEntityId: chest.id } });
  });

  it('pathfinds a distant tap and arms auto-move', async () => {
    const ctx = makeContext(level, [tap(4, 4)]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result.action.type).toBe('move');
    // First step is adjacent to the player's start.
    expect(Math.abs(result.action.x - 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.action.y - 2)).toBeLessThanOrEqual(1);
    expect(ctx.memory.autoMoveTarget).toEqual({ x: 4, y: 4 });
  });

  it('routes an explicit move action to movement (the contextual menu "Move here")', async () => {
    const ctx = makeContext(level, [{ type: 'move', x: 3, y: 2 }]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'move', x: 3, y: 2 } });
  });

  it('passes a pre-resolved action straight through', async () => {
    const ctx = makeContext(level, [{ type: 'interact', targetEntityId: 7 }]);
    const result = await playerGetInput.evaluate(ctx);
    expect(result).toEqual({ action: { type: 'interact', targetEntityId: 7 } });
  });
});
