import { drawText, hitTest } from '../canvas-ui.js';
import { Anchor, applyHandedness, placeBox } from '../anchor-system.js';
import { gameSettings } from '../../engine/settings.js';

const BUTTON_SIZE = 44;
const MARGIN = 12;

// HUD button that opens the character menu. The primary action button: bottom-right for
// right-handed players, mirrored to bottom-left when handedness is 'left' (ux-design.md).
const ANCHOR = Anchor.BOTTOM_RIGHT;

/** Creates the character-menu HUD button (the primary action button). `onOpen` fires when tapped. */
export function createCharacterMenuButton({ theme, getViewport, onOpen }) {
  function buttonRect() {
    const anchor = applyHandedness(ANCHOR, gameSettings.get('handedness'));
    return placeBox(anchor, getViewport(), { w: BUTTON_SIZE, h: BUTTON_SIZE, margin: MARGIN });
  }

  return {
    render(ctx) {
      const btn = buttonRect();
      ctx.fillStyle = theme.surface;
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      drawText(ctx, '\u{1F464}', btn.x + btn.w / 2, btn.y + btn.h / 2, {
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
