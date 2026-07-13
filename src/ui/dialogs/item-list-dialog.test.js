import { describe, it, expect, vi } from 'vitest';
import { createItemListDialog } from './item-list-dialog.js';

// Real hitTest against a fixed viewport, so we tap real rect centers. Geometry (see item-list-dialog.js):
//   dialogH = 44 + 1 + items*44 + 1 + 64;  dlgX = round((w-320)/2);  dlgY = round((h-dialogH)/2)
// For 3 items at 400×600: dialogH=242, dlgX=40, dlgY=179.
const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
const VP = { width: 400, height: 600 };

function make() {
  const onClose = vi.fn();
  const dialog = createItemListDialog({
    theme: {},
    getViewport: () => VP,
    title: 'Take',
    items,
    onClose,
  });
  return { dialog, onClose };
}

const tap = (x, y) => ({ type: 'pointerdown', x, y });
const rowCenter = (i) => tap(200, 246 + i * 44); // rows start at y=224, height 44
const CONFIRM = tap(289, 389); // confirmBtn center
const CANCEL = tap(111, 389); // cancelBtn center

describe('item-list-dialog', () => {
  it('starts with all items selected and confirms them all', () => {
    const { dialog, onClose } = make();
    dialog.handleInput(CONFIRM);
    expect(onClose).toHaveBeenCalledWith({ confirmed: true, taken: items });
  });

  it('toggles a row off, so confirm omits it', () => {
    const { dialog, onClose } = make();
    dialog.handleInput(rowCenter(1)); // deselect the middle item
    dialog.handleInput(CONFIRM);
    expect(onClose).toHaveBeenCalledWith({ confirmed: true, taken: [items[0], items[2]] });
  });

  it('re-toggling a row selects it again', () => {
    const { dialog, onClose } = make();
    dialog.handleInput(rowCenter(0)); // off
    dialog.handleInput(rowCenter(0)); // on again
    dialog.handleInput(CONFIRM);
    expect(onClose).toHaveBeenCalledWith({ confirmed: true, taken: items });
  });

  it('confirm is inert once nothing is selected', () => {
    const { dialog, onClose } = make();
    for (let i = 0; i < items.length; i++) dialog.handleInput(rowCenter(i)); // all off
    dialog.handleInput(CONFIRM);
    expect(onClose).not.toHaveBeenCalled(); // disabled confirm doesn't close
  });

  it('cancel closes with nothing taken', () => {
    const { dialog, onClose } = make();
    dialog.handleInput(CANCEL);
    expect(onClose).toHaveBeenCalledWith({ confirmed: false, taken: [] });
  });

  it('Escape closes with nothing taken', () => {
    const { dialog, onClose } = make();
    dialog.handleInput({ type: 'keydown', key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith({ confirmed: false, taken: [] });
  });
});
