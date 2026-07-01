import { describe, it, expect } from 'vitest';
import { chaseOthers } from './chase-others.js';
import { createLevel } from '../../world/map/level.js';
import { chebyshevDistance } from '../../world/map/geometry.js';

function openLevel(w = 9, h = 9) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) =>
      x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 'wall' : 'floor',
    ),
  );
  return level;
}

function obs(entityId, x, y, factions, { isActor = true } = {}) {
  return { entityId, position: { x, y }, factions, tags: { isActor } };
}

function ctx(entities, level, { x = 2, y = 2, factions = ['orcs'] } = {}) {
  return { selfState: { position: { x, y }, factions }, perception: { entities }, level };
}

describe('chaseOthers', () => {
  it('returns null when no hostile is perceived', () => {
    expect(chaseOthers.evaluate(ctx([], openLevel()))).toBeNull();
  });

  it('ignores same-faction and non-actor observations', () => {
    const entities = [obs(1, 5, 5, ['orcs']), obs(2, 4, 4, [], { isActor: false })];
    expect(chaseOthers.evaluate(ctx(entities, openLevel()))).toBeNull();
  });

  it('returns null when already adjacent (attack-in-range takes over)', () => {
    expect(chaseOthers.evaluate(ctx([obs(9, 2, 3, ['player'])], openLevel()))).toBeNull();
  });

  it('steps closer to a distant hostile', () => {
    const target = { x: 2, y: 6 };
    const result = chaseOthers.evaluate(ctx([obs(9, target.x, target.y, ['player'])], openLevel()));
    expect(result.action.type).toBe('move');
    const step = { x: result.action.x, y: result.action.y };
    expect(chebyshevDistance(step, target)).toBeLessThan(chebyshevDistance({ x: 2, y: 2 }, target));
  });

  it('targets the nearest of multiple hostiles', () => {
    const near = obs(1, 2, 4, ['player']); // distance 2
    const far = obs(2, 2, 8, ['player']); // distance 6
    const result = chaseOthers.evaluate(ctx([far, near], openLevel()));
    // Should step toward the nearer target at (2,4): y increases toward it.
    expect(result.action.type).toBe('move');
    expect(result.action.y).toBe(3);
  });
});
