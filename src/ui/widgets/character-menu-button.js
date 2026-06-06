import { drawText, hitTest } from '../canvas-ui.js';
import { Anchor, resolveAnchor } from '../anchor-system.js';

const BUTTON_SIZE = 44;
const MARGIN = 12;

// HUD button that opens the character menu. Mounted at the bottom-right per ux-design.md
// (handedness swap is a future accessibility setting).
export function createCharacterMenuButton({ theme, getViewport, onOpen }) {
  function buttonRect() {
    const { x, y } = resolveAnchor(Anchor.BOTTOM_RIGHT, getViewport());
    return { x: x - MARGIN - BUTTON_SIZE, y: y - MARGIN - BUTTON_SIZE, w: BUTTON_SIZE, h: BUTTON_SIZE };
  }

  return {
    render(ctx) {
      const btn = buttonRect();
      ctx.fillStyle = theme.surface;
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      drawText(ctx, '\u{1F464}', btn.x + btn.w / 2, btn.y + btn.h / 2, {
        color: theme.text, size: 22, align: 'center', baseline: 'middle',
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
