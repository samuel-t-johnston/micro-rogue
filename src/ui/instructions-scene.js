import { drawText, drawButton, drawCheckbox, hitTest, wrapText } from './canvas-ui.js';
import { gameSettings } from '../engine/settings.js';

// The New Game instructions screen: shown after "New Game" (unless skipped) and before the level
// loads, to orient first-time players. A top-level AppState scene like splash/results. The "Do not
// display again" checkbox writes the `skipNewGameInstructions` setting immediately (the same setting
// the Settings menu toggles), so the two stay in sync. `showCheckbox` lets this scene be reused as a
// plain help page later without the opt-out.
const HEADING = 'Welcome to ROGµE!';

const BODY = `ROGµE is a web-native, mobile-friendly game engine for traditional roguelikes.

ROGµE is fully playable out of the box. Start a new game, then click or tap around the map to find items and fight monsters.

Descend the stairs to delve deeper — the Amulet of Yendor awaits far below. If your health runs out, your run ends.

Find the Amulet of Yendor and escape through the first floor entrance to win the game!`;

const MARGIN = 28;
const MAX_COL = 560;
const BODY_SIZE = 18;
const BODY_LINE_H = 26;
const BOX_SIZE = 24;
const ROW_H = 44;          // checkbox row hit height — meets the 44px tap-target floor
const BUTTON_W = 240;
const BUTTON_H = 56;

export function createInstructionsScene({ theme, getViewport, onContinue, showCheckbox = true }) {
  let hover = false;
  let skip = gameSettings.get('skipNewGameInstructions');
  let cached = null; // last render's layout, reused for hit-testing (geometry depends on wrapped text)

  // Recomputed each render so it tracks viewport changes (resize/rotate). Needs `ctx` to measure the
  // wrapped body, which sets the vertical positions of everything below it.
  function layout(ctx) {
    const { width, height } = getViewport();
    const colW = Math.min(width - MARGIN * 2, MAX_COL);
    const colX = Math.round((width - colW) / 2);
    const bodyLines = wrapText(ctx, BODY, colW, { size: BODY_SIZE });

    const headingY = Math.round(height * 0.13);
    const bodyTop = headingY + 48;
    const checkRowY = bodyTop + bodyLines.length * BODY_LINE_H + 24;
    const boxY = checkRowY + Math.round((ROW_H - BOX_SIZE) / 2);
    const buttonY = checkRowY + (showCheckbox ? ROW_H + 24 : 8);

    return {
      colX, colW, headingY, bodyTop, bodyLines, boxY,
      checkbox: { x: colX, y: checkRowY, w: colW, h: ROW_H },
      button: { x: Math.round((width - BUTTON_W) / 2), y: buttonY, w: BUTTON_W, h: BUTTON_H, label: 'Start Adventure' },
    };
  }

  function toggleSkip() {
    skip = !skip;
    gameSettings.set('skipNewGameInstructions', skip);
  }

  return {
    render(ctx) {
      const { width, height } = getViewport();
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      const lay = layout(ctx);
      cached = lay;

      drawText(ctx, HEADING, width / 2, lay.headingY, {
        color: theme.text, size: 34, weight: '700', align: 'center', baseline: 'middle',
      });

      lay.bodyLines.forEach((line, i) => {
        drawText(ctx, line, lay.colX, lay.bodyTop + i * BODY_LINE_H, {
          color: theme.text, size: BODY_SIZE, align: 'left', baseline: 'top',
        });
      });

      if (showCheckbox) {
        drawCheckbox(ctx, theme, {
          x: lay.colX, y: lay.boxY, size: BOX_SIZE, checked: skip, label: 'Do not display again',
        });
      }

      drawButton(ctx, theme, { ...lay.button, hover });
    },

    handleInput(event) {
      if (!cached) return true; // before the first frame; swallow input on this full-screen scene
      const { checkbox, button } = cached;

      if (event.type === 'pointermove') {
        hover = hitTest(button, event.x, event.y);
        return false;
      }
      if (event.type === 'pointerdown') {
        if (showCheckbox && hitTest(checkbox, event.x, event.y)) { toggleSkip(); return true; }
        if (hitTest(button, event.x, event.y)) { onContinue?.(); return true; }
        return true;
      }
      if (event.type === 'keydown' && (event.key === 'Enter' || event.key === ' ')) {
        onContinue?.();
        return true;
      }
      return false;
    },
  };
}
