import { describe, it, expect } from 'vitest';
import { hitTest } from './canvas-ui.js';

describe('hitTest', () => {
  const rect = { x: 10, y: 20, w: 100, h: 40 };

  it('returns true for a point inside the rect', () => {
    expect(hitTest(rect, 50, 30)).toBe(true);
  });

  it('returns true on the top-left corner', () => {
    expect(hitTest(rect, 10, 20)).toBe(true);
  });

  it('returns true on the bottom-right corner', () => {
    expect(hitTest(rect, 110, 60)).toBe(true);
  });

  it('returns false to the left of the rect', () => {
    expect(hitTest(rect, 5, 30)).toBe(false);
  });

  it('returns false below the rect', () => {
    expect(hitTest(rect, 50, 65)).toBe(false);
  });
});
