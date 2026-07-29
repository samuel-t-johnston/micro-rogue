import { describe, it, expect } from 'vitest';
import { getTileType, tileCategory, isFloorTile } from './tile-registry.js';

describe('getTileType', () => {
  it('returns the floor definition with correct properties', () => {
    const floor = getTileType('floor');
    expect(floor.name).toBe('Floor');
    expect(floor.symbol).toBe('.');
    expect(floor.blocksMovement).toBe(false);
    expect(floor.opaque).toBe(false);
    expect(floor.color).toBeDefined();
    expect(floor.sprite).toBeDefined();
  });

  it('returns the wall definition with correct properties', () => {
    const wall = getTileType('wall');
    expect(wall.name).toBe('Wall');
    expect(wall.symbol).toBe('#');
    expect(wall.blocksMovement).toBe(true);
    expect(wall.opaque).toBe(true);
  });

  it('throws for an unknown tile id', () => {
    expect(() => getTileType('unknown')).toThrow('Unknown tile type: "unknown"');
  });

  it('returns the same object on repeated calls (no cloning)', () => {
    expect(getTileType('floor')).toBe(getTileType('floor'));
  });
});

describe('tile category helpers', () => {
  it('reads the category regardless of tile id', () => {
    expect(tileCategory('floor')).toBe('floor');
    expect(tileCategory('cave-floor')).toBe('floor');
    expect(tileCategory('wall')).toBe('wall');
    expect(tileCategory('cave-wall')).toBe('wall');
  });

  it('returns null category for undefined or unknown ids (never throws)', () => {
    expect(tileCategory(undefined)).toBeNull();
    expect(tileCategory('nope')).toBeNull();
  });

  it('classifies floors by category, not by tile id', () => {
    expect(isFloorTile('floor')).toBe(true);
    expect(isFloorTile('cave-floor')).toBe(true);
    expect(isFloorTile('wall')).toBe(false);
    expect(isFloorTile('cave-wall')).toBe(false);
  });

  it('treats out-of-bounds / unknown as not floor (so generation reads them as solid)', () => {
    // Generation reads off the grid edge; undefined must read as non-floor so caves stay closed.
    expect(isFloorTile(undefined)).toBe(false);
    expect(isFloorTile('nope')).toBe(false);
  });
});
