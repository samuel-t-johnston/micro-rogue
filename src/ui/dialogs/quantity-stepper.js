import { drawText, drawButton, hitTest } from '../core/canvas-ui.js';

const PANEL_W = 260;
const HEADER_H = 44;
const STEP_H = 56;
const STEP_BTN_W = 56;
const BUTTON_H = 44; // minimum tap target (ux-design.md accessibility)
const BUTTON_GAP = 8;
const PADDING = 16;

/**
 * Creates a centered modal quantity picker: a `−`/`+` stepper over a clamped integer with Confirm and
 * Cancel buttons. Used to choose how many units to split off a stack. `onConfirm` receives the chosen
 * value; `onCancel` fires on Cancel, Escape, or a tap outside the panel. The value is clamped to
 * `[min, max]`, so a stepper is only meaningful when `min < max` (the caller gates on that).
 */
export function createQuantityStepper({
  theme,
  getViewport,
  title,
  min,
  max,
  initial,
  confirmLabel = 'OK',
  onConfirm,
  onCancel,
}) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  let value = clamp(initial ?? min);

  function layout() {
    const vp = getViewport();
    const panelH = HEADER_H + PADDING + STEP_H + PADDING + BUTTON_H + PADDING;
    return {
      x: Math.round((vp.width - PANEL_W) / 2),
      y: Math.round((vp.height - panelH) / 2),
      w: PANEL_W,
      h: panelH,
    };
  }

  const stepY = (p) => p.y + HEADER_H + PADDING;
  const minusRect = (p) => ({ x: p.x + PADDING, y: stepY(p), w: STEP_BTN_W, h: STEP_H });
  const plusRect = (p) => ({
    x: p.x + p.w - PADDING - STEP_BTN_W,
    y: stepY(p),
    w: STEP_BTN_W,
    h: STEP_H,
  });
  const btnW = (p) => (p.w - 2 * PADDING - BUTTON_GAP) / 2;
  const btnY = (p) => stepY(p) + STEP_H + PADDING;
  const confirmRect = (p) => ({ x: p.x + PADDING, y: btnY(p), w: btnW(p), h: BUTTON_H });
  const cancelRect = (p) => ({
    x: p.x + PADDING + btnW(p) + BUTTON_GAP,
    y: btnY(p),
    w: btnW(p),
    h: BUTTON_H,
  });

  return {
    render(ctx) {
      const vp = getViewport();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, vp.width, vp.height);

      const p = layout();
      ctx.fillStyle = theme.surface;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);

      drawText(ctx, title, p.x + p.w / 2, p.y + HEADER_H / 2, {
        color: theme.text,
        size: 15,
        weight: '600',
        align: 'center',
        baseline: 'middle',
      });
      ctx.fillStyle = theme.primary;
      ctx.fillRect(p.x, p.y + HEADER_H, p.w, 1);

      drawButton(ctx, theme, { ...minusRect(p), label: '−', enabled: value > min });
      drawButton(ctx, theme, { ...plusRect(p), label: '+', enabled: value < max });
      drawText(ctx, String(value), p.x + p.w / 2, stepY(p) + STEP_H / 2, {
        color: theme.text,
        size: 28,
        weight: '700',
        align: 'center',
        baseline: 'middle',
      });

      drawButton(ctx, theme, { ...confirmRect(p), label: confirmLabel, enabled: true });
      drawButton(ctx, theme, { ...cancelRect(p), label: 'Cancel', enabled: true });
    },

    handleInput(event) {
      if (event.type === 'keydown') {
        switch (event.key) {
          case 'Escape':
            onCancel();
            return true;
          case 'Enter':
            onConfirm(value);
            return true;
          case 'ArrowUp':
          case 'ArrowRight':
            value = clamp(value + 1);
            return true;
          case 'ArrowDown':
          case 'ArrowLeft':
            value = clamp(value - 1);
            return true;
          default:
            return false;
        }
      }
      if (event.type === 'pointerdown') {
        const p = layout();
        if (hitTest(minusRect(p), event.x, event.y)) value = clamp(value - 1);
        else if (hitTest(plusRect(p), event.x, event.y)) value = clamp(value + 1);
        else if (hitTest(confirmRect(p), event.x, event.y)) onConfirm(value);
        else if (hitTest(cancelRect(p), event.x, event.y)) onCancel();
        else if (!hitTest(p, event.x, event.y)) onCancel(); // tap outside dismisses
        return true;
      }
      return event.type === 'pointermove';
    },
  };
}
