import { drawText } from '../canvas-ui.js';

const ROW_H = 36;
const PADDING = 12;

// Renders a plain item list inside the body rect of the character menu.
// items: array of entities with `name` and `equippable` (optional) components.
export function createInventoryScreenBody({ theme, getItems }) {
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
        const rowY = body.y + i * ROW_H;
        if (i % 2 === 0) {
          ctx.fillStyle = theme.surface;
          ctx.fillRect(body.x, rowY, body.w, ROW_H);
        }
        const name = item.components.get('name') ?? 'Unknown';
        drawText(ctx, name, body.x + PADDING, rowY + ROW_H / 2, {
          color: theme.text, size: 14, baseline: 'middle',
        });

        const equippable = item.components.get('equippable');
        if (equippable) {
          drawText(ctx, `(${equippable.slot})`, body.x + body.w - PADDING, rowY + ROW_H / 2, {
            color: theme.textDim, size: 12, align: 'right', baseline: 'middle',
          });
        }
      });
    },

    handleInput(_event, _body) {
      return false;
    },
  };
}
