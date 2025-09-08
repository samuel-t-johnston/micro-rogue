import { BaseMode } from './BaseMode.js';

// Yes/No mode for confirmation dialogs
export class YNMode extends BaseMode {
  constructor() {
    super();
    this.validKeys = ['y', 'n', 'escape'];
  }

  handleInput(key, context, _gameState, _gameDisplay, gameActions, modeManager) {
    if (key.toLowerCase() === 'escape') {
      modeManager.resetToDefault();
      return true;
    }

    if (key.toLowerCase() === 'y') {
      // Execute the action based on context
      if (context && context.action === 'equip') {
        const success = gameActions.equipItemWithReplacement(
          context.itemIndex,
          context.existingItem,
          context.slot
        );
        if (success) {
          modeManager.resetToDefault();
        }
      } else if (context && context.action === 'drop_equipment') {
        const success = gameActions.removeEquipmentWithDrop(
          context.item,
          context.slot,
          context.ringIndex
        );
        if (success) {
          modeManager.resetToDefault();
        }
      }
    } else if (key.toLowerCase() === 'n') {
      // Cancel - just return to default mode
      modeManager.resetToDefault();
    } else {
      return false;
    }

    return true;
  }

  getDisplayText(context) {
    if (context && context.action === 'equip') {
      const existingItemName = context.existingItem?.name || 'Unknown Item';
      const newItemName = context.newItem?.name || 'Unknown Item';
      const slotName = context.slot || 'unknown';
      return `You have a ${existingItemName} equipped in your ${slotName} slot. Remove it to equip ${newItemName}?`;
    } else if (context && context.action === 'drop_equipment') {
      const itemName = context.item?.name || 'Unknown Item';
      return `There is no room in your inventory. Drop the ${itemName} on the ground?`;
    }
    return 'Yes or No?';
  }

  getControlInstructions(_context) {
    return [
      { label: 'Y:', keys: 'Yes' },
      { label: 'N:', keys: 'No' },
      { label: 'ESC:', keys: 'Cancel' }
    ];
  }
}
