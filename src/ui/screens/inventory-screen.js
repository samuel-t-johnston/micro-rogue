import { drawText, hitTest } from '../canvas-ui.js';

const ROW_H = 36;
const PADDING = 12;

// Renders the inventory item list inside the body rect of the character menu.
// Tapping a consumable row submits a consume action via onAction; equippable
// items show their slot tag but ignore taps (equip lives on the Equipment screen).
// items: array of entities with `name` and optionally `equippable` / `consumable`.
export function createInventoryScreenBody({ theme, getItems, onAction }) {
  function rowRect(body, i) {
    return { x: body.x, y: body.y + i * ROW_H, w: body.w, h: ROW_H };
  }

  return {
    render(ctx, body) {
      const items = getItems();
      if (items.length === 0) {
        drawText(ctx, '(empty)', body.x + body.w / 2, body.y + PADDING * 2, {
          color: theme.textDim, size: 14, align: 'center',
        });
        return;
      }

      items.forEach((item, i) => {
        const rect = rowRect(body, i);
        if (i % 2 === 0) {
          ctx.fillStyle = theme.surface;
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
        const name = item.components.get('name') ?? 'Unknown';
        drawText(ctx, name, rect.x + PADDING, rect.y + ROW_H / 2, {
          color: theme.text, size: 14, baseline: 'middle',
        });

        const equippable = item.components.get('equippable');
        const consumable = item.components.get('consumable');
        if (consumable) {
          drawText(ctx, 'tap to use', rect.x + rect.w - PADDING, rect.y + ROW_H / 2, {
            color: theme.textDim, size: 11, align: 'right', baseline: 'middle',
          });
        } else if (equippable) {
          drawText(ctx, `(${equippable.slot})`, rect.x + rect.w - PADDING, rect.y + ROW_H / 2, {
            color: theme.textDim, size: 12, align: 'right', baseline: 'middle',
          });
        }
      });
    },

    handleInput(event, body) {
      if (event.type !== 'pointerdown') return false;
      const items = getItems();
      for (let i = 0; i < items.length; i++) {
        if (!hitTest(rowRect(body, i), event.x, event.y)) continue;
        const item = items[i];
        if (item.components.has('consumable')) {
          onAction({ type: 'consume', itemEntityId: item.id });
          return true;
        }
        return true; // consume the click without submitting
      }
      return false;
    },
  };
}
