import { describe, it, expect } from 'vitest';
import { Anchor, resolveAnchor, applyHandedness, placeBox } from './anchor-system.js';

const VP = { width: 400, height: 800 };

describe('resolveAnchor', () => {
  it('resolves the corners to viewport extents', () => {
    expect(resolveAnchor(Anchor.TOP_LEFT, VP)).toEqual({ x: 0, y: 0 });
    expect(resolveAnchor(Anchor.BOTTOM_RIGHT, VP)).toEqual({ x: 400, y: 800 });
  });

  it('throws on an unknown anchor', () => {
    expect(() => resolveAnchor('middle', VP)).toThrow();
  });
});

describe('applyHandedness', () => {
  it('is the identity for right-handed layouts', () => {
    expect(applyHandedness(Anchor.BOTTOM_RIGHT, 'right')).toBe(Anchor.BOTTOM_RIGHT);
  });

  it('mirrors corners across the vertical axis when left-handed', () => {
    expect(applyHandedness(Anchor.BOTTOM_RIGHT, 'left')).toBe(Anchor.BOTTOM_LEFT);
    expect(applyHandedness(Anchor.TOP_LEFT, 'left')).toBe(Anchor.TOP_RIGHT);
    expect(applyHandedness(Anchor.LEFT_CENTER, 'left')).toBe(Anchor.RIGHT_CENTER);
  });

  it('leaves center-column anchors unchanged when left-handed', () => {
    expect(applyHandedness(Anchor.TOP_CENTER, 'left')).toBe(Anchor.TOP_CENTER);
    expect(applyHandedness(Anchor.BOTTOM_CENTER, 'left')).toBe(Anchor.BOTTOM_CENTER);
  });
});

describe('placeBox', () => {
  it('insets inward from a top-left corner', () => {
    expect(placeBox(Anchor.TOP_LEFT, VP, { w: 44, h: 44, margin: 12 })).toEqual({
      x: 12,
      y: 12,
      w: 44,
      h: 44,
    });
  });

  it('insets inward from a bottom-right corner', () => {
    expect(placeBox(Anchor.BOTTOM_RIGHT, VP, { w: 44, h: 44, margin: 12 })).toEqual({
      x: 400 - 12 - 44,
      y: 800 - 12 - 44,
      w: 44,
      h: 44,
    });
  });

  it('centers the box on a center axis', () => {
    expect(placeBox(Anchor.BOTTOM_CENTER, VP, { w: 100, h: 40, margin: 10 })).toEqual({
      x: 200 - 50,
      y: 800 - 10 - 40,
      w: 100,
      h: 40,
    });
  });

  it('a mirrored anchor produces a horizontally mirrored box', () => {
    const right = placeBox(Anchor.BOTTOM_RIGHT, VP, { w: 44, h: 44, margin: 12 });
    const left = placeBox(applyHandedness(Anchor.BOTTOM_RIGHT, 'left'), VP, {
      w: 44,
      h: 44,
      margin: 12,
    });
    expect(left.x).toBe(12);
    expect(left.x + left.w).toBe(VP.width - right.x); // symmetric about the vertical center
    expect(left.y).toBe(right.y);
  });
});
