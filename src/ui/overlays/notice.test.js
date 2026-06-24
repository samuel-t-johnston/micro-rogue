import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNotice } from './notice.js';

const theme = {
  bg: '#000',
  surface: '#111',
  primary: '#444',
  accent: '#888',
  text: '#fff',
  textDim: '#aaa',
  textDisabled: '#666',
};
const getViewport = () => ({ width: 400, height: 600 });

// Mock 2D context: measureText drives wrapText, the rest are no-op setters.
function makeCtx() {
  const noop = () => {};
  return new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'measureText') return (t) => ({ width: String(t).length * 8 });
        return key === 'font' ||
          key === 'fillStyle' ||
          key === 'strokeStyle' ||
          key === 'lineWidth' ||
          key === 'textAlign' ||
          key === 'textBaseline'
          ? ''
          : noop;
      },
      set: () => true,
    },
  );
}

// Layout for a one-line message at viewport 400×600 (notice.js constants: PANEL_W 320, PADDING 20,
// LINE_H 22, BUTTON_GAP 18, BUTTON_H 44). w 320, x 40; h = 20+22+18+44+20 = 124, y 238.
// Button: x 60, y 298, w 280, h 44 → center (200, 320).
const BUTTON_CENTER = { x: 200, y: 320 };
const OUTSIDE = { x: 5, y: 5 };

describe('notice', () => {
  let onConfirm, onDismiss, notice, ctx;

  beforeEach(() => {
    onConfirm = vi.fn();
    onDismiss = vi.fn();
    notice = createNotice({
      theme,
      getViewport,
      message: 'Save cleared.',
      buttonLabel: 'New Game',
      onConfirm,
      onDismiss,
    });
    ctx = makeCtx();
    notice.render(ctx); // populate the button rect for hit-testing
  });

  it('confirms when the button is tapped', () => {
    notice.handleInput({ type: 'pointerdown', ...BUTTON_CENTER });
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses on a tap outside the button', () => {
    notice.handleInput({ type: 'pointerdown', ...OUTSIDE });
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('dismisses on Escape', () => {
    notice.handleInput({ type: 'keydown', key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('swallows pointer events so the menu beneath stays inert', () => {
    expect(notice.handleInput({ type: 'pointerdown', ...OUTSIDE })).toBe(true);
    expect(notice.handleInput({ type: 'pointermove', x: 10, y: 10 })).toBe(true);
  });
});
