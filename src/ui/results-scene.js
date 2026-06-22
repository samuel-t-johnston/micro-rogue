import { drawText, wrapText } from './canvas-ui.js';

// Full-screen run-results page, shown after the player dismisses the death popup.
// Modeled on the splash scene: a top-level AppState scene that fills the viewport.
//
// It is intentionally thin: getResults() hands back the final game state captured at the end of the
// run ({ outcome, message, turns, player, level }), and this screen just presents it. New stat lines
// (kills, depth, cause of death) can be added without touching the end-of-run flow.
const LINE_H = 32;
const MARGIN = 24;
const MAX_COL = 560;
const BODY_SIZE = 20;
const HEADINGS = { win: 'Victory', lose: 'Defeat' };

export function createResultsScene({ theme, getViewport, getResults, onContinue }) {
  // The outcome message can be a full sentence, so wrap it to the column; stat lines follow it.
  function lines(ctx, results, colW) {
    const message = results.message || (results.outcome === 'win' ? 'You escaped the dungeon.' : 'You died in the dungeon.');
    return [
      ...wrapText(ctx, message, colW, { size: BODY_SIZE }),
      `Turns: ${results.turns ?? 0}`,
    ];
  }

  return {
    render(ctx) {
      const { width, height } = getViewport();
      const results = getResults?.() ?? {};
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      drawText(ctx, HEADINGS[results.outcome] ?? 'Results', width / 2, Math.round(height * 0.22), {
        color: theme.text,
        size: 48,
        weight: '700',
        align: 'center',
        baseline: 'middle',
      });

      const colW = Math.min(width - MARGIN * 2, MAX_COL);
      const rows = lines(ctx, results, colW);
      const startY = Math.round(height * 0.4);
      rows.forEach((line, i) => {
        drawText(ctx, line, width / 2, startY + i * LINE_H, {
          color: theme.text,
          size: BODY_SIZE,
          align: 'center',
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
