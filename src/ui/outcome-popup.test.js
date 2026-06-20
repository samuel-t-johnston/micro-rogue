import { describe, it, expect, beforeEach } from 'vitest';
import { createOutcomePopup } from './outcome-popup.js';

const theme = {
  bg: '#000', surface: '#111', primary: '#444', accent: '#888',
  text: '#fff', textDim: '#aaa', textDisabled: '#666',
};
const viewport = { width: 800, height: 600 };
const getViewport = () => viewport;

// Mock 2D context (see character-menu-controller.test.js) — render() must not throw
// on a happy-dom stub before input is exercised.
function makeCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get: (_, key) => (key === 'font' || key === 'fillStyle' || key === 'strokeStyle' ||
                       key === 'lineWidth' || key === 'textAlign' || key === 'textBaseline' ||
                       key === 'globalAlpha') ? '' : noop,
    set: () => true,
  });
}

// "Next" button geometry (PANEL_W=320, PANEL_H=180, BUTTON_W=160, BUTTON_H=52, viewport 800x600):
//   panel.x = (800-320)/2 = 240, panel.y = (600-180)/2 = 210
//   button.x = 240 + (320-160)/2 = 320, button.y = 210 + 180 - 52 - 24 = 314
//   button center: x = 400, y = 340
const NEXT_X = 400;
const NEXT_Y = 340;

describe('outcome popup', () => {
  let popup, nextCount;

  beforeEach(() => {
    nextCount = 0;
    popup = createOutcomePopup({ theme, getViewport, onNext: () => { nextCount++; } });
  });

  it('starts hidden', () => {
    expect(popup.isVisible).toBe(false);
  });

  it('show() makes it visible and render() does not throw', () => {
    popup.show('lose');
    expect(popup.isVisible).toBe(true);
    expect(() => popup.render(makeCtx())).not.toThrow();
  });

  it('renders without throwing for a win outcome', () => {
    popup.show('win');
    expect(() => popup.render(makeCtx())).not.toThrow();
  });

  it('ignores input while hidden', () => {
    expect(popup.handleInput({ type: 'pointerdown', x: NEXT_X, y: NEXT_Y })).toBe(false);
    expect(nextCount).toBe(0);
  });

  it('swallows all input while visible, even outside the button', () => {
    popup.show();
    expect(popup.handleInput({ type: 'pointerdown', x: 5, y: 5 })).toBe(true);
    expect(nextCount).toBe(0); // tap missed the button → no advance, but input consumed
  });

  it('tapping Next fires onNext', () => {
    popup.show();
    expect(popup.handleInput({ type: 'pointerdown', x: NEXT_X, y: NEXT_Y })).toBe(true);
    expect(nextCount).toBe(1);
  });

  it('Enter key fires onNext', () => {
    popup.show();
    expect(popup.handleInput({ type: 'keydown', key: 'Enter' })).toBe(true);
    expect(nextCount).toBe(1);
  });

  it('hide() resets visibility', () => {
    popup.show();
    popup.hide();
    expect(popup.isVisible).toBe(false);
  });
});
