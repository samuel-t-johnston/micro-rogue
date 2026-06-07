import { describe, it, expect, beforeEach } from 'vitest';
import { wanderAimlessly } from './wander-aimlessly.js';
import { rng } from '../../engine/rng.js';
import { createLevel } from '../../world/level.js';
import { createBoulder } from '../../world/furniture.js';
import { createEntityRegistry } from '../../engine/entity-component-system.js';

// Builds a level filled with `tileId` (floor by default), bordered by walls.
function makeLevel(w = 5, h = 5, fill = 'floor') {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) =>
      x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 'wall' : fill));
  return level;
}

function makeContext(x, y, level) {
  return { selfState: { position: { x, y } }, level };
}

describe('wanderAimlessly', () => {
  let registry;

  beforeEach(() => {
    registry = createEntityRegistry();
    rng.init(1);
  });

  it('moves to a passable adjacent tile when one is open', () => {
    const level = makeLevel();
    const result = wanderAimlessly.evaluate(makeContext(2, 2, level));
    expect(result.action.type).toBe('move');
    const { x, y } = result.action;
    expect(Math.abs(x - 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(y - 2)).toBeLessThanOrEqual(1);
    expect(x === 2 && y === 2).toBe(false); // must actually move
    expect(level.isPassable(x, y)).toBe(true);
  });

  it('waits when no adjacent tile is passable', () => {
    // 3x3 level: the only non-wall tile is the center (1,1), fully boxed in by walls.
    const level = makeLevel(3, 3);
    const result = wanderAimlessly.evaluate(makeContext(1, 1, level));
    expect(result).toEqual({ action: { type: 'wait' } });
  });

  it('moves into the only passable tile when boxed in except one direction', () => {
    const level = makeLevel();
    // Surround (2,2) with boulders on every adjacent tile except (2,1).
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (dx === 0 && dy === -1) continue; // leave (2,1) open
        level.placeEntity(createBoulder(registry, 2 + dx, 2 + dy));
      }
    }
    const result = wanderAimlessly.evaluate(makeContext(2, 2, level));
    expect(result).toEqual({ action: { type: 'move', x: 2, y: 1 } });
  });
});
