import { describe, it, expect } from 'vitest';
import { run as runReserve, isReserved } from './stage-reserve.js';
import { run as runCaSeed } from './stage-ca-seed.js';
import { run as runCaSmooth } from './stage-ca-smooth.js';
import { createLevel } from '../../map/level.js';
import { createRng } from '../../../engine/core/rng.js';

describe('isReserved', () => {
  const rects = [{ x: 5, y: 5, w: 4, h: 4 }]; // covers x 5..8, y 5..8
  it('is true inside a rect and false outside', () => {
    expect(isReserved(5, 5, rects)).toBe(true);
    expect(isReserved(8, 8, rects)).toBe(true);
    expect(isReserved(9, 8, rects)).toBe(false); // just past the right edge
    expect(isReserved(4, 5, rects)).toBe(false);
    expect(isReserved(0, 0, [])).toBe(false);
  });
});

describe('reserve stage', () => {
  it('appends rects to level:reserved', () => {
    const bb = {};
    runReserve(null, { rects: [{ x: 1, y: 1, w: 2, h: 2 }] }, bb);
    runReserve(null, { rects: [{ x: 9, y: 9, w: 3, h: 3 }] }, bb);
    expect(bb['level:reserved']).toHaveLength(2);
  });
});

describe('CA respects reserved rects', () => {
  const rect = { x: 20, y: 12, w: 10, h: 10 };
  function caWithReserve() {
    const level = createLevel();
    const bb = level.blackboard;
    const rng = createRng(1);
    runReserve(level, { rects: [rect] }, bb);
    runCaSeed(level, { width: 48, height: 32 }, bb, rng);
    runCaSmooth(level, {}, bb);
    return level;
  }

  it('leaves the reserved rect entirely wall after seed and smooth', () => {
    const level = caWithReserve();
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) expect(level.getTile(x, y)).toBe('wall');
  });

  it('still carves floor outside the reserved rect', () => {
    const level = caWithReserve();
    let floorOutside = 0;
    for (let y = 1; y < 31; y++)
      for (let x = 1; x < 47; x++)
        if (!isReserved(x, y, [rect]) && level.getTile(x, y) === 'floor') floorOutside++;
    expect(floorOutside).toBeGreaterThan(0);
  });
});
