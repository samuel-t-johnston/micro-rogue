import { describe, it, expect } from 'vitest';
import { getTileType } from './tile-registry.js';

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
