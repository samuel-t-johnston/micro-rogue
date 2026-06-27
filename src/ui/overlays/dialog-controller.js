import { createItemListDialog } from '../dialogs/item-list-dialog.js';

/**
 * Creates the dialog controller: owns the single active in-game dialog and routes render/input to it.
 * The game scene holds one instance.
 */
export function createDialogController({ theme, getViewport }) {
  let active = null;

  return {
    // Show an item list dialog. Resolves with { confirmed, taken } when closed. `confirmLabel`
    // sets the confirm button text ('Take' for pickups, 'Place' for storing into a container).
    showItemList({ title, items, confirmLabel }) {
      return new Promise((resolve) => {
        active = createItemListDialog({
          theme,
          getViewport,
          title,
          items,
          confirmLabel,
          onClose: (result) => {
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
