import { AppState } from '../../engine/core/app-state.js';
import { drawText, drawButton, hitTest } from '../core/canvas-ui.js';

const BUTTON_W = 240;
const BUTTON_H = 56;

/** Creates the splash scene: the title card; any tap or key transitions to the main menu. */
export function createSplashScene({ appState, theme, getViewport }) {
  let hover = false;

  function continueButton() {
    const { width, height } = getViewport();
    return {
      x: (width - BUTTON_W) / 2,
      y: Math.round(height * 0.72),
      w: BUTTON_W,
      h: BUTTON_H,
      label: 'tap to continue',
    };
  }

  return {
    render(ctx) {
      const { width, height } = getViewport();
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      drawText(ctx, 'ROGµE', width / 2, Math.round(height * 0.36), {
        color: theme.text,
        size: 72,
        weight: '700',
        align: 'center',
        baseline: 'middle',
      });

      drawText(ctx, 'a roguelike engine', width / 2, Math.round(height * 0.36) + 56, {
        color: theme.textDim,
        size: 16,
        align: 'center',
        baseline: 'middle',
      });

      drawButton(ctx, theme, { ...continueButton(), hover });
    },

    handleInput(event) {
      if (event.type === 'pointerdown' || event.type === 'keydown') {
        appState.transition(AppState.MENU);
        return true;
      }
      if (event.type === 'pointermove') {
        hover = hitTest(continueButton(), event.x, event.y);
        return false;
      }
      return false;
    },
  };
}
