import { drawText, hitTest } from '../canvas-ui.js';
import { Anchor, applyHandedness, placeBox } from '../anchor-system.js';
import { gameSettings } from '../../engine/settings.js';

const BUTTON_SIZE = 44;
const MARGIN = 12;

// HUD button that opens the in-game game menu. Mounted top-right (mirrored to top-left when
// handedness is 'left') to stay clear of the HUD, the log button, and the character-menu
// button — all of which mirror with it. The gear reads as "system/options".
const ANCHOR = Anchor.TOP_RIGHT;

/** Creates the game-menu (gear) HUD button. `onOpen` fires when tapped. */
export function createGameMenuButton({ theme, getViewport, onOpen }) {
  function buttonRect() {
    const anchor = applyHandedness(ANCHOR, gameSettings.get('handedness'));
    return placeBox(anchor, getViewport(), { w: BUTTON_SIZE, h: BUTTON_SIZE, margin: MARGIN });
  }

  return {
    render(ctx) {
      const btn = buttonRect();
      ctx.fillStyle = theme.surface;
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      drawText(ctx, '⚙', btn.x + btn.w / 2, btn.y + btn.h / 2, {
        color: theme.text,
        size: 22,
        align: 'center',
        baseline: 'middle',
      });
    },

    handleInput(event) {
      if (event.type !== 'pointerdown') return false;
      if (!hitTest(buttonRect(), event.x, event.y)) return false;
      onOpen();
      return true;
    },
  };
}
