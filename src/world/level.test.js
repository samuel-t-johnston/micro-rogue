import { describe, it, expect, beforeEach } from 'vitest';
import { createLevel } from './level.js';

describe('createLevel', () => {
  it('initializes with zeroed dimensions and empty collections', () => {
    const level = createLevel();
    expect(level.width).toBe(0);
    expect(level.height).toBe(0);
    expect(level.tiles).toEqual([]);
    expect(level.overrides.size).toBe(0);
    expect(level.entities).toEqual([]);
    expect(level.blackboard).toEqual({});
  });
});

describe('getTile', () => {
  let level;

  beforeEach(() => {
    level = createLevel();
    level.width = 3;
    level.height = 2;
    level.tiles = [
      ['wall',  'floor', 'wall'],
      ['floor', 'floor', 'floor'],
    ];
  });

  it('returns the tile id at the given coordinates', () => {
    expect(level.getTile(0, 0)).toBe('wall');
    expect(level.getTile(1, 0)).toBe('floor');
    expect(level.getTile(2, 1)).toBe('floor');
  });

  it('returns an override when one is set', () => {
    level.overrides.set('1,0', 'wall');
    expect(level.getTile(1, 0)).toBe('wall');
  });

  it('override does not affect other tiles', () => {
    level.overrides.set('1,0', 'wall');
    expect(level.getTile(0, 0)).toBe('wall');
    expect(level.getTile(1, 1)).toBe('floor');
  });

  it('returns null for out-of-bounds x', () => {
    expect(level.getTile(-1, 0)).toBeNull();
    expect(level.getTile(3, 0)).toBeNull();
  });

  it('returns null for out-of-bounds y', () => {
    expect(level.getTile(0, -1)).toBeNull();
    expect(level.getTile(0, 2)).toBeNull();
  });
});
