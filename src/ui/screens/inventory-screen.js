import { drawText, hitTest } from '../core/canvas-ui.js';
import { createActionMenu } from '../menus/action-menu.js';
import { createQuantityStepper } from '../dialogs/quantity-stepper.js';
import { displayName } from '../../engine/log/text/log-text.js';
import { hasStackablePeers } from '../../world/entities/inventory-stacking.js';

const ROW_H = 44; // minimum tap target (ux-design.md accessibility)
const PADDING = 12;

// A stack's live count, or 1 for a non-stackable item.
const stackCount = (item) => item.components.get('stackable')?.count ?? 1;

// Builds the list of actions available for a given inventory item, given the full inventory (needed to
// decide whether "Stack all" can consolidate anything). Cancel is always last and submits null (close
// the menu, no action). The 'split' row carries no quantity — selecting it opens a quantity stepper,
// which submits the real `split` action; both Split and Stack all are free, turn-less actions.
function actionsForItem(item, items) {
  const out = [];
  if (item.components.has('consumable'))
    out.push({ label: 'Use', action: { type: 'consume', itemEntityId: item.id } });
  if (item.components.has('equippable'))
    out.push({ label: 'Equip', action: { type: 'equip', itemEntityId: item.id } });
  // Any carried item can be thrown; the coordinates are filled in by the scene's targeting mode
  // after the player picks a tile, so the action leaves the menu without an x/y.
  out.push({ label: 'Throw', action: { type: 'throw', itemEntityId: item.id } });
  if (stackCount(item) > 1)
    out.push({ label: 'Split', action: { type: 'split', itemEntityId: item.id } });
  if (hasStackablePeers(items, item))
    out.push({ label: 'Stack all', action: { type: 'stackAll', itemEntityId: item.id } });
  out.push({ label: 'Drop', action: { type: 'drop', itemEntityId: item.id } });
  out.push({ label: 'Cancel', action: null });
  return out;
}

/**
 * Creates the inventory screen body. Tapping a row opens an action menu; selecting an action submits
 * it via onAction and the caller closes the menu. Cancelling clears the menu in place.
 */
export function createInventoryScreenBody({ theme, getViewport, getItems, onAction }) {
  let activeItem = null;
  let menu = null;

  function rowRect(body, i) {
    return { x: body.x, y: body.y + i * ROW_H, w: body.w, h: ROW_H };
  }

  function openMenuFor(item) {
    activeItem = item;
    menu = createActionMenu({
      theme,
      getViewport,
      title: `${displayName(item, 'Item')} — Actions`,
      actions: actionsForItem(item, getItems()),
      onSelect: (action) => {
        // Split needs a quantity first: swap the action menu for a stepper, staying on this item.
        // It only submits the real `split` action once the player confirms a quantity.
        if (action?.type === 'split' && action.quantity == null) {
          openSplitPickerFor(item);
          return;
        }
        activeItem = null;
        menu = null;
        if (action) onAction(action);
      },
    });
  }

  // The quantity picker for Split: clamped 1..count-1 (you can't split off the whole stack — that's
  // just the stack itself). Confirm submits the split; Cancel returns to the inventory list.
  function openSplitPickerFor(item) {
    const count = stackCount(item);
    menu = createQuantityStepper({
      theme,
      getViewport,
      title: `Split ${displayName(item)}`,
      min: 1,
      max: count - 1,
      initial: Math.floor(count / 2), // halving is the conventional "split" default
      confirmLabel: 'Split',
      onConfirm: (quantity) => {
        activeItem = null;
        menu = null;
        onAction({ type: 'split', itemEntityId: item.id, quantity });
      },
      onCancel: () => {
        activeItem = null;
        menu = null;
      },
    });
  }

  return {
    render(ctx, body) {
      const items = getItems();
      if (items.length === 0) {
        drawText(ctx, '(empty)', body.x + body.w / 2, body.y + PADDING * 2, {
          color: theme.textDim,
          size: 14,
          align: 'center',
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
          const name = displayName(item);
          drawText(ctx, name, rect.x + PADDING, rect.y + ROW_H / 2, {
            color: isActive ? theme.bg : theme.text,
            size: 14,
            baseline: 'middle',
          });

          const equippable = item.components.get('equippable');
          if (equippable) {
            drawText(ctx, `(${equippable.slot})`, rect.x + rect.w - PADDING, rect.y + ROW_H / 2, {
              color: isActive ? theme.bg : theme.textDim,
              size: 12,
              align: 'right',
              baseline: 'middle',
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
