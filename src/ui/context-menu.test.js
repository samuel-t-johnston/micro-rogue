import { describe, it, expect, beforeEach } from 'vitest';
import { createContextMenu } from './context-menu.js';

const theme = {
  bg: '#000', surface: '#111', primary: '#444', accent: '#888',
  text: '#fff', textDim: '#aaa', textDisabled: '#666',
};
const getViewport = () => ({ width: 800, height: 600 });

function makeCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get: (_, key) => ['font', 'fillStyle', 'strokeStyle', 'lineWidth', 'textAlign', 'textBaseline', 'globalAlpha'].includes(key) ? '' : noop,
    set: () => true,
  });
}

// Geometry (PANEL_W=240, ROW_H=44, ROW_GAP=6, PAD=8, MARGIN=8): for a 2-row menu, h = 16 + 88 + 6 = 110.
const ROWS = [
  { label: 'Move here', action: { type: 'move', x: 1, y: 1 } },
  { label: 'Close the Door', action: { type: 'interact', targetEntityId: 9 } },
];

describe('context menu', () => {
  let chosen;
  const onSelect = (a) => { chosen = a; };
  beforeEach(() => { chosen = undefined; });

  function make(anchor) {
    return createContextMenu({ theme, getViewport, anchor, rows: ROWS, onSelect });
  }

  it('renders without throwing', () => {
    expect(() => make({ x: 100, y: 100 }).render(makeCtx())).not.toThrow();
  });

  it('selects the row under a tap', () => {
    // anchor (100,100): panel at (100,100); row0 center (220,130), row1 center (220,180).
    const menu = make({ x: 100, y: 100 });
    expect(menu.handleInput({ type: 'pointerdown', x: 220, y: 130 })).toBe(true);
    expect(chosen).toEqual(ROWS[0].action);
  });

  it('selects the second row', () => {
    const menu = make({ x: 100, y: 100 });
    menu.handleInput({ type: 'pointerdown', x: 220, y: 180 });
    expect(chosen).toEqual(ROWS[1].action);
  });

  it('dismisses (null) on a tap outside the panel', () => {
    const menu = make({ x: 100, y: 100 });
    expect(menu.handleInput({ type: 'pointerdown', x: 5, y: 5 })).toBe(true);
    expect(chosen).toBeNull();
  });

  it('dismisses on Escape', () => {
    const menu = make({ x: 100, y: 100 });
    expect(menu.handleInput({ type: 'keydown', key: 'Escape' })).toBe(true);
    expect(chosen).toBeNull();
  });

  it('consumes pointermove (hover tracking)', () => {
    const menu = make({ x: 100, y: 100 });
    expect(menu.handleInput({ type: 'pointermove', x: 220, y: 130 })).toBe(true);
    expect(chosen).toBeUndefined();
  });

  it('clamps onto the screen when anchored at the bottom-right corner', () => {
    // anchor (790,590) flips left/up to panel (550,480); row0 center (670,510) stays on-screen.
    const menu = make({ x: 790, y: 590 });
    menu.handleInput({ type: 'pointerdown', x: 670, y: 510 });
    expect(chosen).toEqual(ROWS[0].action);
  });
});
