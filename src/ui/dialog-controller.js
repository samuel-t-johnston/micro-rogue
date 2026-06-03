import { createItemListDialog } from './dialogs/item-list-dialog.js';

export function createDialogController({ theme, getViewport }) {
  let active = null;

  return {
    // Show an item list dialog. Resolves with { confirmed, taken } when closed.
    showItemList({ title, items }) {
      return new Promise(resolve => {
        active = createItemListDialog({
          theme,
          getViewport,
          title,
          items,
          onClose: result => {
            active = null;
            resolve(result);
          },
        });
      });
    },

    get isActive() {
      return active !== null;
    },

    render(ctx) {
      active?.render(ctx);
    },

    handleInput(event) {
      return active?.handleInput(event) ?? false;
    },
  };
}
