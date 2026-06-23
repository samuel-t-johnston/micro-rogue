import { describe, it, expect } from 'vitest';
import { hitTest, wrapText, segmentRects } from './canvas-ui.js';

// Deterministic measuring: every character is 10px wide, so maxWidth maps directly to a char budget.
const fakeCtx = () => ({ font: '', measureText: (t) => ({ width: t.length * 10 }) });

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

describe('wrapText', () => {
  it('keeps a short line intact', () => {
    expect(wrapText(fakeCtx(), 'one two', 1000)).toEqual(['one two']);
  });

  it('wraps words that exceed maxWidth onto new lines', () => {
    // 10px/char, 60px budget = 6 chars. 'aaa bbb' (7 chars) must split.
    expect(wrapText(fakeCtx(), 'aaa bbb', 60)).toEqual(['aaa', 'bbb']);
  });

  it('preserves explicit newlines as paragraph breaks', () => {
    expect(wrapText(fakeCtx(), 'a\n\nb', 1000)).toEqual(['a', '', 'b']);
  });

  it('keeps a single over-long word whole rather than splitting mid-word', () => {
    expect(wrapText(fakeCtx(), 'supercalifragilistic', 50)).toEqual(['supercalifragilistic']);
  });
});

describe('segmentRects', () => {
  it('splits a rect into equal adjacent segments', () => {
    const segs = segmentRects({ x: 100, y: 10, w: 120, h: 40 }, 3);
    expect(segs).toHaveLength(3);
    expect(segs.map((s) => s.x)).toEqual([100, 140, 180]);
    expect(segs.map((s) => s.w)).toEqual([40, 40, 40]);
    expect(segs.every((s) => s.y === 10 && s.h === 40)).toBe(true);
  });
});
