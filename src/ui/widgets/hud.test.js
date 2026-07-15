import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Capture the draw calls; keep the real anchor-system (the layout math under test).
vi.mock('../core/canvas-ui.js', () => ({
  drawPanel: vi.fn(),
  drawText: vi.fn(),
  hitTest: vi.fn(() => false),
}));

import { drawPanel, drawText } from '../core/canvas-ui.js';
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
    expect(warnCall()[1]).toBe('(Hungry)');
    expect(warnCall()[2]).toBeGreaterThan(line('HP:')[2]); // label x past the HP line x
  });

  it('left-handed: warning mirrors to the left of the HP text', () => {
    render('left', { hunger: 'starving' });
    expect(warnCall()[1]).toBe('(Starving!)');
    expect(warnCall()[2]).toBeLessThan(line('HP:')[2]);
  });
});
