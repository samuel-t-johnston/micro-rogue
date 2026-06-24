import { describe, it, expect } from 'vitest';
import { fleeFromOthers } from './flee-from-others.js';
import { createLevel } from '../../world/map/level.js';

// Floor interior with a wall border.
function openLevel(w = 7, h = 7) {
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

// Level whose only passable tiles are the listed "x,y" coordinates.
function sparseLevel(floors, w = 5, h = 5) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  const open = new Set(floors);
  level.tiles = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (open.has(`${x},${y}`) ? 'floor' : 'wall')),
  );
  return level;
}

function obs(entityId, x, y, factions, { isActor = true } = {}) {
  return { entityId, position: { x, y }, factions, tags: { isActor } };
}

function ctx(entities, level, { x = 3, y = 3, factions = ['goblins'] } = {}) {
  return { selfState: { position: { x, y }, factions }, perception: { entities }, level };
}

describe('fleeFromOthers', () => {
  it('returns null when no hostile is perceived', () => {
    expect(fleeFromOthers.evaluate(ctx([], openLevel()))).toBeNull();
  });

  it('ignores same-faction and non-actor observations', () => {
    const entities = [obs(1, 3, 4, ['goblins']), obs(2, 4, 3, [], { isActor: false })];
    expect(fleeFromOthers.evaluate(ctx(entities, openLevel()))).toBeNull();
  });

  it('steps to the neighbor that maximizes distance from the hostile', () => {
    // Self at (3,3), hostile directly south at (3,4): the best move is north to (3,2).
    const result = fleeFromOthers.evaluate(ctx([obs(9, 3, 4, ['player'])], openLevel()));
    expect(result).toEqual({ action: { type: 'move', x: 3, y: 2 } });
  });

  it('waits when cornered (no neighbor improves distance)', () => {
    // Only (1,1) and (1,2) are passable; hostile sits at (1,2), so the lone exit moves
    // toward it. No neighbor increases distance → wait.
    const level = sparseLevel(['1,1', '1,2']);
    const result = fleeFromOthers.evaluate(ctx([obs(9, 1, 2, ['player'])], level, { x: 1, y: 1 }));
    expect(result).toEqual({ action: { type: 'wait' } });
  });
});
