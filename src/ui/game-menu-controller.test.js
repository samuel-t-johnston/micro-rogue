import { describe, it, expect, beforeEach } from 'vitest';
import { createGameMenuController } from './game-menu-controller.js';

const theme = {
  bg: '#000', surface: '#111', primary: '#444', accent: '#888',
  text: '#fff', textDim: '#aaa', textDisabled: '#666',
};
const viewport = { width: 800, height: 600 };
const getViewport = () => viewport;

// Mock 2D context — render() runs every frame; this keeps it from throwing on a happy-dom stub.
function makeCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get: (_, key) => {
      if (key === 'measureText') return (t) => ({ width: String(t).length * 8 });
      return (key === 'font' || key === 'fillStyle' || key === 'strokeStyle' ||
              key === 'lineWidth' || key === 'textAlign' || key === 'textBaseline' ||
              key === 'globalAlpha') ? '' : noop;
    },
    set: () => true,
  });
}

// Layout-derived tap targets (menu-shell: BUTTON_W 260, BUTTON_H 56, GAP 16; viewport 800x600).
// 3 items → total 200, startY 200, x-center 400. Row i center y = 200 + i*72 + 28.
const ROW = { resume: { x: 400, y: 228 }, newGame: { x: 400, y: 300 }, settings: { x: 400, y: 372 } };
const CORNER = { x: 38, y: 38 }; // ✕ / ‹ corner button center
// Confirm action-menu (2 actions, centered): button0 center (400,296), button1 (400,348).
const CONFIRM = { ok: { x: 400, y: 296 }, cancel: { x: 400, y: 348 } };

describe('game menu controller', () => {
  let controller, newGameCalls, ctx;

  beforeEach(() => {
    newGameCalls = 0;
    controller = createGameMenuController({
      theme, getViewport, onNewGame: () => { newGameCalls++; },
    });
    ctx = makeCtx();
  });

  const tap = (p) => controller.handleInput({ type: 'pointerdown', x: p.x, y: p.y });

  it('starts closed', () => {
    expect(controller.isOpen).toBe(false);
  });

  it('open() shows the menu and render does not throw', () => {
    controller.open();
    expect(controller.isOpen).toBe(true);
    expect(() => controller.render(ctx)).not.toThrow();
  });

  it('Resume closes the menu', () => {
    controller.open();
    controller.render(ctx);
    tap(ROW.resume);
    expect(controller.isOpen).toBe(false);
  });

  it('New Game asks to confirm before doing anything', () => {
    controller.open();
    controller.render(ctx);
    tap(ROW.newGame);
    expect(newGameCalls).toBe(0);   // confirm shown, not yet committed
    expect(controller.isOpen).toBe(true);

    controller.render(ctx);
    tap(CONFIRM.ok);
    expect(newGameCalls).toBe(1);
    expect(controller.isOpen).toBe(false);
  });

  it('cancelling the New Game confirm returns to the menu without starting one', () => {
    controller.open();
    controller.render(ctx);
    tap(ROW.newGame);
    controller.render(ctx);
    tap(CONFIRM.cancel);
    expect(newGameCalls).toBe(0);
    expect(controller.isOpen).toBe(true);

    // Still a live menu: Resume now closes it.
    controller.render(ctx);
    tap(ROW.resume);
    expect(controller.isOpen).toBe(false);
  });

  it('Settings drills into a sub-page and back returns to the root', () => {
    controller.open();
    controller.render(ctx);
    tap(ROW.settings);

    // On the Settings placeholder page there is no Resume row, so tapping its position is inert.
    controller.render(ctx);
    tap(ROW.resume);
    expect(controller.isOpen).toBe(true);

    // Back returns to the root, where Resume works again.
    tap(CORNER);
    controller.render(ctx);
    tap(ROW.resume);
    expect(controller.isOpen).toBe(false);
  });

  it('Escape closes at the root but only steps back from a sub-page', () => {
    controller.open();
    controller.render(ctx);
    controller.handleInput({ type: 'pointerdown', x: ROW.settings.x, y: ROW.settings.y });

    controller.render(ctx);
    controller.handleInput({ type: 'keydown', key: 'Escape' }); // back to root, not closed
    expect(controller.isOpen).toBe(true);

    controller.handleInput({ type: 'keydown', key: 'Escape' }); // now closes
    expect(controller.isOpen).toBe(false);
  });
});
