import { describe, it, expect } from 'vitest';
import { createScrollable, clampScroll } from './scrollable.js';

const region = { x: 0, y: 100, w: 200, h: 200 };
const OVERFLOW = 500; // content taller than the 200px region
const FITS = 150; // content shorter than the region

describe('clampScroll', () => {
  it('pins to zero when the content fits the viewport', () => {
    expect(clampScroll(50, 100, 200)).toBe(0);
  });

  it('pins to the maximum offset past the bottom', () => {
    expect(clampScroll(999, 500, 200)).toBe(300);
  });

  it('passes a valid offset through unchanged', () => {
    expect(clampScroll(120, 500, 200)).toBe(120);
  });
});

const down = (x, y) => ({ type: 'pointerdown', x, y, pointerId: 1 });
const move = (x, y) => ({ type: 'pointermove', x, y, pointerId: 1 });
const up = (x, y) => ({ type: 'pointerup', x, y, pointerId: 1 });

describe('createScrollable', () => {
  it('scrolls on wheel, clamped to content', () => {
    const s = createScrollable();
    s.handleInput({ type: 'wheel', deltaY: 120 }, { region, contentH: OVERFLOW });
    expect(s.scroll).toBe(120);
    // Past the end clamps to contentH - region.h.
    s.handleInput({ type: 'wheel', deltaY: 9999 }, { region, contentH: OVERFLOW });
    expect(s.scroll).toBe(OVERFLOW - region.h);
    // Above the top clamps to 0.
    s.handleInput({ type: 'wheel', deltaY: -9999 }, { region, contentH: OVERFLOW });
    expect(s.scroll).toBe(0);
  });

  it('does not scroll when content fits the region', () => {
    const s = createScrollable();
    s.handleInput({ type: 'wheel', deltaY: 120 }, { region, contentH: FITS });
    expect(s.scroll).toBe(0);
  });

  it('selects on press (not release) when content fits', () => {
    const s = createScrollable();
    const r = s.handleInput(down(50, 150), { region, contentH: FITS });
    expect(r.tap).toEqual({ x: 50, y: 150 });
    // A press outside the region is not a tap.
    expect(s.handleInput(down(50, 50), { region, contentH: FITS }).tap).toBeNull();
  });

  it('defers selection to release when content overflows', () => {
    const s = createScrollable();
    expect(s.handleInput(down(50, 150), { region, contentH: OVERFLOW }).tap).toBeNull();
    expect(s.handleInput(up(50, 150), { region, contentH: OVERFLOW }).tap).toEqual({
      x: 50,
      y: 150,
    });
  });

  it('reports a clean tap (no drift) at the screen press point', () => {
    const s = createScrollable();
    s.handleInput({ type: 'wheel', deltaY: 60 }, { region, contentH: OVERFLOW });
    s.handleInput(down(50, 150), { region, contentH: OVERFLOW });
    const r = s.handleInput(up(52, 151), { region, contentH: OVERFLOW });
    expect(r.tap).toEqual({ x: 52, y: 151 });
  });

  it('promotes a drag past the slop to a scroll and yields no tap', () => {
    const s = createScrollable();
    s.handleInput(down(50, 250), { region, contentH: OVERFLOW });
    s.handleInput(move(50, 210), { region, contentH: OVERFLOW }); // 40px up, past slop
    expect(s.scroll).toBe(40); // dragging up reveals content below
    const r = s.handleInput(up(50, 210), { region, contentH: OVERFLOW });
    expect(r.tap).toBeNull();
  });

  it('keeps small drift within the slop as a tap', () => {
    const s = createScrollable();
    s.handleInput(down(50, 150), { region, contentH: OVERFLOW });
    s.handleInput(move(55, 156), { region, contentH: OVERFLOW }); // ~7.8px, under 12
    expect(s.scroll).toBe(0);
    const r = s.handleInput(up(55, 156), { region, contentH: OVERFLOW });
    expect(r.tap).not.toBeNull();
  });

  it('pins to the bottom of the content', () => {
    const s = createScrollable();
    s.pinToBottom(OVERFLOW, region.h);
    expect(s.scroll).toBe(OVERFLOW - region.h);
  });
});
