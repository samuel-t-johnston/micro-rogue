import { drawText, hitTest } from '../canvas-ui.js';
import { createActionMenu } from '../action-menu.js';

const ROW_H = 44; // minimum tap target (ux-design.md accessibility)
const SECTION_H = 28;
const PADDING = 12;

/**
 * Creates the equipment screen body: shows current slot contents and inventory items eligible to be
 * equipped. Tapping a row opens an action menu — Equip/Cancel for inventory items, Unequip/Cancel for
 * equipped slots. (Drop is intentionally not offered here; equipped items must be unequipped first,
 * then dropped from the inventory screen.)
 */
export function createEquipmentScreenBody({ theme, getViewport, getSlots, getEquippableInventory, onAction }) {
  // activeRow identifies the highlighted row across re-renders. For equipped slots we use
  // the slot name; for inventory items we use the item entity.
  let activeRow = null;
  let menu = null;

  function rows() {
    const slots = getSlots(); // [{ name, item|null }]
    const equippable = getEquippableInventory();

    const out = [];
    out.push({ kind: 'section', label: 'Equipped' });
    for (const { name, item } of slots) {
      out.push({ kind: 'slot', slotName: name, item });
    }
    out.push({ kind: 'section', label: 'Equippable in Inventory' });
    if (equippable.length === 0) {
      out.push({ kind: 'empty' });
    } else {
      for (const item of equippable) {
        out.push({ kind: 'equippable', item });
      }
    }
    return out;
  }

  function rowRects(body) {
    let y = body.y;
    return rows().map(r => {
      const h = r.kind === 'section' ? SECTION_H : ROW_H;
      const rect = { x: body.x, y, w: body.w, h, row: r };
      y += h;
      return rect;
    });
  }

  function isRowActive(r) {
    if (!activeRow) return false;
    if (r.kind === 'slot' && activeRow.kind === 'slot') return r.slotName === activeRow.slotName;
    if (r.kind === 'equippable' && activeRow.kind === 'equippable') return r.item === activeRow.item;
    return false;
  }

  function openSlotMenu(slotName, item) {
    activeRow = { kind: 'slot', slotName };
    menu = createActionMenu({
      theme, getViewport,
      title: `${item.components.get('name') ?? 'Item'} — Actions`,
      actions: [
        { label: 'Unequip', action: { type: 'unequip', slot: slotName } },
        { label: 'Cancel', action: null },
      ],
      onSelect: (action) => {
        activeRow = null;
        menu = null;
        if (action) onAction(action);
      },
    });
  }

  function openEquippableMenu(item) {
    activeRow = { kind: 'equippable', item };
    menu = createActionMenu({
      theme, getViewport,
      title: `${item.components.get('name') ?? 'Item'} — Actions`,
      actions: [
        { label: 'Equip', action: { type: 'equip', itemEntityId: item.id } },
        { label: 'Cancel', action: null },
      ],
      onSelect: (action) => {
        activeRow = null;
        menu = null;
        if (action) onAction(action);
      },
    });
  }

  return {
    render(ctx, body) {
      for (const rect of rowRects(body)) {
        const r = rect.row;

        if (r.kind === 'section') {
          drawText(ctx, r.label, rect.x + PADDING, rect.y + rect.h - 6, {
            color: theme.textDim, size: 12, weight: '600', baseline: 'alphabetic',
          });
          ctx.fillStyle = theme.primary;
          ctx.fillRect(rect.x, rect.y + rect.h - 1, rect.w, 1);
          continue;
        }

        if (r.kind === 'empty') {
          drawText(ctx, '(none)', rect.x + body.w / 2, rect.y + rect.h / 2, {
            color: theme.textDim, size: 13, align: 'center', baseline: 'middle',
          });
          continue;
        }

        const active = isRowActive(r);
        ctx.fillStyle = active ? theme.accent : theme.surface;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

        const labelColor = active ? theme.bg : theme.text;
        const dimColor = active ? theme.bg : theme.textDim;

        if (r.kind === 'slot') {
          const slotLabel = r.slotName.toUpperCase();
          const itemLabel = r.item ? (r.item.components.get('name') ?? 'Unknown') : '—';
          drawText(ctx, slotLabel, rect.x + PADDING, rect.y + rect.h / 2, {
            color: dimColor, size: 12, weight: '600', baseline: 'middle',
          });
          drawText(ctx, itemLabel, rect.x + PADDING + 80, rect.y + rect.h / 2, {
            color: r.item ? labelColor : dimColor,
            size: 14, baseline: 'middle',
          });
        } else if (r.kind === 'equippable') {
          const name = r.item.components.get('name') ?? 'Unknown';
          const slot = r.item.components.get('equippable').slot;
          drawText(ctx, name, rect.x + PADDING, rect.y + rect.h / 2, {
            color: labelColor, size: 14, baseline: 'middle',
          });
          drawText(ctx, `(${slot})`, rect.x + PADDING + 140, rect.y + rect.h / 2, {
            color: dimColor, size: 12, baseline: 'middle',
          });
        }
      }

      menu?.render(ctx);
    },

    handleInput(event, body) {
      if (menu) return menu.handleInput(event);
      if (event.type !== 'pointerdown') return false;
      for (const rect of rowRects(body)) {
        if (!hitTest(rect, event.x, event.y)) continue;
        const r = rect.row;
        if (r.kind === 'slot' && r.item) {
          openSlotMenu(r.slotName, r.item);
          return true;
        }
        if (r.kind === 'equippable') {
          openEquippableMenu(r.item);
          return true;
        }
        return true;
      }
      return false;
    },
  };
}
