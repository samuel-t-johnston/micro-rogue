import { drawButton, hitTest } from './canvas-ui.js';

/**
 * @file A point-anchored contextual action menu — the popover raised by a long-press (touch) or
 * right-click (desktop) on a map tile. Unlike the centered, screen-dimming action-menu, this opens
 * *at* the tap and clamps itself to the viewport (flipping left/up near an edge) so it never spills
 * off-screen. Modal while open: it swallows input and dismisses on selection, tap-outside, or Escape.
 *
 * - anchor: { x, y } screen point the menu opens from (top-left corner, before edge clamping).
 * - rows: array of { label, action } — `action` is the game action to submit when the row is tapped.
 * - onSelect: invoked with the chosen `action`, or null when dismissed.
 */

const PANEL_W = 240;
const ROW_H = 44;
const ROW_GAP = 6;
const PAD = 8;
const MARGIN = 8; // keep this far from the viewport edge

/** Creates a contextual menu anchored at a screen point. `onSelect(action|null)` on choice/dismiss. */
export function createContextMenu({ theme, getViewport, anchor, rows, onSelect }) {
  let hover = -1;

  function layout() {
    const vp = getViewport();
    const w = PANEL_W;
    const h = PAD * 2 + rows.length * ROW_H + (rows.length - 1) * ROW_GAP;
    // Open below-right of the tap; flip to the other side when it would overflow, then hard-clamp.
    let x = anchor.x + MARGIN > vp.width - w ? anchor.x - w : anchor.x;
    let y = anchor.y + h > vp.height - MARGIN ? anchor.y - h : anchor.y;
    x = Math.max(MARGIN, Math.min(x, vp.width - MARGIN - w));
    y = Math.max(MARGIN, Math.min(y, vp.height - MARGIN - h));
    return { x, y, w, h };
  }

  function rowRect(panel, i) {
    return {
      x: panel.x + PAD,
      y: panel.y + PAD + i * (ROW_H + ROW_GAP),
      w: panel.w - 2 * PAD,
      h: ROW_H,
    };
  }

  function rowAt(px, py) {
    const panel = layout();
    for (let i = 0; i < rows.length; i++) {
      if (hitTest(rowRect(panel, i), px, py)) return i;
    }
    return -1;
  }

  return {
    render(ctx) {
      const panel = layout();
      ctx.fillStyle = theme.surface;
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1);

      rows.forEach((row, i) => {
        drawButton(ctx, theme, {
          ...rowRect(panel, i),
          label: row.label,
          enabled: true,
          hover: i === hover,
        });
      });
    },

    handleInput(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        onSelect(null);
        return true;
      }
      if (event.type === 'pointermove') {
        hover = rowAt(event.x, event.y);
        return true;
      }
      if (event.type === 'pointerdown') {
        const i = rowAt(event.x, event.y);
        if (i >= 0) {
          onSelect(rows[i].action);
          return true;
        }
        if (!hitTest(layout(), event.x, event.y)) {
          onSelect(null);
          return true;
        } // tap-outside dismisses
        return true; // inside the panel but not on a row — consume
      }
      return event.type === 'pointerup' || event.type === 'pointercancel';
    },
  };
}
