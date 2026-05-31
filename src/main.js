import { AppState, createAppStateMachine } from './engine/app-state.js';
import { readTheme } from './engine/theme.js';
import { rng } from './engine/rng.js';
import { gameConfig } from './engine/game-config.js';
import { createSplashScene } from './ui/splash.js';
import { createMenuScene } from './ui/game-menu.js';
import { createGameScene } from './ui/game-scene.js';
import { createDebugOverlay } from './debug/debug-overlay.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const viewport = { width: 0, height: 0, dpr: 1 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  viewport.width = w;
  viewport.height = h;
  viewport.dpr = dpr;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  debugOverlay?.resize();
}

function getViewport() {
  return viewport;
}

rng.init(12345);

const theme = readTheme();
const appState = createAppStateMachine();
const debugOverlay = gameConfig.debugEnabled ? createDebugOverlay({ getViewport }) : null;

function handleMenuAction(id) {
  switch (id) {
    case 'new':
      appState.transition(AppState.GAME);
      break;
    default:
      console.log(`[menu] ${id}`);
  }
}

appState.register(AppState.SPLASH, () =>
  createSplashScene({ appState, theme, getViewport })
);
appState.register(AppState.MENU, () =>
  createMenuScene({ theme, getViewport, onAction: handleMenuAction })
);
appState.register(AppState.GAME, () =>
  createGameScene({ getViewport })
);

resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

appState.transition(AppState.SPLASH);

function frame() {
  appState.render(ctx);
  debugOverlay?.render();
  requestAnimationFrame(frame);
}

function updateDebugPointer(x, y) {
  if (!debugOverlay) return;
  const scene = appState.layers.top();
  const world = scene?.screenToWorld?.(x, y);
  debugOverlay.setPointerPos(
    x, y,
    world ? { x: Math.floor(world.x), y: Math.floor(world.y) } : null
  );
}
requestAnimationFrame(frame);

canvas.addEventListener('pointerdown', (e) => {
  appState.handleInput({ type: 'pointerdown', x: e.clientX, y: e.clientY });
  updateDebugPointer(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  appState.handleInput({ type: 'pointermove', x: e.clientX, y: e.clientY });
  updateDebugPointer(e.clientX, e.clientY);
});
window.addEventListener('keydown', (e) => {
  if (debugOverlay && e.key === '`') {
    debugOverlay.toggle();
    return;
  }
  appState.handleInput({ type: 'keydown', key: e.key });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch((err) => {
    console.warn('Service worker registration failed:', err);
  });
}

console.log('ROGµE booted');
