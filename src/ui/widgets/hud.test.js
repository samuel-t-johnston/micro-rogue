import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Capture the draw calls; keep the real anchor-system (the layout math under test).
vi.mock('../core/canvas-ui.js', () => ({
  drawPanel: vi.fn(),
  drawText: vi.fn(),
  hitTest: vi.fn(() => false),
}));

import { drawPanel, drawText, hitTest } from '../core/canvas-ui.js';
import { createHudWidget } from './hud.js';
import { gameSettings } from '../../engine/config/settings.js';

const theme = { primary: '#p', text: '#t', health: '#h', magic: '#m', experience: '#e' };
const VP = { width: 800, height: 600 };
const STATE = {
  level: 3,
  hp: { current: 8, max: 10 },
  mp: { current: 2, max: 4 },
  exp: { into: 5, forNext: 20 },
  hunger: null,
};

const fakeCtx = () => ({
  strokeStyle: '',
  lineWidth: 0,
  font: '',
  strokeRect: vi.fn(),
  measureText: () => ({ width: 40 }),
});

function render(handedness, stateOverrides = {}) {
  gameSettings.set('handedness', handedness);
  const hud = createHudWidget({ theme, getViewport: () => VP, onOpen: vi.fn() });
  hud.render(fakeCtx(), { ...STATE, ...stateOverrides });
}

const boxRect = () => drawPanel.mock.calls[0][2]; // drawPanel(ctx, theme, { x, y, w, h })
const line = (prefix) => drawText.mock.calls.find(([, t]) => String(t).startsWith(prefix));
const warnCall = () => drawText.mock.calls.find(([, t]) => /Hungry|Starving/.test(String(t)));

beforeEach(() => {
  vi.clearAllMocks();
  gameSettings.reset();
});
afterEach(() => gameSettings.reset());

describe('HUD handedness layout', () => {
  it('right-handed: box hugs the left edge, stat lines are left-aligned', () => {
    render('right');
    expect(boxRect().x).toBeLessThan(VP.width / 2);
    expect(line('HP:')[4].align).toBe('left');
  });

  it('left-handed: box mirrors to the right edge, stat lines are right-aligned', () => {
    render('left');
    expect(boxRect().x).toBeGreaterThan(VP.width / 2);
    expect(line('HP:')[4].align).toBe('right');
  });
});

describe('HUD hunger warning', () => {
  it('draws no warning when not hungry', () => {
    render('right', { hunger: null });
    expect(warnCall()).toBeUndefined();
  });

  it('right-handed: warning sits to the right of the HP text', () => {
    render('right', { hunger: 'hungry' });
    expect(warnCall()[1]).toBe('🍽️ (Hungry)'); // fork-and-knife eat hint leads the warning
    expect(warnCall()[2]).toBeGreaterThan(line('HP:')[2]); // label x past the HP line x
  });

  it('left-handed: warning mirrors to the left of the HP text', () => {
    render('left', { hunger: 'starving' });
    expect(warnCall()[1]).toBe('🍽️ (Starving!)');
    expect(warnCall()[2]).toBeLessThan(line('HP:')[2]);
  });
});

describe('HUD tap targets', () => {
  // The widget hit-tests the level box first, then the stat lines; drive that order with hitTest
  // so we can route a tap to either target without knowing the resolved rects.
  function tap({ boxHit, statHit }) {
    const onOpen = vi.fn();
    const onEasyEat = vi.fn();
    // Reset so an unconsumed once-return from a prior tap (the box branch early-returns before the
    // stat hit-test) can't leak into this one.
    hitTest.mockReset();
    hitTest.mockReturnValueOnce(boxHit).mockReturnValueOnce(statHit).mockReturnValue(false);
    gameSettings.set('handedness', 'right');
    const hud = createHudWidget({ theme, getViewport: () => VP, onOpen, onEasyEat });
    const handled = hud.handleInput({ type: 'pointerdown', x: 0, y: 0 });
    return { onOpen, onEasyEat, handled };
  }

  it('tapping the level box opens the stats menu, not easy-eat', () => {
    const { onOpen, onEasyEat, handled } = tap({ boxHit: true, statHit: false });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onEasyEat).not.toHaveBeenCalled();
    expect(handled).toBe(true);
  });

  it('tapping the stat lines triggers easy-eat, not the stats menu', () => {
    const { onOpen, onEasyEat, handled } = tap({ boxHit: false, statHit: true });
    expect(onEasyEat).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    expect(handled).toBe(true);
  });

  it('a tap that misses both targets is not handled', () => {
    const { onOpen, onEasyEat, handled } = tap({ boxHit: false, statHit: false });
    expect(onOpen).not.toHaveBeenCalled();
    expect(onEasyEat).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});
