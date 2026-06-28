import { describe, it, expect } from 'vitest';
import { cardinalDirection, projectTile, lineTiles } from './geometry.js';
import { createLevel } from './level.js';

const origin = { x: 5, y: 5 };

function openLevel(w = 10, h = 10) {
  const level = createLevel();
  level.width = w;
  level.height = h;
  level.tiles = Array.from({ length: h }, () => Array(w).fill('floor'));
  return level;
}

describe('cardinalDirection', () => {
  it('returns null when the points coincide', () => {
    expect(cardinalDirection(origin, { x: 5, y: 5 })).toBeNull();
  });

  it('maps the four cardinal axes (y-down grid: smaller y is north)', () => {
    expect(cardinalDirection(origin, { x: 5, y: 1 })).toBe('N');
    expect(cardinalDirection(origin, { x: 5, y: 9 })).toBe('S');
    expect(cardinalDirection(origin, { x: 9, y: 5 })).toBe('E');
    expect(cardinalDirection(origin, { x: 1, y: 5 })).toBe('W');
  });

  it('maps the four diagonals', () => {
    expect(cardinalDirection(origin, { x: 9, y: 1 })).toBe('NE');
    expect(cardinalDirection(origin, { x: 9, y: 9 })).toBe('SE');
    expect(cardinalDirection(origin, { x: 1, y: 9 })).toBe('SW');
    expect(cardinalDirection(origin, { x: 1, y: 1 })).toBe('NW');
  });

  it('rounds a shallow off-axis bearing to the nearer cardinal', () => {
    // Far east, slightly north — well within the E sector (< 22.5° off axis).
    expect(cardinalDirection(origin, { x: 15, y: 4 })).toBe('E');
  });
});

describe('projectTile', () => {
  it('returns the farthest passable tile along the direction, up to maxDist', () => {
    expect(projectTile(openLevel(), { x: 2, y: 2 }, 'E', 3)).toEqual({ x: 5, y: 2 });
  });

  it('stops at a wall', () => {
    const level = openLevel();
    level.tiles[2][4] = 'wall';
    expect(projectTile(level, { x: 2, y: 2 }, 'E', 5)).toEqual({ x: 3, y: 2 });
  });

  it('returns the origin when the first step is blocked', () => {
    const level = openLevel();
    level.tiles[2][3] = 'wall';
    expect(projectTile(level, { x: 2, y: 2 }, 'E', 5)).toEqual({ x: 2, y: 2 });
  });

  it('returns the origin for an unknown / null direction', () => {
    expect(projectTile(openLevel(), { x: 2, y: 2 }, null, 5)).toEqual({ x: 2, y: 2 });
  });
});

describe('lineTiles', () => {
  it('returns just the origin when start and end coincide', () => {
    expect(lineTiles(3, 3, 3, 3)).toEqual([{ x: 3, y: 3 }]);
  });

  it('walks a horizontal run inclusive of both endpoints', () => {
    expect(lineTiles(1, 2, 4, 2)).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it('walks a pure diagonal one step per tile', () => {
    expect(lineTiles(0, 0, 3, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it('traces a shallow slope and reaches the endpoint', () => {
    const tiles = lineTiles(0, 0, 4, 2);
    expect(tiles[0]).toEqual({ x: 0, y: 0 });
    expect(tiles[tiles.length - 1]).toEqual({ x: 4, y: 2 });
    expect(tiles).toHaveLength(5); // one tile per column on a 4-wide run
  });

  it('handles a line running toward smaller coordinates', () => {
    expect(lineTiles(4, 4, 2, 4)).toEqual([
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
    ]);
  });
});
