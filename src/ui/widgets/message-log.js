import { drawText, hitTest } from '../canvas-ui.js';
import { Anchor, resolveAnchor } from '../anchor-system.js';

const BUTTON_SIZE = 44;
const MARGIN = 12;
const LINE_HEIGHT = 18;
const LOG_TEXT_SIZE = 14;

// Icons for each log view state (M7 will use EXPANDED and DEBUG)
export const LogViewState = Object.freeze({
  GHOST: 'ghost',
  EXPANDED: 'expanded',
  DEBUG: 'debug',
});

const STATE_ICON = {
  [LogViewState.GHOST]: '≡',
  [LogViewState.EXPANDED]: '☰',
  [LogViewState.DEBUG]: '{}',
};

export function createMessageLogWidget({ theme, getViewport }) {
  function buttonRect() {
    const { x, y } = resolveAnchor(Anchor.BOTTOM_LEFT, getViewport());
    return { x: x + MARGIN, y: y - MARGIN - BUTTON_SIZE, w: BUTTON_SIZE, h: BUTTON_SIZE };
  }

  return {
    render(ctx, state) {
      const { recentLines, viewState = LogViewState.GHOST } = state;
      const btn = buttonRect();

      // Ghost lines above button — oldest at top, newest just above button.
      // Alpha steps from 0.35 (oldest) to 0.65 (newest).
      const count = recentLines.length;
      recentLines.forEach((line, i) => {
        const alpha = count === 1 ? 0.65 : 0.35 + (i / (count - 1)) * 0.30;
        const ly = btn.y - (count - i) * LINE_HEIGHT - 4;
        ctx.save();
        ctx.globalAlpha = alpha;
        drawText(ctx, line, btn.x, ly, { color: theme.textDim, size: LOG_TEXT_SIZE });
        ctx.restore();
      });

      // Button
      ctx.fillStyle = theme.surface;
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      drawText(ctx, STATE_ICON[viewState], btn.x + btn.w / 2, btn.y + btn.h / 2, {
        color: theme.textDim,
        size: 18,
        align: 'center',
        baseline: 'middle',
      });
    },

    // Consume taps on the button so they don't fall through to map movement.
    // Full interaction (open/close overlay) lands in M7.
    handleInput(event) {
      if (event.type !== 'pointerdown') return false;
      return hitTest(buttonRect(), event.x, event.y);
    },
  };
}
