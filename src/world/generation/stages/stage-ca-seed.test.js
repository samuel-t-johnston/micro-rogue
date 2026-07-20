import { describe, it, expect } from 'vitest';
import { run as runCaSeed } from './stage-ca-seed.js';
import { createLevel } from '../../map/level.js';
import { createRng } from '../../../engine/core/rng.js';

function seed(config, s = 1, level = createLevel()) {
  const bb = level.blackboard;
  runCaSeed(level, config, bb, createRng(s));
  return { level, bb };
}

describe('caSeed stage', () => {
  it('sizes a standalone grid and publishes the bounds', () => {
    const { level, bb } = seed({ width: 40, height: 30 });
    expect(level.width).toBe(40);
    expect(level.height).toBe(30);
    expect(bb['level:bounds']).toEqual({ x: 0, y: 0, w: 40, h: 30 });
  });

  it('forces the region border to wall', () => {
    const { level } = seed({ width: 40, height: 30 });
    for (let x = 0; x < 40; x++) {
      expect(level.getTile(x, 0)).toBe('wall');
      expect(level.getTile(x, 29)).toBe('wall');
    }
    for (let y = 0; y < 30; y++) {
      expect(level.getTile(0, y)).toBe('wall');
      expect(level.getTile(39, y)).toBe('wall');
    }
  });

  it('fills the interior with a wall fraction near wallChance', () => {
    const { level } = seed({ width: 60, height: 60, wallChance: 0.45 });
    let walls = 0;
    let total = 0;
    for (let y = 1; y < 59; y++)
      for (let x = 1; x < 59; x++) {
        total++;
        if (level.getTile(x, y) === 'wall') walls++;
      }
    const fraction = walls / total;
    expect(fraction).toBeGreaterThan(0.4);
    expect(fraction).toBeLessThan(0.5);
  });

  it('seeds in place without resizing an existing (embedded) grid', () => {
    const level = createLevel();
    level.width = 40;
    level.height = 30;
    level.tiles = Array.from({ length: 30 }, () => Array.from({ length: 40 }, () => 'floor'));
    seed({ bounds: { x: 10, y: 5, w: 12, h: 12 } }, 1, level);
    expect(level.width).toBe(40); // unchanged
    expect(level.getTile(0, 0)).toBe('floor'); // outside the CA bounds, untouched
    expect(level.getTile(10, 5)).toBe('wall'); // CA region border
  });

  it('is deterministic for a given seed', () => {
    expect(seed({ width: 40, height: 30 }, 7).level.tiles).toEqual(
      seed({ width: 40, height: 30 }, 7).level.tiles,
    );
  });
});
