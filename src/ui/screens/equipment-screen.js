import { drawText, hitTest } from '../canvas-ui.js';

const ROW_H = 40;
const SECTION_H = 28;
const PADDING = 12;

// Equipment screen: shows current slot contents and inventory items eligible to be equipped.
// Tapping an equipped slot submits an unequip action; tapping an equippable inventory item submits an equip.
// Either action closes the menu (decided in controller via onAction).
export function createEquipmentScreenBody({ theme, getSlots, getEquippableInventory, onAction }) {
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

        ctx.fillStyle = theme.surface;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

        if (r.kind === 'slot') {
          const slotLabel = r.slotName.toUpperCase();
          const itemLabel = r.item ? (r.item.components.get('name') ?? 'Unknown') : '—';
          drawText(ctx, slotLabel, rect.x + PADDING, rect.y + rect.h / 2, {
            color: theme.textDim, size: 12, weight: '600', baseline: 'middle',
          });
          drawText(ctx, itemLabel, rect.x + PADDING + 80, rect.y + rect.h / 2, {
            color: r.item ? theme.text : theme.textDim,
            size: 14, baseline: 'middle',
          });
          if (r.item) {
            drawText(ctx, 'tap to unequip', rect.x + rect.w - PADDING, rect.y + rect.h / 2, {
              color: theme.textDim, size: 11, align: 'right', baseline: 'middle',
            });
          }
        } else if (r.kind === 'equippable') {
          const name = r.item.components.get('name') ?? 'Unknown';
          const slot = r.item.components.get('equippable').slot;
          drawText(ctx, name, rect.x + PADDING, rect.y + rect.h / 2, {
            color: theme.text, size: 14, baseline: 'middle',
          });
          drawText(ctx, `(${slot})`, rect.x + PADDING + 140, rect.y + rect.h / 2, {
            color: theme.textDim, size: 12, baseline: 'middle',
          });
          drawText(ctx, 'tap to equip', rect.x + rect.w - PADDING, rect.y + rect.h / 2, {
            color: theme.textDim, size: 11, align: 'right', baseline: 'middle',
          });
        }
      }
    },

    handleInput(event, body) {
      if (event.type !== 'pointerdown') return false;
      for (const rect of rowRects(body)) {
        if (!hitTest(rect, event.x, event.y)) continue;
        const r = rect.row;
        if (r.kind === 'slot' && r.item) {
          onAction({ type: 'unequip', slot: r.slotName });
          return true;
        }
        if (r.kind === 'equippable') {
          onAction({ type: 'equip', itemEntityId: r.item.id });
          return true;
        }
        return true;
      }
      return false;
    },
  };
}
