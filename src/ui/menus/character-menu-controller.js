import { createCharacterMenuRoot, createCharacterMenuSubScreen } from './character-menu.js';
import { createInventoryScreenBody } from '../screens/inventory-screen.js';
import { createEquipmentScreenBody } from '../screens/equipment-screen.js';
import { createStatsScreenBody } from '../screens/stats-screen.js';
import { getScore, describeAttribute } from '../../attributes/attribute-access.js';

// Curated character-sheet attributes: the Level headline plus the currently meaningful stats. Not
// driven by listAttributes because Level is derived (never stored) and we intentionally omit the
// not-yet-seeded ability scores. Per-attribute display config (order/visibility) is the deferred
// display-metadata work — see docs/design/attribute-system.md.
const CHARACTER_SHEET = ['level', 'hp', 'attack', 'con', 'xp'];

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
  function openStats() {
    screen = buildStats();
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
        {
          id: 'stats',
          label: 'Stats',
          glyph: '📊',
          badge: player ? `Lv ${getScore(player, 'level')}` : null,
        },
      ],
      onClose: close,
      onSelect: (id) => {
        if (id === 'inventory') openInventory();
        else if (id === 'equipment') openEquipment();
        else if (id === 'stats') openStats();
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

  function buildStats() {
    const body = createStatsScreenBody({
      theme,
      getAttributes: () => {
        const player = getPlayer();
        if (!player) return [];
        return CHARACTER_SHEET.map((name) => describeAttribute(player, name));
      },
    });
    return createCharacterMenuSubScreen({
      theme,
      getViewport,
      title: 'Stats',
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
