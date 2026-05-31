import { hasSave } from '../save/save-stub.js';
import { drawText, drawButton, hitTest } from './canvas-ui.js';

const ITEMS = [
  { id: 'new', label: 'New Game' },
  { id: 'continue', label: 'Continue', requiresSave: true },
  { id: 'settings', label: 'Settings', disabled: true },
];

const BUTTON_W = 260;
const BUTTON_H = 56;
const BUTTON_GAP = 16;

export function createMenuScene({ theme, getViewport, onAction }) {
  let hoverId = null;

  function layout() {
    const { width, height } = getViewport();
    const total = ITEMS.length * BUTTON_H + (ITEMS.length - 1) * BUTTON_GAP;
    const startY = Math.round((height - total) / 2);
    return ITEMS.map((item, i) => ({
      ...item,
      enabled: !item.disabled && (!item.requiresSave || hasSave()),
      x: Math.round((width - BUTTON_W) / 2),
      y: startY + i * (BUTTON_H + BUTTON_GAP),
      w: BUTTON_W,
      h: BUTTON_H,
    }));
  }

  return {
    render(ctx) {
      const { width, height } = getViewport();
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      drawText(ctx, 'ROGµE', width / 2, Math.round(height * 0.18), {
        color: theme.text,
        size: 48,
        weight: '700',
        align: 'center',
        baseline: 'middle',
      });

      for (const button of layout()) {
        drawButton(ctx, theme, { ...button, hover: hoverId === button.id });
      }
    },

    handleInput(event) {
      const buttons = layout();
      if (event.type === 'pointerdown') {
        for (const b of buttons) {
          if (b.enabled && hitTest(b, event.x, event.y)) {
            onAction?.(b.id);
            return true;
          }
        }
        return false;
      }
      if (event.type === 'pointermove') {
        let nextHover = null;
        for (const b of buttons) {
          if (b.enabled && hitTest(b, event.x, event.y)) {
            nextHover = b.id;
            break;
          }
        }
        hoverId = nextHover;
        return false;
      }
      return false;
    },
  };
}
