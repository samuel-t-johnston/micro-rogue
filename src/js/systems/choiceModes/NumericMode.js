import { BaseMode } from './BaseMode.js';

// Numeric mode for choosing from numbered options (e.g., item selection)
export class NumericMode extends BaseMode {
  constructor() {
    super();
    this.validKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'escape'];
  }

  handleInput(key, context, gameState, gameDisplay, gameActions, modeManager) {
    if (key.toLowerCase() === 'escape') {
      modeManager.resetToDefault();
      return true;
    }

    // Parse the numeric key (0-9)
    const itemIndex = parseInt(key);
    if (isNaN(itemIndex) || itemIndex < 0 || itemIndex > 9) {
      return false;
    }

    // Execute the pickup action with the selected item index
    if (context && context.action === 'pickup') {
      const success = gameActions.pickUpItemByIndex(itemIndex);
      if (success) {
        modeManager.resetToDefault();
      }
    }

    return true;
  }

  getDisplayText(context) {
    if (context && context.action === 'pickup') {
      return 'Pick up - What would you like to pick up?';
    }
    return 'Choose item';
  }

  getControlInstructions(context) {
    return [
      { label: 'Choose item:', keys: '0-9' },
      { label: 'ESC:', keys: 'Cancel' }
    ];
  }
}
