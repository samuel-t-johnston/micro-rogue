import { BaseMode } from './BaseMode.js';

// Numeric mode for choosing from numbered options (e.g., item selection)
export class NumericMode extends BaseMode {
  constructor() {
    super();
    this.validKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'escape'];
  }

  handleInput(key, context, _gameState, _gameDisplay, gameActions, modeManager) {
    if (key.toLowerCase() === 'escape') {
      modeManager.resetToDefault();
      return true;
    }

    // Parse the numeric key (0-9)
    const itemIndex = parseInt(key);
    if (isNaN(itemIndex) || itemIndex < 0 || itemIndex > 9) {
      return false;
    }

    // Execute the action based on context
    if (context && context.action === 'pickup') {
      const success = gameActions.pickUpItemByIndex(itemIndex);
      if (success) {
        modeManager.resetToDefault();
      }
    } else if (context && context.action === 'equip') {
      const success = gameActions.equipItemByIndex(itemIndex, modeManager);
      if (success) {
        modeManager.resetToDefault();
      }
    } else if (context && context.action === 'weapon_replace') {
      const success = gameActions.replaceWeapon(itemIndex);
      if (success) {
        modeManager.resetToDefault();
      }
    } else if (context && context.action === 'remove') {
      const success = gameActions.removeEquipmentByIndex(itemIndex);
      // Only reset to default if the removal was actually completed
      // (not if it just set up a confirmation dialog)
      if (success && !modeManager.isInSpecialMode()) {
        modeManager.resetToDefault();
      }
    }

    return true;
  }

  getDisplayText(context) {
    if (context && context.action === 'pickup') {
      return 'Pick up - What would you like to pick up?';
    } else if (context && context.action === 'equip') {
      return 'Equip - What would you like to equip?';
    } else if (context && context.action === 'weapon_replace') {
      return 'Replace weapon - Which weapon would you like to replace?';
    } else if (context && context.action === 'remove') {
      return 'Remove equipment - What would you like to remove?';
    }
    return 'Choose item';
  }

  getControlInstructions(context) {
    const action = context?.action || 'item';
    return [
      { label: `Choose ${action}:`, keys: '0-9' },
      { label: 'ESC:', keys: 'Cancel' }
    ];
  }
}
