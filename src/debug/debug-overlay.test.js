import { describe, it, expect } from 'vitest';
import { scentHue, fitTooltipBox } from './debug-overlay.js';

describe('scentHue', () => {
  it('is deterministic per profile and in [0, 360)', () => {
    const h = scentHue('orcs');
    expect(h).toBe(scentHue('orcs'));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it('gives different profiles different hues', () => {
    expect(scentHue('orcs')).not.toBe(scentHue('goblins'));
  });
});

describe('fitTooltipBox', () => {
  it('prefers up-and-right of the pointer when it fits', () => {
    expect(fitTooltipBox(100, 100, 50, 30, 800)).toEqual({ lx: 114, ly: 64 });
  });

  it('flips left when the box would overflow the right edge', () => {
    expect(fitTooltipBox(790, 100, 50, 30, 800).lx).toBe(734); // 790 - 50 - 6
  });

  it('flips below the pointer when the box would clip the top', () => {
    expect(fitTooltipBox(100, 10, 50, 30, 800).ly).toBe(24); // 10 + 14
  });
});
