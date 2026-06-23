import { createCharacterMenuRoot, createCharacterMenuSubScreen } from './character-menu.js';
import { createInventoryScreenBody } from './screens/inventory-screen.js';
import { createEquipmentScreenBody } from './screens/equipment-screen.js';

/**
 * Creates the full-screen character menu overlay (a root card grid drilling into Inventory and
 * Equipment sub-screens). Suppresses map input while open. `onAction` is invoked with a game action
 * (e.g. equip/unequip) that the caller routes through the input controller; submitting an action
 * closes the menu, since open-during-turn-resolution behavior isn't designed yet.
 */
export function createCharacterMenuController({ theme, getViewport, getPlayer, onAction }) {
  let screen = null;

  function close() {
    screen = null;
  }
  function openRoot() {
    screen = buildRoot();
  }
  function openInventory() {
    screen = buildInventory();
  }
  function openEquipment() {
    screen = buildEquipment();
  }

  function buildRoot() {
    const player = getPlayer();
    const inv = player?.components.get('inventory');
    const wears = player?.components.get('wearsEquipment');
    const itemCount = inv?.items.length ?? 0;
    const equippedCount = wears ? Object.values(wears.slots).filter(Boolean).length : 0;
    const totalSlots = wears ? Object.keys(wears.slots).length : 0;

    return createCharacterMenuRoot({
      theme,
      getViewport,
      cards: [
        {
          id: 'inventory',
          label: 'Inventory',
          glyph: '🎒',
          badge: itemCount > 0 ? `${itemCount}` : null,
        },
        {
          id: 'equipment',
          label: 'Equipment',
          glyph: '⚔',
          badge: totalSlots > 0 ? `${equippedCount}/${totalSlots}` : null,
        },
      ],
      onClose: close,
      onSelect: (id) => {
        if (id === 'inventory') openInventory();
        else if (id === 'equipment') openEquipment();
      },
    });
  }

  function buildInventory() {
    const body = createInventoryScreenBody({
      theme,
      getViewport,
      getItems: () => getPlayer()?.components.get('inventory')?.items ?? [],
      onAction: (action) => {
        close();
        onAction(action);
      },
    });
    return createCharacterMenuSubScreen({
      theme,
      getViewport,
      title: 'Inventory',
      onBack: openRoot,
      renderBody: body.render,
      handleBodyInput: body.handleInput,
    });
  }

  function buildEquipment() {
    const body = createEquipmentScreenBody({
      theme,
      getViewport,
      getSlots: () => {
        const wears = getPlayer()?.components.get('wearsEquipment');
        if (!wears) return [];
        return Object.entries(wears.slots).map(([name, item]) => ({ name, item }));
      },
      getEquippableInventory: () => {
        const inv = getPlayer()?.components.get('inventory');
        if (!inv) return [];
        return inv.items.filter((it) => it.components.has('equippable'));
      },
      onAction: (action) => {
        close();
        onAction(action);
      },
    });
    return createCharacterMenuSubScreen({
      theme,
      getViewport,
      title: 'Equipment',
      onBack: openRoot,
      renderBody: body.render,
      handleBodyInput: body.handleInput,
    });
  }

  return {
    get isOpen() {
      return screen !== null;
    },
    open: openRoot,
    close,
    render(ctx) {
      screen?.render(ctx);
    },
    handleInput(event) {
      return screen?.handleInput(event) ?? false;
    },
  };
}
