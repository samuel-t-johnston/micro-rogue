import { describe, it, expect } from 'vitest';
import { createMenuShell } from './menu-shell.js';

const theme = {
  bg: '#000',
  surface: '#111',
  primary: '#444',
  accent: '#888',
  text: '#fff',
  textDim: '#aaa',
  textDisabled: '#666',
};
const getViewport = () => ({ width: 800, height: 600 });

function makeCtx() {
  const noop = () => {};
  return new Proxy({}, { get: () => noop, set: () => true });
}

// 2 items → total 128, startY 236, x-center 400. Row i center y = 236 + i*72 + 28.
const ROW0 = { x: 400, y: 264 };
const ROW1 = { x: 400, y: 336 };

describe('menu shell', () => {
  it('ignores taps on a disabled item but fires enabled ones', () => {
    let aCalls = 0,
      bCalls = 0;
    const shell = createMenuShell({
      theme,
      getViewport,
      getItems: () => [
        { id: 'a', label: 'A', enabled: false, onSelect: () => aCalls++ },
        { id: 'b', label: 'B', onSelect: () => bCalls++ },
      ],
    });
    shell.render(makeCtx());

    shell.handleInput({ type: 'pointerdown', x: ROW0.x, y: ROW0.y });
    expect(aCalls).toBe(0);

    shell.handleInput({ type: 'pointerdown', x: ROW1.x, y: ROW1.y });
    expect(bCalls).toBe(1);
  });

  it('re-reads getItems each frame so enablement can change between renders', () => {
    let enabled = false;
    let calls = 0;
    const shell = createMenuShell({
      theme,
      getViewport,
      getItems: () => [
        { id: 'a', label: 'A', enabled, onSelect: () => calls++ },
        { id: 'b', label: 'B', onSelect: () => {} },
      ],
    });

    shell.render(makeCtx());
    shell.handleInput({ type: 'pointerdown', x: ROW0.x, y: ROW0.y });
    expect(calls).toBe(0); // disabled this frame

    enabled = true;
    shell.render(makeCtx());
    shell.handleInput({ type: 'pointerdown', x: ROW0.x, y: ROW0.y });
    expect(calls).toBe(1); // enabled now
  });

  it('scene mode (no onClose) lets stray taps pass through; nothing consumed', () => {
    const shell = createMenuShell({
      theme,
      getViewport,
      getItems: () => [{ id: 'a', label: 'A', onSelect: () => {} }],
    });
    shell.render(makeCtx());
    // A tap far from the single centered button is unhandled in scene mode.
    expect(shell.handleInput({ type: 'pointerdown', x: 10, y: 10 })).toBe(false);
  });
});
