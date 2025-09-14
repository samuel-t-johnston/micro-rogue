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
      'e',
      'r',
      'x',
      'c',
      'escape',
    ];
  }

  handleInput(key, _context, _gameState, _gameDisplay, gameActions, modeManager) {
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
      case 'e': {
        // Check if there are equipment items to equip
        const availableEquipment = gameActions.getAvailableEquipment();
        if (availableEquipment.length > 0) {
          // Enter numeric choice mode for equipment selection
          modeManager.setMode('numeric', {
            action: 'equip',
            items: availableEquipment,
          });
        } else {
          // No equipment - show message
          gameActions.showMessage('You have no equipment to equip.');
        }
        break;
      }
      case 'r': {
        // Check if there are equipped items to remove
        const equippedItems = gameActions.getEquippedItems();
        if (equippedItems.length > 0) {
          // Enter numeric choice mode for equipment removal
          modeManager.setMode('numeric', {
            action: 'remove',
            items: equippedItems,
          });
        } else {
          // No equipment - show message
          gameActions.showMessage('You have no equipment to remove.');
        }
        break;
      }
      case 'x': {
        // Check if there are items in inventory to drop
        const inventoryItems = gameActions.getInventoryItems();
        if (inventoryItems.length > 0) {
          // Enter numeric choice mode for item dropping
          modeManager.setMode('numeric', {
            action: 'drop',
            items: inventoryItems,
          });
        } else {
          // No items - show message
          gameActions.showMessage('You have no items to drop.');
        }
        break;
      }
      case 'c': {
        // Check if there are consumable items in inventory
        const consumableItems = gameActions.getConsumableItems();
        if (consumableItems.length > 0) {
          // Enter numeric choice mode for consumable selection
          modeManager.setMode('numeric', {
            action: 'consume',
            items: consumableItems,
          });
        } else {
          // No consumables - show message
          gameActions.showMessage('You have no consumable items.');
        }
        break;
      }
      case 'escape':
        // No action in default mode
        break;
    }
    return true;
  }

  getDisplayText(_context) {
    return 'What would you like to do?';
  }

  getControlInstructions(_context) {
    return [
      { label: 'Movement:', keys: 'WASD or Arrow Keys' },
      { label: 'P:', keys: 'Pick up' },
      { label: 'U:', keys: 'Use something nearby' },
      { label: 'E:', keys: 'Equip item' },
      { label: 'R:', keys: 'Remove equipment' },
      { label: 'X:', keys: 'Drop item' },
      { label: 'C:', keys: 'Consume item' }
    ];
  }
}
