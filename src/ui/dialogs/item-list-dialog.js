import { drawText, drawButton, hitTest } from '../core/canvas-ui.js';
import { displayName } from '../../engine/log/text/log-text.js';

const DIALOG_W = 320;
const HEADER_H = 44;
const ROW_H = 44; // minimum tap target (ux-design.md accessibility)
const FOOTER_H = 64;
const PADDING = 16;
const CB_SIZE = 16;
const BTN_W = 110;
const BTN_H = 44; // minimum tap target (ux-design.md accessibility)

/**
 * Creates a modal multi-select item-list dialog (used for container/floor pickups and placing items
 * into a container). All items start selected; the footer confirm button (label per `confirmLabel`,
 * default 'Take') reflects the count. `onClose` receives `{ confirmed, taken }` — `taken` is the set
 * of selected items to move; Cancel/Escape yields `{ confirmed: false, taken: [] }`.
 */
export function createItemListDialog({
  theme,
  getViewport,
  title,
  items,
  confirmLabel = 'Take',
  onClose,
}) {
  const selected = new Set(items.map((i) => i.id));

  function layout() {
    const { width, height } = getViewport();
    const dialogH = HEADER_H + 1 + items.length * ROW_H + 1 + FOOTER_H;
    const dlgX = Math.round((width - DIALOG_W) / 2);
    const dlgY = Math.round((height - dialogH) / 2);
    return { dlgX, dlgY, dialogH };
  }

  function itemRowRect(i, dlgX, dlgY) {
    return { x: dlgX, y: dlgY + HEADER_H + 1 + i * ROW_H, w: DIALOG_W, h: ROW_H };
  }

  function cancelBtn(dlgX, dlgY, dialogH) {
    return {
      x: dlgX + PADDING,
      y: dlgY + dialogH - FOOTER_H + Math.round((FOOTER_H - BTN_H) / 2),
      w: BTN_W,
      h: BTN_H,
      label: 'Cancel',
      enabled: true,
    };
  }

  function confirmBtn(dlgX, dlgY, dialogH) {
    return {
      x: dlgX + DIALOG_W - PADDING - BTN_W,
      y: dlgY + dialogH - FOOTER_H + Math.round((FOOTER_H - BTN_H) / 2),
      w: BTN_W,
      h: BTN_H,
      label: selected.size > 0 ? `${confirmLabel} (${selected.size})` : confirmLabel,
      enabled: selected.size > 0,
    };
  }

  return {
    render(ctx) {
      const { width, height } = getViewport();
      const { dlgX, dlgY, dialogH } = layout();

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = theme.surface;
      ctx.fillRect(dlgX, dlgY, DIALOG_W, dialogH);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(dlgX + 0.5, dlgY + 0.5, DIALOG_W - 1, dialogH - 1);

      drawText(ctx, title, dlgX + PADDING, dlgY + HEADER_H / 2, {
        color: theme.text,
        size: 15,
        weight: '600',
        baseline: 'middle',
      });

      ctx.fillStyle = theme.primary;
      ctx.fillRect(dlgX, dlgY + HEADER_H, DIALOG_W, 1);

      items.forEach((item, i) => {
        const rowY = dlgY + HEADER_H + 1 + i * ROW_H;
        const isSelected = selected.has(item.id);
        const name = displayName(item);

        if (isSelected) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(dlgX, rowY, DIALOG_W, ROW_H);
        }

        const cbX = dlgX + PADDING;
        const cbY = rowY + Math.round((ROW_H - CB_SIZE) / 2);
        ctx.fillStyle = isSelected ? theme.primary : 'transparent';
        ctx.fillRect(cbX, cbY, CB_SIZE, CB_SIZE);
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 1;
        ctx.strokeRect(cbX + 0.5, cbY + 0.5, CB_SIZE - 1, CB_SIZE - 1);

        if (isSelected) {
          drawText(ctx, '✓', cbX + CB_SIZE / 2, cbY + CB_SIZE / 2, {
            color: theme.bg,
            size: 11,
            weight: '700',
            align: 'center',
            baseline: 'middle',
          });
        }

        drawText(ctx, name, cbX + CB_SIZE + 10, rowY + ROW_H / 2, {
          color: theme.text,
          size: 14,
          baseline: 'middle',
        });
      });

      ctx.fillStyle = theme.primary;
      ctx.fillRect(dlgX, dlgY + HEADER_H + 1 + items.length * ROW_H, DIALOG_W, 1);

      drawButton(ctx, theme, cancelBtn(dlgX, dlgY, dialogH));
      drawButton(ctx, theme, confirmBtn(dlgX, dlgY, dialogH));
    },

    handleInput(event) {
      const { dlgX, dlgY, dialogH } = layout();

      if (event.type === 'keydown' && event.key === 'Escape') {
        onClose({ confirmed: false, taken: [] });
        return true;
      }

      if (event.type === 'pointerdown') {
        if (hitTest(cancelBtn(dlgX, dlgY, dialogH), event.x, event.y)) {
          onClose({ confirmed: false, taken: [] });
          return true;
        }

        const cb = confirmBtn(dlgX, dlgY, dialogH);
        if (cb.enabled && hitTest(cb, event.x, event.y)) {
          onClose({ confirmed: true, taken: items.filter((i) => selected.has(i.id)) });
          return true;
        }

        items.forEach((item, i) => {
          if (hitTest(itemRowRect(i, dlgX, dlgY), event.x, event.y)) {
            if (selected.has(item.id)) selected.delete(item.id);
            else selected.add(item.id);
          }
        });

        return true;
      }

      if (event.type === 'pointermove') return true;

      return false;
    },
  };
}
