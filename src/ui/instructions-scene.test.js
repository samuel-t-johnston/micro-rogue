import { describe, it, expect, beforeEach } from 'vitest';
import { createInstructionsScene } from './instructions-scene.js';
import { gameSettings } from '../engine/settings.js';

const theme = {
  bg: '#000',
  surface: '#111',
  primary: '#444',
  accent: '#888',
  text: '#fff',
  textDim: '#aaa',
  textDisabled: '#666',
};
const getViewport = () => ({ width: 800, height: 900 });

// Mock 2D context: like the popup tests, but measureText must return a width so wrapText can run.
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
          key === 'textBaseline' ||
          key === 'globalAlpha'
          ? ''
          : noop;
      },
      set: () => true,
    },
  );
}

// NOTE: the Start button and checkbox tap geometry are visual (layout depends on the wrapped body)
// and are validated by play-testing, not asserted here — see AGENTS.md on touch/layout testing.
describe('instructions scene', () => {
  beforeEach(() => {
    localStorage.clear();
    gameSettings.reset();
  });

  it('render does not throw', () => {
    const scene = createInstructionsScene({ theme, getViewport, onContinue: () => {} });
    expect(() => scene.render(makeCtx())).not.toThrow();
  });

  it('Enter fires onContinue', () => {
    let cont = 0;
    const scene = createInstructionsScene({
      theme,
      getViewport,
      onContinue: () => {
        cont++;
      },
    });
    scene.render(makeCtx());
    expect(scene.handleInput({ type: 'keydown', key: 'Enter' })).toBe(true);
    expect(cont).toBe(1);
  });

  it('swallows pointer input received before the first render', () => {
    const scene = createInstructionsScene({ theme, getViewport, onContinue: () => {} });
    expect(scene.handleInput({ type: 'pointerdown', x: 1, y: 1 })).toBe(true);
  });
});
