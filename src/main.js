import { AppState, createAppStateMachine } from './engine/app-state.js';
import { readTheme } from './engine/theme.js';
import { createSplashScene } from './ui/splash.js';
import { createMenuScene } from './ui/game-menu.js';

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
}

function getViewport() {
  return viewport;
}

const theme = readTheme();
const appState = createAppStateMachine();

function handleMenuAction(id) {
  switch (id) {
    case 'new':
      console.log('[menu] New Game');
      break;
    case 'quit':
      try {
        window.close();
      } catch {
        // Most browsers reject window.close() unless the tab was script-opened.
        // Real "you can close this tab now" UI lands with the menu polish pass.
      }
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

resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

appState.transition(AppState.SPLASH);

function frame() {
  appState.render(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

canvas.addEventListener('pointerdown', (e) => {
  appState.handleInput({ type: 'pointerdown', x: e.clientX, y: e.clientY });
});
canvas.addEventListener('pointermove', (e) => {
  appState.handleInput({ type: 'pointermove', x: e.clientX, y: e.clientY });
});
window.addEventListener('keydown', (e) => {
  appState.handleInput({ type: 'keydown', key: e.key });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch((err) => {
    console.warn('Service worker registration failed:', err);
  });
}

console.log('ROGµE booted');
