import { drawText, hitTest } from '../canvas-ui.js';
import { createActionMenu } from '../action-menu.js';

const ROW_H = 44; // minimum tap target (ux-design.md accessibility)
const PADDING = 12;

// Builds the list of actions available for a given inventory item.
// Cancel is always last and always submits null (close the menu, no action).
function actionsForItem(item) {
  const out = [];
  if (item.components.has('consumable')) out.push({ label: 'Use', action: { type: 'consume', itemEntityId: item.id } });
  if (item.components.has('equippable')) out.push({ label: 'Equip', action: { type: 'equip', itemEntityId: item.id } });
  out.push({ label: 'Drop', action: { type: 'drop', itemEntityId: item.id } });
  out.push({ label: 'Cancel', action: null });
  return out;
}

// Inventory list. Tapping a row opens an action menu; selecting an action submits it
// via onAction and the caller closes the menu. Cancelling clears the menu in place.
export function createInventoryScreenBody({ theme, getViewport, getItems, onAction }) {
  let activeItem = null;
  let menu = null;

  function rowRect(body, i) {
    return { x: body.x, y: body.y + i * ROW_H, w: body.w, h: ROW_H };
  }

  function openMenuFor(item) {
    activeItem = item;
    menu = createActionMenu({
      theme, getViewport,
      title: `${item.components.get('name') ?? 'Item'} — Actions`,
      actions: actionsForItem(item),
      onSelect: (action) => {
        activeItem = null;
        menu = null;
        if (action) onAction(action);
      },
    });
  }

  return {
    render(ctx, body) {
      const items = getItems();
      if (items.length === 0) {
        drawText(ctx, '(empty)', body.x + body.w / 2, body.y + PADDING * 2, {
          color: theme.textDim, size: 14, align: 'center',
        });
      } else {
        items.forEach((item, i) => {
          const rect = rowRect(body, i);
          const isActive = item === activeItem;
          if (isActive) {
            ctx.fillStyle = theme.accent;
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          } else if (i % 2 === 0) {
            ctx.fillStyle = theme.surface;
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          }
          const name = item.components.get('name') ?? 'Unknown';
          drawText(ctx, name, rect.x + PADDING, rect.y + ROW_H / 2, {
            color: isActive ? theme.bg : theme.text, size: 14, baseline: 'middle',
          });

          const equippable = item.components.get('equippable');
          if (equippable) {
            drawText(ctx, `(${equippable.slot})`, rect.x + rect.w - PADDING, rect.y + ROW_H / 2, {
              color: isActive ? theme.bg : theme.textDim,
              size: 12, align: 'right', baseline: 'middle',
            });
          }
        });
      }

      menu?.render(ctx);
    },

    handleInput(event, body) {
      if (menu) return menu.handleInput(event);
      if (event.type !== 'pointerdown') return false;
      const items = getItems();
      for (let i = 0; i < items.length; i++) {
        if (hitTest(rowRect(body, i), event.x, event.y)) {
          openMenuFor(items[i]);
          return true;
        }
      }
      return false;
    },
  };
}
