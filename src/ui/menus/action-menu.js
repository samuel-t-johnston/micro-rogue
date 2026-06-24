import { drawText, drawButton, hitTest } from '../core/canvas-ui.js';

const PANEL_W = 260;
const HEADER_H = 44;
const BUTTON_H = 44;
const BUTTON_GAP = 8;
const PADDING = 16;

/**
 * Creates a centered floating action menu — used by screens to surface per-item action choices
 * (e.g. Use / Drop / Cancel for a potion). Captures all input until dismissed. `actions` is a list of
 * `{ label, action }` rows (`action` is the payload to submit when tapped, or null for a Cancel/
 * dismiss row); `onSelect` is invoked with the chosen action, or null when cancelled.
 */
export function createActionMenu({ theme, getViewport, title, actions, onSelect }) {
  function layout() {
    const vp = getViewport();
    const panelH =
      HEADER_H + PADDING + actions.length * BUTTON_H + (actions.length - 1) * BUTTON_GAP + PADDING;
    const x = Math.round((vp.width - PANEL_W) / 2);
    const y = Math.round((vp.height - panelH) / 2);
    return { x, y, w: PANEL_W, h: panelH };
  }

  function buttonRect(panel, i) {
    return {
      x: panel.x + PADDING,
      y: panel.y + HEADER_H + PADDING + i * (BUTTON_H + BUTTON_GAP),
      w: panel.w - 2 * PADDING,
      h: BUTTON_H,
    };
  }

  return {
    render(ctx) {
      const vp = getViewport();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, vp.width, vp.height);

      const panel = layout();
      ctx.fillStyle = theme.surface;
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1);

      drawText(ctx, title, panel.x + panel.w / 2, panel.y + HEADER_H / 2, {
        color: theme.text,
        size: 15,
        weight: '600',
        align: 'center',
        baseline: 'middle',
      });
      ctx.fillStyle = theme.primary;
      ctx.fillRect(panel.x, panel.y + HEADER_H, panel.w, 1);

      actions.forEach((a, i) => {
        drawButton(ctx, theme, { ...buttonRect(panel, i), label: a.label, enabled: true });
      });
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        onSelect(null);
        return true;
      }
      if (event.type === 'pointerdown') {
        const panel = layout();
        for (let i = 0; i < actions.length; i++) {
          if (hitTest(buttonRect(panel, i), event.x, event.y)) {
            onSelect(actions[i].action);
            return true;
          }
        }
        // tap outside the panel dismisses
        if (!hitTest(panel, event.x, event.y)) {
          onSelect(null);
          return true;
        }
        return true; // tap inside panel but not on a button — consume
      }
      return event.type === 'pointermove';
    },
  };
}
