import { drawText, drawButton, hitTest, wrapText } from './canvas-ui.js';

// A centered modal notice: a wrapped message plus a single button. For one-way information the
// player must acknowledge (e.g. "your saved game couldn't be loaded"), as opposed to action-menu's
// multi-choice prompts. Captures all input until dismissed; tapping the button confirms, while
// Escape or a tap outside dismisses.
const PANEL_W = 320;
const PADDING = 20;
const LINE_H = 22;
const TEXT_SIZE = 15;
const BUTTON_H = 44;
const BUTTON_GAP = 18;

export function createNotice({ theme, getViewport, message, buttonLabel = 'OK', onConfirm, onDismiss }) {
  let button = null; // last render's button rect, reused for hit-testing

  function layout(ctx) {
    const vp = getViewport();
    const w = Math.min(PANEL_W, vp.width - 32);
    const lines = wrapText(ctx, message, w - 2 * PADDING, { size: TEXT_SIZE });
    const h = PADDING + lines.length * LINE_H + BUTTON_GAP + BUTTON_H + PADDING;
    const x = Math.round((vp.width - w) / 2);
    const y = Math.round((vp.height - h) / 2);
    return { x, y, w, h, lines, button: { x: x + PADDING, y: y + h - PADDING - BUTTON_H, w: w - 2 * PADDING, h: BUTTON_H } };
  }

  return {
    render(ctx) {
      const vp = getViewport();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, vp.width, vp.height);

      const p = layout(ctx);
      button = p.button;
      ctx.fillStyle = theme.surface;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);

      p.lines.forEach((line, i) => {
        drawText(ctx, line, p.x + p.w / 2, p.y + PADDING + i * LINE_H, {
          color: theme.text, size: TEXT_SIZE, align: 'center', baseline: 'top',
        });
      });
      drawButton(ctx, theme, { ...p.button, label: buttonLabel, enabled: true });
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') { onDismiss?.(); return true; }
      if (event.type === 'pointerdown') {
        if (button && hitTest(button, event.x, event.y)) { onConfirm?.(); return true; }
        onDismiss?.(); // tap anywhere outside the button dismisses
        return true;
      }
      return event.type === 'pointermove'; // swallow moves so the menu beneath doesn't hover
    },
  };
}
