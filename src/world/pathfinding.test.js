import { describe, it, expect } from 'vitest';
import { findPath, findPathToAdjacent } from './pathfinding.js';
import { createLevel } from './level.js';
import { createEntityRegistry } from '../engine/entity-component-system.js';
import { components } from './components.js';
import { chebyshevDistance } from './geometry.js';

// Builds a level from an ASCII map: '#' wall, '.' floor. Row index is y, column index is x.
function levelFromMap(rows) {
  const level = createLevel();
  level.height = rows.length;
  level.width = rows[0].length;
  level.tiles = rows.map((row) => [...row].map((c) => (c === '#' ? 'wall' : 'floor')));
  return level;
}

const OPEN = ['.....', '.....', '.....', '.....', '.....'];

describe('findPath', () => {
  it('returns an empty path when already at the destination', () => {
    const level = levelFromMap(OPEN);
    expect(findPath({ x: 2, y: 2 }, { x: 2, y: 2 }, level)).toEqual([]);
  });

  it('excludes the start and ends on the destination', () => {
    const level = levelFromMap(OPEN);
    const path = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, level);
    expect(path[0]).toEqual({ x: 1, y: 0 }); // step after `from`, not `from` itself
    expect(path[path.length - 1]).toEqual({ x: 3, y: 0 });
  });

  it('takes the diagonal shortcut on open ground (8-directional)', () => {
    const level = levelFromMap(OPEN);
    const from = { x: 0, y: 0 };
    const to = { x: 3, y: 3 };
    // BFS over 8 neighbours: shortest hop count is the Chebyshev distance.
    expect(findPath(from, to, level)).toHaveLength(chebyshevDistance(from, to));
  });

  it('routes around a wall rather than through it', () => {
    // A vertical wall at x=2 with a single gap at the bottom row.
    const level = levelFromMap(['..#..', '..#..', '..#..', '..#..', '.....']);
    const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, level);
    expect(path).not.toBeNull();
    for (const step of path) expect(level.getTile(step.x, step.y)).toBe('floor');
  });

  it('returns null when the destination is walled off', () => {
    const level = levelFromMap(['.....', '.###.', '.#.#.', '.###.', '.....']);
    expect(findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, level)).toBeNull();
  });

  it('treats a tile occupied by a movement blocker as impassable', () => {
    // One-tile-wide corridor; a blocker in the middle severs it.
    const level = levelFromMap(['#####', '.....', '#####']);
    const registry = createEntityRegistry();
    const blocker = registry.createEntity();
    registry.addComponent(blocker, 'position', components.position(2, 1));
    registry.addComponent(blocker, 'blocksMovement', components.blocksMovement());
    level.placeEntity(blocker);
    expect(findPath({ x: 0, y: 1 }, { x: 4, y: 1 }, level)).toBeNull();
  });
});

describe('findPathToAdjacent', () => {
  it('reaches a tile next to the target without standing on it', () => {
    const level = levelFromMap(OPEN);
    const path = findPathToAdjacent({ x: 0, y: 0 }, { x: 4, y: 4 }, level);
    expect(path).not.toBeNull();
    const last = path[path.length - 1];
    expect(chebyshevDistance(last, { x: 4, y: 4 })).toBe(1); // adjacent, not on top of
  });

  it('returns the shortest approach among the target neighbours', () => {
    const level = levelFromMap(OPEN);
    const from = { x: 0, y: 2 };
    const target = { x: 4, y: 2 };
    const path = findPathToAdjacent(from, target, level);
    // Nearest passable neighbour is (3,2); no approach can be shorter than reaching it.
    expect(path).toHaveLength(findPath(from, { x: 3, y: 2 }, level).length);
  });

  it('returns null when the target is fully walled in', () => {
    const level = levelFromMap(['.....', '.###.', '.#.#.', '.###.', '.....']);
    expect(findPathToAdjacent({ x: 0, y: 0 }, { x: 2, y: 2 }, level)).toBeNull();
  });
});
