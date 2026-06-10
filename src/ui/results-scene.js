import { drawText } from './canvas-ui.js';

// Full-screen run-results page, shown after the player dismisses the death popup.
// Modeled on the splash scene: a top-level AppState scene that fills the viewport.
//
// It is intentionally thin: getResults() hands back the final game state captured at
// death ({ turns, player, level }), and this screen just presents it. New stat lines
// (kills, depth, cause of death) can be added without touching the death flow.
const LINE_H = 32;

export function createResultsScene({ theme, getViewport, getResults, onContinue }) {
  function lines() {
    const results = getResults?.() ?? {};
    return [
      `Turns: ${results.turns ?? 0}`,
      '…',
      '…',
    ];
  }

  return {
    render(ctx) {
      const { width, height } = getViewport();
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      drawText(ctx, 'Results', width / 2, Math.round(height * 0.22), {
        color: theme.text,
        size: 48,
        weight: '700',
        align: 'center',
        baseline: 'middle',
      });

      const rows = lines();
      const startY = Math.round(height * 0.4);
      const colX = Math.round(width / 2 - 100);
      rows.forEach((line, i) => {
        drawText(ctx, line, colX, startY + i * LINE_H, {
          color: theme.text,
          size: 20,
          align: 'left',
          baseline: 'middle',
        });
      });

      drawText(ctx, 'tap to continue', width / 2, Math.round(height * 0.82), {
        color: theme.textDim,
        size: 16,
        align: 'center',
        baseline: 'middle',
      });
    },

    handleInput(event) {
      if (event.type === 'pointerdown' || event.type === 'keydown') {
        onContinue?.();
        return true;
      }
      return false;
    },
  };
}
