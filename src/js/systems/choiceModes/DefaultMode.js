import { BaseMode } from './BaseMode.js';

// Default mode for normal game input
export class DefaultMode extends BaseMode {
  constructor() {
    super();
    this.validKeys = [
      'w',
      'a',
      's',
      'd',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
      'p',
      'u',
      'escape',
    ];
  }

  handleInput(key, context, gameState, gameDisplay, gameActions, modeManager) {
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
          modeManager.setMode('numeric', {
            action: 'pickup',
            items: availableItems,
          });
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
}
