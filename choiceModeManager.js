// Choice mode manager to handle different input states
export class ChoiceModeManager {
  constructor(onModeChange = null) {
    this.currentMode = 'default';
    this.actionContext = null;
    this.onModeChange = onModeChange;
  }

  // Set the current choice mode and context
  setMode(mode, context = null) {
    this.currentMode = mode;
    this.actionContext = context;
    if (this.onModeChange) {
      this.onModeChange();
    }
  }

  // Reset to default mode
  resetToDefault() {
    this.currentMode = 'default';
    this.actionContext = null;
    if (this.onModeChange) {
      this.onModeChange();
    }
  }

  // Get current mode
  getCurrentMode() {
    return this.currentMode;
  }

  // Get current action context
  getActionContext() {
    return this.actionContext;
  }

  // Check if currently in a special mode (not default)
  isInSpecialMode() {
    return this.currentMode !== 'default';
  }

  // Handle input based on current mode
  handleInput(key, gameState, gameDisplay, gameActions) {
    const mode = CHOICE_MODES[this.currentMode];
    if (!mode) {
      console.error(`Unknown choice mode: ${this.currentMode}`);
      return false;
    }

    // Check if key is valid for current mode
    if (!mode.validKeys.includes(key.toLowerCase())) {
      return false;
    }

    // Handle the input
    return mode.handleInput(key, this.actionContext, gameState, gameDisplay, gameActions, this);
  }

  // Get display text for current mode
  getModeDisplayText() {
    const mode = CHOICE_MODES[this.currentMode];
    if (!mode || !mode.displayText) {
      return null;
    }
    return mode.displayText(this.actionContext);
  }
}

// Choice mode definitions
const CHOICE_MODES = {
  default: {
    validKeys: ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'p', 'u', 'escape'],
    handleInput: (key, context, gameState, gameDisplay, gameActions, modeManager) => {
      switch (key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          gameActions.movePlayer(0, -1);
          break;
        case 's':
        case 'arrowdown':
          gameActions.movePlayer(0, 1);
          break;
        case 'a':
        case 'arrowleft':
          gameActions.movePlayer(-1, 0);
          break;
        case 'd':
        case 'arrowright':
          gameActions.movePlayer(1, 0);
          break;
        case 'p': {
          // Check if there are multiple items to pick up
          const availableItems = gameActions.getAvailableItems();
          if (availableItems.length > 1) {
            // Enter numeric choice mode for multi-item pickup
            modeManager.setMode('numeric', { action: 'pickup', items: availableItems });
          } else if (availableItems.length === 1) {
            // Single item - pick up immediately
            gameActions.pickUpItem();
          } else {
            // No items - show message
            gameActions.pickUpItem();
          }
          break;
        }
        case 'u':
          // Enter directional choice mode for use action
          modeManager.setMode('directional', { action: 'use' });
          break;
        case 'escape':
          // No action in default mode
          break;
      }
      return true;
    }
  },

  directional: {
    validKeys: ['w', 'a', 's', 'd', 'q', 'e', 'z', 'c', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape'],
    handleInput: (key, context, gameState, gameDisplay, gameActions, modeManager) => {
      const directionMap = {
        'w': { dx: 0, dy: -1 },
        'arrowup': { dx: 0, dy: -1 },
        's': { dx: 0, dy: 1 },
        'arrowdown': { dx: 0, dy: 1 },
        'a': { dx: -1, dy: 0 },
        'arrowleft': { dx: -1, dy: 0 },
        'd': { dx: 1, dy: 0 },
        'arrowright': { dx: 1, dy: 0 },
        'q': { dx: -1, dy: -1 },
        'e': { dx: 1, dy: -1 },
        'z': { dx: -1, dy: 1 },
        'c': { dx: 1, dy: 1 }
      };

      if (key.toLowerCase() === 'escape') {
        modeManager.resetToDefault();
        return true;
      }

      const direction = directionMap[key.toLowerCase()];
      if (!direction) {
        return false;
      }

      // Execute the action based on context
      if (context && context.action === 'use') {
        const success = gameActions.useFurniture(direction.dx, direction.dy);
        if (success) {
          modeManager.resetToDefault();
        } else {
          // If not successful, stay in directional mode to allow retry
        }
      }

      return true;
    },
    displayText: (context) => {
      if (context && context.action === 'use') {
        return 'Use - choose direction (WASD/QEZC/arrows) or ESC to cancel';
      }
      return 'Choose direction (WASD/QEZC/arrows) or ESC to cancel';
    }
  },

  numeric: {
    validKeys: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'escape'],
    handleInput: (key, context, gameState, gameDisplay, gameActions, modeManager) => {
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
    },
    displayText: (context) => {
      if (context && context.action === 'pickup') {
        return 'Pick up - choose item (0-9) or ESC to cancel';
      }
      return 'Choose item (0-9) or ESC to cancel';
    }
  }
};
