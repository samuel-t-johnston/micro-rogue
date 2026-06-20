import { AppState, createAppStateMachine } from './engine/app-state.js';
import { readTheme } from './engine/theme.js';
import { gameConfig } from './engine/game-config.js';
import { createSplashScene } from './ui/splash.js';
import { createMenuScene } from './ui/game-menu.js';
import { createGameScene } from './ui/game-scene.js';
import { createResultsScene } from './ui/results-scene.js';
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

const theme = readTheme();
const appState = createAppStateMachine();
const debugOverlay = gameConfig.debugEnabled ? createDebugOverlay({ getViewport }) : null;

// Final game state captured at player death, handed to the Results scene. main.js owns
// the handoff so the game scene doesn't need to know about the app-state machine.
let lastResults = null;

// Whether the next GAME transition starts fresh or continues the save. Set by the menu
// action and read by the GAME scene factory when the transition runs.
let startMode = 'new';

function handleMenuAction(id) {
  switch (id) {
    case 'new':
      startMode = 'new';
      appState.transition(AppState.GAME);
      break;
    case 'continue':
      startMode = 'continue';
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
  createGameScene({
    theme,
    getViewport,
    startMode,
    onGameOver: (results) => {
      lastResults = results;
      appState.transition(AppState.RESULTS);
    },
    onNewGame: () => {
      startMode = 'new';
      appState.transition(AppState.GAME);
    },
  })
);
appState.register(AppState.RESULTS, () =>
  createResultsScene({
    theme,
    getViewport,
    getResults: () => lastResults,
    onContinue: () => appState.transition(AppState.MENU),
  })
);

resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

appState.transition(AppState.SPLASH);

function frame() {
  appState.render(ctx);
  debugOverlay?.render(appState.layers.top());
  requestAnimationFrame(frame);
}

function updateDebugPointer(x, y) {
  if (!debugOverlay) return;
  const scene = appState.layers.top();
  const world = scene?.screenToWorld?.(x, y);
  if (!world) { debugOverlay.setPointerPos(x, y, null); return; }
  const tx = Math.floor(world.x);
  const ty = Math.floor(world.y);
  debugOverlay.setPointerPos(x, y, scene.getDebugInfo?.(tx, ty) ?? { x: tx, y: ty });
}
requestAnimationFrame(frame);

canvas.addEventListener('pointerdown', (e) => {
  appState.handleInput({ type: 'pointerdown', x: e.clientX, y: e.clientY, pointerId: e.pointerId });
  updateDebugPointer(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  appState.handleInput({ type: 'pointermove', x: e.clientX, y: e.clientY, pointerId: e.pointerId });
  updateDebugPointer(e.clientX, e.clientY);
});
canvas.addEventListener('pointerup', (e) => {
  appState.handleInput({ type: 'pointerup', x: e.clientX, y: e.clientY, pointerId: e.pointerId });
});
canvas.addEventListener('pointercancel', (e) => {
  appState.handleInput({ type: 'pointercancel', x: e.clientX, y: e.clientY, pointerId: e.pointerId });
});
// Desktop zoom. preventDefault stops ctrl+wheel page zoom; the canvas already sets touch-action:none.
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  appState.handleInput({ type: 'wheel', deltaY: e.deltaY, x: e.clientX, y: e.clientY });
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (debugOverlay) {
    if (e.key === '`') { debugOverlay.toggle(); return; }
    if (e.key === '1') { debugOverlay.toggleFov(); return; }
    if (e.key === '2') { debugOverlay.togglePassability(); return; }
    if (e.key === '3') { debugOverlay.toggleScent(); return; }
    if (e.key === '4') { debugOverlay.toggleSound(); return; }
  }
  appState.handleInput({ type: 'keydown', key: e.key });
});

if ('serviceWorker' in navigator) {
  // When a new worker activates (after a deploy), reload so the page runs the fresh assets.
  // Guarded to an existing controller so this never fires on the very first install, and to a
  // one-shot flag so a single activation can't loop. This is what lets an installed PWA pick up
  // updates without a manual delete/reinstall (notably on iOS).
  if (navigator.serviceWorker.controller) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }
  navigator.serviceWorker.register('./service-worker.js').catch((err) => {
    console.warn('Service worker registration failed:', err);
  });
}

console.log('ROGµE booted');
